/**
 * WhatsApp Web client using Baileys (QR code auth, no Meta Business API)
 * Each user gets their own persistent session stored on disk.
 */

import makeWASocket, {
  DisconnectReason,
  fetchLatestWaWebVersion,
  useMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import path from 'path'
import fs from 'fs'
import { supabase } from './supabase'

// ─── Session path management ───

const SESSIONS_ROOT = process.env.SESSIONS_PATH || path.join(process.cwd(), '.wa-sessions')

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
const connectingUsers = new Set<string>() // mutex for concurrent connects

export function getConnection(userId: string): WASocket | undefined {
  return connections.get(userId)
}

export function getActiveCount(): number {
  return connections.size
}

export async function disconnectAll(): Promise<void> {
  for (const [userId, sock] of connections) {
    try {
      sock.end(undefined)
      console.log(`[WA] Disconnected ${userId}`)
    } catch { /* ignore */ }
  }
  connections.clear()
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
  qrCode?: string
  pairingCode?: string
  connected: boolean
  phoneNumber?: string
}

export async function connectWhatsApp(userId: string, phoneNumber?: string): Promise<ConnectResult> {
  console.log(`[WA] connectWhatsApp called for user=${userId}, phone=${phoneNumber || 'QR mode'}`)

  // Mutex: prevent concurrent connects for same user
  if (connectingUsers.has(userId)) {
    console.log(`[WA] Already connecting for ${userId}, skipping`)
    return { connected: false }
  }
  connectingUsers.add(userId)

  const existing = connections.get(userId)
  if (existing?.user) {
    console.log(`[WA] Already connected for ${userId}`)
    connectingUsers.delete(userId)
    return { connected: true, phoneNumber: existing.user.id.split(':')[0] }
  }

  const sessionPath = getSessionPath(userId)
  console.log(`[WA] Session path: ${sessionPath}`)
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

  const { version } = await fetchLatestWaWebVersion({})
  console.log(`[WA] Using WA Web version: ${JSON.stringify(version)}`)

  return new Promise<ConnectResult>((rawResolve) => {
    let resolved = false
    const resolve = (result: ConnectResult) => { connectingUsers.delete(userId); rawResolve(result) }

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        resolve({ connected: false })
      }
    }, 30000)

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'warn' }) as any,
      browser: ['Chrome', 'Chrome', '145.0.0'],
      connectTimeoutMs: 20000,
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update
      console.log(`[WA] connection.update:`, { connection, qr: qr ? 'QR_RECEIVED' : undefined, lastDisconnect: lastDisconnect?.error?.message })

      if (qr && phoneNumber && !resolved) {
        try {
          const cleanNumber = phoneNumber.replace(/[\s\-\+]/g, '')
          const code = await sock.requestPairingCode(cleanNumber)
          resolved = true
          clearTimeout(timeout)
          resolve({ pairingCode: code, connected: false, phoneNumber: cleanNumber })
        } catch (err) {
          console.error('Pairing code request failed:', err)
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
        const errorMsg = lastDisconnect?.error?.message || 'unknown'
        console.log(`[WA] Connection closed. Reason code: ${reason}, message: ${errorMsg}`)
        connections.delete(userId)

        if (reason === DisconnectReason.loggedOut || reason === 401) {
          // Truly logged out — wipe session
          fs.rmSync(sessionPath, { recursive: true, force: true })
          await upsertConnectionRecord(userId, 'disconnected')
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            resolve({ connected: false })
          }
        } else if (reason === 515 || reason === DisconnectReason.restartRequired) {
          // Stream error — reconnect with saved session
          console.log(`[WA] Stream error for ${userId}, auto-reconnecting...`)
          setTimeout(async () => {
            try {
              const result = await connectWhatsApp(userId)
              if (!resolved) {
                resolved = true
                clearTimeout(timeout)
                resolve(result)
              }
            } catch (err) {
              console.error(`[WA] Reconnect failed for ${userId}:`, err)
              if (!resolved) {
                resolved = true
                clearTimeout(timeout)
                resolve({ connected: false })
              }
            }
          }, 2000)
        } else {
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            console.log(`[WA] Connection failed for ${userId}, reason: ${reason}`)
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
      // Already disconnected
    }
    connections.delete(userId)
  }
  const sessionPath = path.join(SESSIONS_ROOT, userId)
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true })
  }
  await upsertConnectionRecord(userId, 'disconnected')
}

// ─── Message handler (self-chat only) ───

// Track message IDs sent by Apple to avoid reply loops (bounded, TTL-based)
const appleMessageIds = new Map<string, number>() // id -> timestamp

// Clean up old entries every 60 seconds
setInterval(() => {
  const cutoff = Date.now() - 60000 // 60 second TTL
  for (const [id, ts] of appleMessageIds) {
    if (ts < cutoff) appleMessageIds.delete(id)
  }
}, 60000)

function setupMessageHandler(userId: string) {
  const sock = connections.get(userId)
  if (!sock) { console.log(`[WA] setupMessageHandler: no socket for ${userId}`); return }

  // Prevent duplicate listeners on reconnect
  sock.ev.removeAllListeners('messages.upsert')

  const myNumber = sock.user?.id.split(':')[0] || ''
  const myLid = sock.user?.lid?.split(':')[0] || ''
  const selfJid = `${myNumber}@s.whatsapp.net`
  const selfLidJid = myLid ? `${myLid}@lid` : ''
  console.log(`[WA] Handler registered: selfJid=${selfJid}, selfLid=${selfLidJid}`)

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message) continue
      const remoteJid = msg.key.remoteJid || ''

      // Only process self-chat — ignore everything else
      const isSelfChat = remoteJid === selfJid || remoteJid === selfLidJid
      if (!isSelfChat) continue

      // Skip Apple's own replies to avoid loops
      const msgId = msg.key.id || ''
      if (appleMessageIds.has(msgId)) {
        appleMessageIds.delete(msgId)
        continue
      }

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        ''

      const msgType = getMessageType(msg.message)
      const hasImage = msgType === 'image'
      const hasAudio = msgType === 'audio'
      const hasDocument = msgType === 'document'
      const hasLocation = msgType === 'location'

      // Extract location if present
      if (hasLocation && msg.message.locationMessage) {
        const loc = msg.message.locationMessage
        const locText = `[位置: ${loc.degreesLatitude?.toFixed(4)}, ${loc.degreesLongitude?.toFixed(4)}${loc.name ? ' - ' + loc.name : ''}${loc.address ? ' (' + loc.address + ')' : ''}]`
        // Treat location as text message with location info
        if (!text) {
          // Override text with location info for Apple to process
          Object.defineProperty(msg.message, 'conversation', { value: `我在这个位置：${locText}`, writable: true })
        }
      }

      // Re-read text after location processing
      const finalText = text || msg.message.conversation || ''

      // Skip messages with no text AND no media
      if (!finalText.trim() && !hasImage && !hasAudio && !hasDocument && !hasLocation) continue

      const isFromMe = msg.key.fromMe || false
      console.log(`[WA] Self-chat: "${text.slice(0, 50)}", type=${msgType}, fromMe=${isFromMe}`)

      // Download media if present
      let imageBase64: string | undefined
      let audioBase64: string | undefined
      let documentBuffer: Buffer | undefined
      let documentName: string | undefined

      if ((hasImage || hasAudio || hasDocument) && msg.message) {
        try {
          const { downloadMediaMessage } = await import('@whiskeysockets/baileys')
          const buffer = await downloadMediaMessage(msg, 'buffer', {}) as Buffer

          if (hasImage) {
            imageBase64 = buffer.toString('base64')
            console.log(`[WA] Image downloaded: ${buffer.length} bytes`)
          } else if (hasAudio) {
            audioBase64 = buffer.toString('base64')
            console.log(`[WA] Audio downloaded: ${buffer.length} bytes`)
          } else if (hasDocument) {
            documentBuffer = buffer
            documentName = msg.message.documentMessage?.fileName || 'document'
            console.log(`[WA] Document downloaded: ${documentName}, ${buffer.length} bytes`)
          }
        } catch (err) {
          console.error('[WA] Media download failed:', err)
        }
      }

      // Store user message
      const messageData = {
        user_id: userId,
        wa_message_id: msgId || `${Date.now()}-${Math.random()}`,
        from_number: myNumber,
        from_name: null,
        to_number: 'sophia',
        body: text || (hasImage ? '[图片]' : hasAudio ? '[语音]' : hasDocument ? `[文件: ${documentName}]` : ''),
        message_type: msgType,
        direction: 'outbound',
        chat_role: 'user',
        received_at: msg.messageTimestamp
          ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString(),
      }

      const { error: insertError } = await supabase
        .from('whatsapp_messages')
        .upsert(messageData, { onConflict: 'user_id,wa_message_id' })

      if (insertError) {
        console.error('[WA] Failed to store message:', insertError)
        continue
      }

      // Send to Apple AI
      if (isFromMe) {
        const { processMessageWithAI } = await import('./ai-handler')
        processMessageWithAI(userId, {
          from: myNumber,
          fromName: 'User',
          body: text || (hasImage ? '请识别这张图片' : hasAudio ? '[语音消息]' : hasDocument ? `请分析这个文件: ${documentName}` : ''),
          remoteJid: selfLidJid || selfJid,
          isGroup: false,
          messageType: msgType,
          imageBase64,
          audioBase64,
          documentBuffer: documentBuffer?.toString('base64'),
          documentName,
        }, async (jid: string, replyText: string) => {
          const sent = await sock.sendMessage(jid, { text: `🍎 ${replyText}` })
          // Track this ID so we don't process it as a new command
          if (sent?.key?.id) appleMessageIds.set(sent.key.id, Date.now())
        }).catch((err: any) => {
          console.error('[WA] Apple reply error:', err)
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
  if (message.locationMessage) return 'location'
  return 'text'
}

// ─── Database helpers ───

async function upsertConnectionRecord(
  userId: string,
  status: 'active' | 'disconnected',
  phoneNumber?: string,
) {
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
    await supabase
      .from('whatsapp_connections')
      .update({ status: 'disconnected', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .neq('status', 'disconnected')
  }
}

// ─── Task extraction ───

const TASK_EXTRACTION_SYSTEM = `You are an AI assistant that extracts action items from WhatsApp messages.
Given recent messages from the same contact, identify tasks, requests, or commitments.
For each task: title (verb-first), priority (1-3), due_date (ISO or null), due_reason, confidence (0-1).
Rules: be conservative, skip "ok"/"thanks", confidence < 0.6 gets filtered out.
Respond in JSON: { "tasks": [...] }`

async function extractTasksFromContact(userId: string, fromNumber: string, fromName: string | null) {
  const { data: recentMessages } = await supabase
    .from('whatsapp_messages')
    .select('id, body, direction, received_at')
    .eq('user_id', userId)
    .eq('from_number', fromNumber)
    .eq('is_task_extracted', false)
    .order('received_at', { ascending: true })
    .limit(10)

  if (!recentMessages || recentMessages.length === 0) return

  const textMessages = recentMessages.filter((m: any) => m.body)
  if (textMessages.length === 0) return

  const lines = textMessages.map((m: any) => {
    const dir = m.direction === 'inbound' ? (fromName || fromNumber) : 'Me'
    return `[${new Date(m.received_at).toLocaleString()}] ${dir}: ${m.body}`
  }).join('\n')

  const prompt = `Contact: ${fromName || fromNumber}\n\n${lines}`.slice(0, 3000)

  // Use DeepSeek or configured LLM
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({
    baseURL: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
    apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '',
  })

  const completion = await client.chat.completions.create({
    model: process.env.LLM_MODEL || 'deepseek-chat',
    messages: [
      { role: 'system', content: TASK_EXTRACTION_SYSTEM },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' } as any,
  })

  const content = completion.choices[0]?.message?.content
  if (!content) return

  let parsed: any
  try { parsed = JSON.parse(content) } catch { return }

  const tasks = parsed?.tasks || []
  for (const task of tasks) {
    if ((task.confidence || 0) < 0.6) continue
    await supabase.from('tasks').insert({
      user_id: userId,
      title: task.title,
      priority: task.priority || 2,
      status: 'pending',
      source_type: 'whatsapp',
      source_wa_message_id: recentMessages[recentMessages.length - 1].id,
      due_date: task.due_date || null,
      due_reason: task.due_reason || null,
      ai_confidence: task.confidence,
    })
  }

  const messageIds = recentMessages.map((m: any) => m.id)
  await supabase
    .from('whatsapp_messages')
    .update({ is_task_extracted: true })
    .in('id', messageIds)
}
