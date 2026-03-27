/**
 * WhatsApp Web client using Baileys (QR code auth, no Meta Business API)
 * Each user gets their own persistent session stored on disk.
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import path from 'path'
import fs from 'fs'
import { createAdminClient } from '@/lib/supabase/admin'
import { deepseek } from '@/lib/ai/client'
import {
  WHATSAPP_TASK_EXTRACTION_SYSTEM,
  WHATSAPP_TASK_EXTRACTION_USER,
} from '@/lib/ai/prompts/whatsapp-extraction'

// ─── Session path management ───

const SESSIONS_ROOT = path.join(process.cwd(), '.wa-sessions')

function getSessionPath(userId: string): string {
  const dir = path.join(SESSIONS_ROOT, userId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function hasSession(userId: string): boolean {
  const dir = path.join(SESSIONS_ROOT, userId)
  return fs.existsSync(dir) && fs.readdirSync(dir).length > 0
}

// ─── In-memory connection store ───

const connections = new Map<string, WASocket>()

export function getConnection(userId: string): WASocket | undefined {
  return connections.get(userId)
}

export function isConnected(userId: string): boolean {
  const sock = connections.get(userId)
  return !!sock?.user
}

export function getPhoneNumber(userId: string): string | undefined {
  const sock = connections.get(userId)
  return sock?.user?.id.split(':')[0]
}

// ─── Connect (QR flow) ───

export interface ConnectResult {
  qrCode?: string       // Raw QR string (not yet a data URL — caller converts)
  pairingCode?: string  // 8-digit pairing code for phone number auth
  connected: boolean
  phoneNumber?: string
}

/**
 * Start or resume a WhatsApp connection for this user.
 * - If already connected, returns immediately.
 * - If session files exist, attempts silent reconnect.
 * - If phoneNumber provided, uses pairing code (no QR needed).
 * - Otherwise returns a QR string for the frontend to display.
 */
export async function connectWhatsApp(userId: string, phoneNumber?: string): Promise<ConnectResult> {
  // Already connected — fast path
  const existing = connections.get(userId)
  if (existing?.user) {
    return { connected: true, phoneNumber: existing.user.id.split(':')[0] }
  }

  const sessionPath = getSessionPath(userId)
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

  return new Promise<ConnectResult>((resolve) => {
    let resolved = false

    // Timeout after 30 seconds if nothing happens
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        resolve({ connected: false })
      }
    }, 30000)

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }) as any,
      browser: ['Chief AI', 'Chrome', '120.0'],
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      // If phone number provided, request pairing code instead of showing QR
      if (qr && phoneNumber && !resolved) {
        try {
          const cleanNumber = phoneNumber.replace(/[\s\-\+]/g, '')
          const code = await sock.requestPairingCode(cleanNumber)
          resolved = true
          clearTimeout(timeout)
          resolve({ pairingCode: code, connected: false, phoneNumber: cleanNumber })
        } catch (err) {
          console.error('Pairing code request failed:', err)
          // Fall back to QR
          resolved = true
          resolve({ qrCode: qr, connected: false })
        }
        return
      }

      if (qr && !resolved) {
        resolved = true
        clearTimeout(timeout)
        resolve({ qrCode: qr, connected: false })
      }

      if (connection === 'open') {
        connections.set(userId, sock)
        setupMessageHandler(userId)
        await upsertConnectionRecord(userId, 'active', sock.user?.id.split(':')[0])

        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          resolve({ connected: true, phoneNumber: sock.user?.id.split(':')[0] })
        }
      }

      if (connection === 'close') {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode
        connections.delete(userId)

        // Clean up invalid/expired session and let user re-authenticate
        if (reason === DisconnectReason.loggedOut || reason === 401 || reason === 515) {
          fs.rmSync(sessionPath, { recursive: true, force: true })
          await upsertConnectionRecord(userId, 'disconnected')
        }

        if (!resolved) {
          // Session expired or invalid — restart fresh to generate new QR
          resolved = true
          if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true })
          }
          // Retry once to get a fresh QR code
          try {
            const retry = await connectWhatsApp(userId, phoneNumber)
            resolve(retry)
          } catch {
            resolve({ connected: false })
          }
        }
      }
    })
  })
}

// ─── Disconnect ───

export async function disconnectWhatsApp(userId: string): Promise<void> {
  const sock = connections.get(userId)
  if (sock) {
    try {
      await sock.logout()
    } catch {
      // Already disconnected — ignore
    }
    connections.delete(userId)
  }
  const sessionPath = path.join(SESSIONS_ROOT, userId)
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true })
  }
  await upsertConnectionRecord(userId, 'disconnected')
}

// ─── Message handler ───

function setupMessageHandler(userId: string) {
  const sock = connections.get(userId)
  if (!sock) return

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const supabase = createAdminClient()
    const myNumber = sock.user?.id.split(':')[0] || ''

    for (const msg of messages) {
      if (!msg.message) continue
      // Skip status broadcasts
      if (msg.key.remoteJid === 'status@broadcast') continue

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        ''

      const isFromMe = msg.key.fromMe || false
      const remoteJid = msg.key.remoteJid || ''
      const remoteNumber = remoteJid.split('@')[0]
      const fromNumber = isFromMe ? myNumber : remoteNumber
      const toNumber = isFromMe ? remoteNumber : myNumber
      const fromName = msg.pushName || fromNumber

      const messageData = {
        user_id: userId,
        wa_message_id: msg.key.id || `${Date.now()}-${Math.random()}`,
        from_number: fromNumber,
        from_name: isFromMe ? null : fromName,
        to_number: toNumber,
        body: text || null,
        message_type: getMessageType(msg.message),
        direction: isFromMe ? 'outbound' : 'inbound',
        received_at: msg.messageTimestamp
          ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString(),
      }

      const { error: insertError } = await supabase
        .from('whatsapp_messages')
        .upsert(messageData, { onConflict: 'user_id,wa_message_id' })

      if (insertError) {
        console.error('Failed to store WhatsApp message:', insertError)
        continue
      }

      // Extract tasks from inbound messages
      if (!isFromMe && text) {
        try {
          await extractTasksFromContact(supabase, userId, fromNumber, fromName)
        } catch (err) {
          console.error('WhatsApp task extraction failed:', err)
        }

        // Process through AI auto-reply (async, non-blocking)
        import('./ai-handler')
          .then(({ processMessageWithAI }) => {
            const isGroup = remoteJid.endsWith('@g.us')
            processMessageWithAI(userId, {
              from: fromNumber,
              fromName: fromName || fromNumber,
              body: text,
              remoteJid,
              isGroup,
              messageType: getMessageType(msg.message),
            }, async (jid: string, replyText: string) => {
              await sock.sendMessage(jid, { text: replyText })
            }).catch((err: any) => {
              console.error('[WhatsApp AI] Handler error:', err)
            })
          })
          .catch((err) => {
            console.error('[WhatsApp AI] Failed to load handler:', err)
          })
      }
    }
  })
}

function getMessageType(message: any): string {
  if (message.imageMessage) return 'image'
  if (message.videoMessage) return 'video'
  if (message.audioMessage) return 'audio'
  if (message.documentMessage) return 'document'
  return 'text'
}

// ─── Database helpers ───

async function upsertConnectionRecord(
  userId: string,
  status: 'active' | 'disconnected',
  phoneNumber?: string,
) {
  const supabase = createAdminClient()

  if (status === 'active' && phoneNumber) {
    await supabase
      .from('whatsapp_connections')
      .upsert(
        {
          user_id: userId,
          phone_number: phoneNumber,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,phone_number' },
      )
  } else {
    // Disconnect all active connections for this user
    await supabase
      .from('whatsapp_connections')
      .update({ status: 'disconnected', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .neq('status', 'disconnected')
  }
}

// ─── Task extraction (carried over from webhook route) ───

async function extractTasksFromContact(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  fromNumber: string,
  fromName: string | null,
) {
  const { data: recentMessages } = await supabase
    .from('whatsapp_messages')
    .select('id, body, direction, received_at')
    .eq('user_id', userId)
    .eq('from_number', fromNumber)
    .eq('is_task_extracted', false)
    .order('received_at', { ascending: true })
    .limit(10)

  if (!recentMessages || recentMessages.length === 0) return

  const textMessages = recentMessages.filter((m) => m.body)
  if (textMessages.length === 0) return

  const prompt = WHATSAPP_TASK_EXTRACTION_USER({
    from_name: fromName,
    from_number: fromNumber,
    messages: textMessages.map((m) => ({
      body: m.body!,
      direction: m.direction,
      received_at: m.received_at,
    })),
  })

  const completion = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: WHATSAPP_TASK_EXTRACTION_SYSTEM },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  const content = completion.choices[0]?.message?.content
  if (!content) return

  let parsed: any
  try {
    parsed = JSON.parse(content)
  } catch {
    console.error('Failed to parse WhatsApp task extraction JSON:', content)
    return
  }

  const tasks = parsed?.tasks || []
  for (const task of tasks) {
    if ((task.confidence || 0) < 0.6) continue
    const sourceMessageId = recentMessages[recentMessages.length - 1].id

    await supabase.from('tasks').insert({
      user_id: userId,
      title: task.title,
      priority: task.priority || 2,
      status: 'pending',
      source_type: 'whatsapp',
      source_wa_message_id: sourceMessageId,
      due_date: task.due_date || null,
      due_reason: task.due_reason || null,
      ai_confidence: task.confidence,
    })
  }

  const messageIds = recentMessages.map((m) => m.id)
  await supabase
    .from('whatsapp_messages')
    .update({ is_task_extracted: true })
    .in('id', messageIds)
}
