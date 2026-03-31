import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { searchParams } = new URL(req.url)
  const eventType = searchParams.get('type')  // hard_constraint | important_date | school_cycle | family_commitment

  let query = admin
    .from('family_calendar')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (eventType) query = query.eq('event_type', eventType)

  query = query
    .order('start_date', { ascending: true })
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

  const { data, error } = await supabase
    .from('family_calendar')
    .insert({
      user_id: user.id,
      event_type: body.event_type || 'important_date',
      title: body.title,
      description: body.description,
      start_date: body.start_date,
      end_date: body.end_date,
      start_time: body.start_time,
      end_time: body.end_time,
      recurrence: body.recurrence || 'none',
      recurrence_day: body.recurrence_day,
      recurrence_month: body.recurrence_month,
      recurrence_until: body.recurrence_until,
      family_member: body.family_member,
      source: body.source || 'manual',
      google_event_id: body.google_event_id,
      google_calendar_id: body.google_calendar_id,
      remind_days_before: body.remind_days_before ?? 1,
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
    'event_type', 'title', 'description', 'start_date', 'end_date',
    'start_time', 'end_time', 'recurrence', 'recurrence_day', 'recurrence_month',
    'recurrence_until', 'family_member', 'is_active', 'remind_days_before'
  ]

  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  const { data, error } = await supabase
    .from('family_calendar')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Soft delete
  const { error } = await supabase
    .from('family_calendar')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
