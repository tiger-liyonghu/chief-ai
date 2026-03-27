import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = request.nextUrl.searchParams
  const relationship = params.get('relationship')
  const importance = params.get('importance')
  const q = params.get('q')

  let query = supabase
    .from('contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('email_count', { ascending: false })
    .order('last_contact_at', { ascending: false, nullsFirst: false })

  if (relationship && relationship !== 'all') {
    query = query.eq('relationship', relationship)
  }

  if (importance) {
    query = query.eq('importance', importance)
  }

  if (q) {
    // Search across name, email, and company
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`)
  }

  const { data: contacts, error } = await query.limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(contacts || [])
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, relationship, importance, notes } = body

  if (!id) {
    return NextResponse.json({ error: 'Missing contact id' }, { status: 400 })
  }

  const updates: Record<string, any> = {
    auto_detected: false,
    updated_at: new Date().toISOString(),
  }

  if (relationship !== undefined) updates.relationship = relationship
  if (importance !== undefined) updates.importance = importance
  if (notes !== undefined) updates.notes = notes

  const { error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
