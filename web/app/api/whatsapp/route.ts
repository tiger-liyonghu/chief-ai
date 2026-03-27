import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const WA_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || ''
const WA_API_SECRET = process.env.WHATSAPP_API_SECRET || ''

/**
 * Proxy helper — forwards requests to the standalone WhatsApp service on Railway.
 */
async function proxyToService(
  path: string,
  method: string,
  body?: Record<string, any>,
): Promise<Response> {
  if (!WA_SERVICE_URL) {
    return NextResponse.json(
      { error: 'WhatsApp service not configured' },
      { status: 503 },
    )
  }

  const url = `${WA_SERVICE_URL}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (WA_API_SECRET) {
    headers['x-api-secret'] = WA_API_SECRET
  }

  const res = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

/**
 * GET /api/whatsapp — connection status
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return proxyToService(`/api/whatsapp?user_id=${user.id}`, 'GET')
}

/**
 * POST /api/whatsapp — connect
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  return proxyToService('/api/whatsapp', 'POST', {
    ...body,
    user_id: user.id,
  })
}

/**
 * PATCH /api/whatsapp — update settings
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  return proxyToService('/api/whatsapp', 'PATCH', {
    ...body,
    user_id: user.id,
  })
}

/**
 * DELETE /api/whatsapp — disconnect
 */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return proxyToService(`/api/whatsapp?user_id=${user.id}`, 'DELETE', {
    user_id: user.id,
  })
}
