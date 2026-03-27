import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/whatsapp/messages
 * Fetch WhatsApp messages for the current user
 *
 * Query params:
 *   ?from=phone_number  — filter by sender
 *   ?limit=50           — max messages (default 50, max 200)
 *   ?offset=0           — pagination offset
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searchParams = request.nextUrl.searchParams
  const fromNumber = searchParams.get('from')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  let query = supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('user_id', user.id)
    .order('received_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (fromNumber) {
    query = query.or(`from_number.eq.${fromNumber},to_number.eq.${fromNumber}`)
  }

  const { data: messages, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(messages || [])
}
