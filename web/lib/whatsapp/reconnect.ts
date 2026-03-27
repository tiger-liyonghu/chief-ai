/**
 * Reconnect all saved WhatsApp sessions on server start.
 * Reads .wa-sessions/ directory and attempts to reconnect each user.
 */

import fs from 'fs'
import path from 'path'
import { connectWhatsApp } from './client'

const SESSIONS_ROOT = path.join(process.cwd(), '.wa-sessions')

let reconnected = false

/**
 * Call this once on server startup (e.g., from a server-side module init).
 * It reads the .wa-sessions directory and reconnects each saved session.
 * Safe to call multiple times — only runs once.
 */
export async function reconnectAllSessions(): Promise<void> {
  if (reconnected) return
  reconnected = true

  if (!fs.existsSync(SESSIONS_ROOT)) return

  const userIds = fs.readdirSync(SESSIONS_ROOT).filter((entry) => {
    const fullPath = path.join(SESSIONS_ROOT, entry)
    return fs.statSync(fullPath).isDirectory()
  })

  if (userIds.length === 0) return

  console.log(`[WhatsApp] Reconnecting ${userIds.length} saved session(s)...`)

  for (const userId of userIds) {
    try {
      const result = await connectWhatsApp(userId)
      if (result.connected) {
        console.log(`[WhatsApp] Reconnected ${userId} (${result.phoneNumber})`)
      } else {
        console.log(`[WhatsApp] Session for ${userId} needs re-authentication`)
      }
    } catch (err) {
      console.error(`[WhatsApp] Failed to reconnect ${userId}:`, err)
    }
  }
}
