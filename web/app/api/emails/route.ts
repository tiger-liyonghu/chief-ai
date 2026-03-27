import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Optional filter: ?account=email@example.com
  const accountFilter = request.nextUrl.searchParams.get('account')

  let query = supabase
    .from('emails')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_reply_needed', true)
    .order('reply_urgency', { ascending: false })
    .order('received_at', { ascending: false })
    .limit(50)

  if (accountFilter) {
    query = query.eq('source_account_email', accountFilter)
  }

  const { data: emails, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(emails || [])
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, is_reply_needed } = await request.json()

  if (!id || typeof is_reply_needed !== 'boolean') {
    return NextResponse.json({ error: 'Missing id or is_reply_needed' }, { status: 400 })
  }

  const { error } = await supabase
    .from('emails')
    .update({ is_reply_needed })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
