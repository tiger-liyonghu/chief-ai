import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  connectWhatsApp,
  disconnectWhatsApp,
  isConnected,
  getPhoneNumber,
  hasSession,
} from '@/lib/whatsapp/client'
import { reconnectAllSessions } from '@/lib/whatsapp/reconnect'
import QRCode from 'qrcode'

// Ensure saved sessions are reconnected when the server module loads
reconnectAllSessions().catch(console.error)

/**
 * GET /api/whatsapp
 * Return connection status for the current user.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connected = isConnected(user.id)
  const phoneNumber = getPhoneNumber(user.id)
  const sessionExists = hasSession(user.id)

  // Get message count
  let messageCount = 0
  const { count } = await supabase
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  messageCount = count || 0

  // Also get the DB connection record for the frontend
  const { data: connection } = await supabase
    .from('whatsapp_connections')
    .select('id, phone_number, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({
    connected,
    phoneNumber: phoneNumber || connection?.phone_number || null,
    sessionExists,
    connection: connected
      ? { ...connection, status: 'active' }
      : connection || null,
    messageCount,
  })
}

/**
 * POST /api/whatsapp
 * { action: 'connect', phone_number?: string } — Start connection.
 * If phone_number provided: uses pairing code (user enters code on phone).
 * If no phone_number: uses QR code scan.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const action = body?.action
  const phoneNumber = body?.phone_number

  if (action !== 'connect') {
    return NextResponse.json(
      { error: 'Invalid action. Use { action: "connect" }' },
      { status: 400 },
    )
  }

  try {
    const result = await connectWhatsApp(user.id, phoneNumber || undefined)

    if (result.connected) {
      return NextResponse.json({
        connected: true,
        phoneNumber: result.phoneNumber,
      })
    }

    // Phone number pairing code flow
    if (result.pairingCode) {
      return NextResponse.json({
        connected: false,
        pairing_code: result.pairingCode,
        phoneNumber: result.phoneNumber,
      })
    }

    // QR code flow
    if (result.qrCode) {
      const qrDataUrl = await QRCode.toDataURL(result.qrCode, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
      return NextResponse.json({
        connected: false,
        qr_data_url: qrDataUrl,
      })
    }

    return NextResponse.json({ connected: false, error: 'No QR code generated' })
  } catch (err: any) {
    console.error('WhatsApp connect error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to connect' },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/whatsapp
 * Disconnect and clear session.
 */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await disconnectWhatsApp(user.id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('WhatsApp disconnect error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to disconnect' },
      { status: 500 },
    )
  }
}
