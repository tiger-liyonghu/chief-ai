import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tripId = searchParams.get('trip_id')

  if (!tripId) return NextResponse.json({ error: 'trip_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('trip_timeline_events')
    .select('*, contacts(id, name, company, email)')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .order('event_time', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const { data, error } = await supabase
    .from('trip_timeline_events')
    .insert({
      trip_id: body.trip_id,
      user_id: user.id,
      event_time: body.event_time,
      end_time: body.end_time,
      all_day: body.all_day || false,
      type: body.type,
      title: body.title,
      details: body.details,
      location: body.location,
      location_lat: body.location_lat,
      location_lng: body.location_lng,
      contact_id: body.contact_id,
      commitment_id: body.commitment_id,
      calendar_event_id: body.calendar_event_id,
      metadata: body.metadata || {},
      is_auto_generated: body.is_auto_generated || false,
      is_confirmed: body.is_confirmed ?? true,
      status: body.status || 'scheduled',
      sort_order: body.sort_order,
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
    'event_time', 'end_time', 'all_day', 'type', 'title', 'details',
    'location', 'location_lat', 'location_lng', 'contact_id', 'commitment_id',
    'metadata', 'is_confirmed', 'status', 'delay_minutes', 'sort_order'
  ]

  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  const { data, error } = await supabase
    .from('trip_timeline_events')
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

  const { error } = await supabase
    .from('trip_timeline_events')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
