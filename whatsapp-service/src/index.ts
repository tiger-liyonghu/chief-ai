import express from 'express'
import { connectWhatsApp, disconnectWhatsApp, isConnected, getPhoneNumber, hasSession } from './client'
import { processMessageWithAI, isAIEnabled } from './ai-handler'
import { reconnectAllSessions } from './reconnect'
import { startMorningBriefingScheduler, triggerBriefingNow } from './morning-briefing'
import { startTravelScheduler } from './travel-brain'
import { supabase } from './supabase'
import QRCode from 'qrcode'

const app = express()
app.use(express.json())

const PORT = parseInt(process.env.PORT || '3001', 10)
const API_SECRET = process.env.API_SECRET || ''

// ─── Auth middleware ───
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers['x-api-secret'] || req.query.secret
  if (!API_SECRET) {
    // No secret configured — allow all (dev mode)
    return next()
  }
  if (token !== API_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

app.use(authMiddleware)

// ─── Request logging ───
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// ─── Health check (deep) ───
app.get('/health', async (_req, res) => {
  const { getActiveCount } = await import('./client')
  let dbOk = false
  try {
    const { data } = await supabase.from('whatsapp_connections').select('id', { count: 'exact', head: true })
    dbOk = true
  } catch { /* db down */ }
  res.json({ ok: dbOk, uptime: process.uptime(), activeConnections: getActiveCount(), db: dbOk })
})

// ─── GET /api/whatsapp?user_id=xxx ───
app.get('/api/whatsapp', async (req, res) => {
  const userId = req.query.user_id as string
  if (!userId) { res.status(400).json({ error: 'user_id required' }); return }

  const connected = isConnected(userId)
  const phoneNumber = getPhoneNumber(userId)
  const sessionExists = hasSession(userId)

  // Get message count from Supabase
  const { count } = await supabase
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  // Get DB connection record
  const { data: connection } = await supabase
    .from('whatsapp_connections')
    .select('id, phone_number, status, ai_enabled, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  res.json({
    connected,
    phoneNumber: phoneNumber || connection?.phone_number || null,
    sessionExists,
    connection: connected
      ? { ...connection, status: 'active' }
      : connection || null,
    messageCount: count || 0,
    aiEnabled: connection?.ai_enabled || false,
  })
})

// ─── POST /api/whatsapp ───
app.post('/api/whatsapp', async (req, res) => {
  const { user_id, action, phone_number } = req.body
  if (!user_id) { res.status(400).json({ error: 'user_id required' }); return }

  if (action !== 'connect') {
    res.status(400).json({ error: 'Invalid action. Use { action: "connect" }' })
    return
  }

  try {
    const result = await connectWhatsApp(user_id, phone_number || undefined)

    if (result.connected) {
      res.json({ connected: true, phoneNumber: result.phoneNumber })
      return
    }

    if (result.pairingCode) {
      res.json({ connected: false, pairing_code: result.pairingCode, phoneNumber: result.phoneNumber })
      return
    }

    if (result.qrCode) {
      const qrDataUrl = await QRCode.toDataURL(result.qrCode, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
      res.json({ connected: false, qr_data_url: qrDataUrl })
      return
    }

    res.json({ connected: false, error: 'No QR code generated' })
  } catch (err: any) {
    console.error('WhatsApp connect error:', err)
    res.status(500).json({ error: err.message || 'Failed to connect' })
  }
})

// ─── PATCH /api/whatsapp ───
app.patch('/api/whatsapp', async (req, res) => {
  const { user_id, ai_enabled } = req.body
  if (!user_id) { res.status(400).json({ error: 'user_id required' }); return }

  const updates: Record<string, any> = {}
  if (typeof ai_enabled === 'boolean') {
    updates.ai_enabled = ai_enabled
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No valid fields to update' })
    return
  }

  updates.updated_at = new Date().toISOString()

  const { error } = await supabase
    .from('whatsapp_connections')
    .update(updates)
    .eq('user_id', user_id)
    .eq('status', 'active')

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json({ ok: true, ...updates })
})

// ─── DELETE /api/whatsapp ───
app.delete('/api/whatsapp', async (req, res) => {
  const userId = req.query.user_id as string || req.body?.user_id
  if (!userId) { res.status(400).json({ error: 'user_id required' }); return }

  try {
    await disconnectWhatsApp(userId)
    res.json({ ok: true })
  } catch (err: any) {
    console.error('WhatsApp disconnect error:', err)
    res.status(500).json({ error: err.message || 'Failed to disconnect' })
  }
})

// ─── POST /api/send — send a message to user's self-chat ───
app.post('/api/send', async (req, res) => {
  const { user_id, message } = req.body
  if (!user_id || !message) { res.status(400).json({ error: 'user_id and message required' }); return }

  const { getConnection } = await import('./client')
  const sock = getConnection(user_id)
  if (!sock?.user) { res.status(400).json({ error: 'Not connected' }); return }

  const myLid = sock.user.lid?.split(':')[0]
  const myNumber = sock.user.id.split(':')[0]
  const selfJid = myLid ? `${myLid}@lid` : `${myNumber}@s.whatsapp.net`

  await sock.sendMessage(selfJid, { text: message })
  res.json({ ok: true })
})

// ─── POST /api/briefing — manual trigger ───
app.post('/api/briefing', async (req, res) => {
  const { user_id } = req.body
  if (!user_id) { res.status(400).json({ error: 'user_id required' }); return }

  try {
    const briefing = await triggerBriefingNow(user_id)
    if (!briefing) { res.status(500).json({ error: 'Failed to generate briefing' }); return }

    // Send via WhatsApp if connected
    const { getConnection } = await import('./client')
    const sock = getConnection(user_id)
    if (sock?.user) {
      const myLid = sock.user.lid?.split(':')[0]
      const myNumber = sock.user.id.split(':')[0]
      const selfJid = myLid ? `${myLid}@lid` : `${myNumber}@s.whatsapp.net`
      await sock.sendMessage(selfJid, { text: briefing })
    }

    res.json({ ok: true, briefing })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Start server ───
const server = app.listen(PORT, () => {
  console.log(`[WhatsApp Service] Running on port ${PORT}`)
  // Reconnect existing sessions on startup
  reconnectAllSessions().catch(console.error)
  // Start schedulers
  startMorningBriefingScheduler()
  startTravelScheduler()
})

// ─── Graceful shutdown ───
async function shutdown(signal: string) {
  console.log(`[WhatsApp Service] ${signal} received, shutting down...`)
  server.close()
  const { disconnectAll } = await import('./client')
  await disconnectAll()
  process.exit(0)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
