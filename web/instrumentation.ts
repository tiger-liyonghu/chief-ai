export async function register() {
  // Only run on the server, not during build
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import to avoid bundling issues
    const { reconnectAllSessions } = await import('@/lib/whatsapp/reconnect')
    const { startSchedulers } = await import('@/lib/whatsapp/scheduler')

    // Reconnect existing WhatsApp sessions
    reconnectAllSessions().catch(console.error)

    // Start background schedulers (morning briefing, commitment alerts, travel)
    startSchedulers()
  }
}
