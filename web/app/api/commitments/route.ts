import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')       // i_promised | they_promised | family
  const status = searchParams.get('status')   // pending | in_progress | waiting | done | overdue
  const view = searchParams.get('view')       // 'active' (default) | 'all' | 'done'

  let query = supabase
    .from('commitments')
    .select('*, contacts(id, name, company, email, importance)')
    .eq('user_id', user.id)

  if (type) query = query.eq('type', type)

  if (view === 'done') {
    query = query.eq('status', 'done').order('completed_at', { ascending: false }).limit(20)
  } else if (view === 'all') {
    // no status filter
  } else {
    // active view: everything that's not done or cancelled
    query = query.in('status', ['pending', 'in_progress', 'waiting', 'overdue'])
  }

  if (status) query = query.eq('status', status)

  query = query
    .order('urgency_score', { ascending: false })
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Dedup check: skip if similar active commitment exists
  if (body.title) {
    const { data: existing } = await supabase
      .from('commitments')
      .select('id, title')
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress', 'waiting', 'overdue'])

    const isDupe = (existing || []).some(c =>
      c.title.toLowerCase().trim() === body.title.toLowerCase().trim()
    )
    if (isDupe) {
      return NextResponse.json({ error: 'Similar commitment already exists', duplicate: true }, { status: 409 })
    }
  }

  const { data, error } = await supabase
    .from('commitments')
    .insert({
      user_id: user.id,
      type: body.type || 'i_promised',
      contact_id: body.contact_id,
      contact_name: body.contact_name,
      contact_email: body.contact_email,
      family_member: body.family_member,
      title: body.title,
      description: body.description,
      source_type: body.source_type || 'manual',
      source_ref: body.source_ref,
      source_email_id: body.source_email_id,
      deadline: body.deadline,
      deadline_fuzzy: body.deadline_fuzzy,
      urgency_score: body.urgency_score || 0,
      confidence: body.confidence,
      status: body.status || 'pending',
      trip_id: body.trip_id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  const allowedFields = [
    'type', 'contact_id', 'contact_name', 'contact_email', 'family_member',
    'title', 'description', 'deadline', 'deadline_fuzzy', 'urgency_score',
    'status', 'last_nudge_at', 'snoozed_until', 'trip_id'
  ]

  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  // Auto-set completed_at when status changes to done
  if (body.status === 'done' && !body.completed_at) {
    updates.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('commitments')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
