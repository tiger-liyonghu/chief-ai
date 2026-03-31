import fs from 'fs'
import path from 'path'
import { connectWhatsApp } from '@/lib/whatsapp/client'
import { createAdminClient } from '@/lib/supabase/admin'

const SESSIONS_ROOT = process.env.WA_SESSIONS_PATH || process.env.SESSIONS_PATH || path.join(process.cwd(), '.wa-sessions')

let reconnected = false

export async function reconnectAllSessions(): Promise<void> {
  if (reconnected) return
  reconnected = true

  if (!fs.existsSync(SESSIONS_ROOT)) {
    fs.mkdirSync(SESSIONS_ROOT, { recursive: true })
    return
  }

  // Query active connections from DB — one phone number = one connection
  const admin = createAdminClient()
  const { data: connections } = await admin
    .from('whatsapp_connections')
    .select('user_id, phone_number')
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (!connections || connections.length === 0) {
    console.log('[WhatsApp] No active connections to reconnect')
    return
  }

  // Deduplicate by phone number — only the FIRST user_id per phone gets connected
  const connectedPhones = new Set<string>()
  const toConnect: typeof connections = []

  for (const conn of connections) {
    if (connectedPhones.has(conn.phone_number)) {
      console.log(`[WhatsApp] Skipping duplicate phone ${conn.phone_number} for user ${conn.user_id.slice(0, 8)}`)
      // Deactivate the duplicate in DB
      await admin.from('whatsapp_connections')
        .update({ status: 'disconnected' })
        .eq('user_id', conn.user_id)
        .eq('phone_number', conn.phone_number)
      continue
    }
    connectedPhones.add(conn.phone_number)
    toConnect.push(conn)
  }

  console.log(`[WhatsApp] Reconnecting ${toConnect.length} unique phone(s) (${connections.length} total connections, ${connections.length - toConnect.length} duplicates removed)...`)

  for (const conn of toConnect) {
    // Check if session directory exists
    const sessionDir = path.join(SESSIONS_ROOT, conn.user_id)
    if (!fs.existsSync(sessionDir)) {
      console.log(`[WhatsApp] No session dir for ${conn.user_id.slice(0, 8)}, skipping`)
      continue
    }

    try {
      const result = await connectWhatsApp(conn.user_id)
      if (result.connected) {
        console.log(`[WhatsApp] Reconnected ${conn.user_id.slice(0, 8)} (${result.phoneNumber})`)
      } else {
        console.log(`[WhatsApp] Session for ${conn.user_id.slice(0, 8)} needs re-authentication`)
      }
    } catch (err) {
      console.error(`[WhatsApp] Failed to reconnect ${conn.user_id.slice(0, 8)}:`, err)
    }
  }
}
