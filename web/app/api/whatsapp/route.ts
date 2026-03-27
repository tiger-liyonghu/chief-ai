import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Dynamic imports for Baileys (not compatible with Vercel Edge/Serverless bundling)
async function getWhatsAppClient() {
  try {
    const mod = await import('@/lib/whatsapp/client')
    return mod
  } catch {
    return null
  }
}

async function getQRCode() {
  try {
    const mod = await import('qrcode')
    return mod.default || mod
  } catch {
    return null
  }
}

// Try reconnecting sessions (silently fail in serverless environments)
import('@/lib/whatsapp/reconnect')
  .then(m => m.reconnectAllSessions())
  .catch(() => {})

/**
 * GET /api/whatsapp
 * Return connection status for the current user.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wa = await getWhatsAppClient()
  const connected = wa ? wa.isConnected(user.id) : false
  const phoneNumber = wa ? wa.getPhoneNumber(user.id) : undefined
  const sessionExists = wa ? wa.hasSession(user.id) : false

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
    .select('id, phone_number, status, ai_enabled, created_at')
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
    aiEnabled: connection?.ai_enabled || false,
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
    const wa = await getWhatsAppClient()
    if (!wa) return NextResponse.json({ error: 'WhatsApp not available in this environment' }, { status: 503 })
    const result = await wa.connectWhatsApp(user.id, phoneNumber || undefined)

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
      const QRCode = await getQRCode()
      if (!QRCode) return NextResponse.json({ error: 'QR generation not available' }, { status: 503 })
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
 * PATCH /api/whatsapp
 * Update connection settings (e.g. ai_enabled toggle).
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const admin = createAdminClient()

  const updates: Record<string, any> = {}
  if (typeof body.ai_enabled === 'boolean') {
    updates.ai_enabled = body.ai_enabled
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const { error } = await admin
    .from('whatsapp_connections')
    .update(updates)
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...updates })
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
    const wa = await getWhatsAppClient()
    if (wa) await wa.disconnectWhatsApp(user.id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('WhatsApp disconnect error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to disconnect' },
      { status: 500 },
    )
  }
}
