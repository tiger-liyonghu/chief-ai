/**
 * Reconnect all saved WhatsApp sessions on server start.
 *
 * All imports are dynamic so this module can be safely imported in
 * serverless environments (Vercel) where Baileys / fs are unavailable.
 */

let reconnected = false

/**
 * Call this once on server startup (e.g., from a server-side module init).
 * It reads the .wa-sessions directory and reconnects each saved session.
 * Safe to call multiple times — only runs once.
 * Gracefully no-ops in serverless environments.
 */
export async function reconnectAllSessions(): Promise<void> {
  if (reconnected) return
  reconnected = true

  try {
    // Dynamic imports — will throw in serverless environments where
    // Baileys / native Node modules are not bundled.
    const fs = await import('fs')
    const path = await import('path')
    const { connectWhatsApp } = await import('./client')

    const SESSIONS_ROOT = path.join(process.cwd(), '.wa-sessions')

    if (!fs.existsSync(SESSIONS_ROOT)) return

    const userIds = fs.readdirSync(SESSIONS_ROOT).filter((entry: string) => {
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
  } catch {
    // Expected in serverless environments (Vercel) — Baileys not available.
    console.log('[WhatsApp] Not available in this environment (serverless)')
  }
}
