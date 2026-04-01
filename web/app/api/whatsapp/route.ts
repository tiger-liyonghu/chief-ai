import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import QRCode from 'qrcode'

// Allow up to 120 seconds for WhatsApp connection (pairing code flow needs user to type on phone)
export const maxDuration = 120

/**
 * GET /api/whatsapp — connection status
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { isConnected, getPhoneNumber, hasSession } = await import('@/lib/whatsapp/client')

  const connected = isConnected(user.id)
  const phoneNumber = getPhoneNumber(user.id)
  const sessionExists = hasSession(user.id)

  const adminClient = createAdminClient()

  // Get message count from Supabase
  const { count } = await adminClient
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Get DB connection record
  const { data: connection } = await adminClient
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
    messageCount: count || 0,
    aiEnabled: connection?.ai_enabled || false,
  })
}

/**
 * POST /api/whatsapp — connect
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action, phone_number } = body

  if (action !== 'connect') {
    return NextResponse.json({ error: 'Invalid action. Use { action: "connect" }' }, { status: 400 })
  }

  try {
    const { connectWhatsApp } = await import('@/lib/whatsapp/client')
    const result = await connectWhatsApp(user.id, phone_number || undefined)

    if (result.connected) {
      return NextResponse.json({ connected: true, phoneNumber: result.phoneNumber })
    }

    if (result.pairingCode) {
      return NextResponse.json({ connected: false, pairing_code: result.pairingCode, phoneNumber: result.phoneNumber })
    }

    if (result.qrCode) {
      const qrDataUrl = await QRCode.toDataURL(result.qrCode, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
      return NextResponse.json({ connected: false, qr_data_url: qrDataUrl })
    }

    return NextResponse.json({ connected: false, error: 'No QR code generated' })
  } catch (err: any) {
    console.error('WhatsApp connect error:', err)
    return NextResponse.json({ error: err.message || 'Failed to connect' }, { status: 500 })
  }
}

/**
 * PATCH /api/whatsapp — update settings
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { ai_enabled } = body

  const updates: Record<string, any> = {}
  if (typeof ai_enabled === 'boolean') {
    updates.ai_enabled = ai_enabled
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const adminClient = createAdminClient()
  const { error } = await adminClient
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
 * DELETE /api/whatsapp — disconnect
 */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { disconnectWhatsApp } = await import('@/lib/whatsapp/client')
    await disconnectWhatsApp(user.id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('WhatsApp disconnect error:', err)
    return NextResponse.json({ error: err.message || 'Failed to disconnect' }, { status: 500 })
  }
}
