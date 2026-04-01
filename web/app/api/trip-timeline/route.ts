import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Aggregate timeline from structured tables (trip_flights, trip_hotels, etc.)
 * Falls back to legacy trip_timeline_events for manually created events.
 */
async function aggregateTimeline(admin: ReturnType<typeof createAdminClient>, tripId: string, userId: string) {
  const timeline: Array<{
    id: string
    event_time: string
    end_time: string | null
    type: string
    title: string
    details: string | null
    location: string | null
    contact_id: string | null
    status: string
    delay_minutes: number | null
    metadata: Record<string, unknown>
    sort_order: number | null
    source_table: string
  }> = []

  // 1. Flights
  const { data: flights } = await admin
    .from('trip_flights')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .order('departure_at', { ascending: true })

  for (const f of flights || []) {
    if (f.departure_at) {
      timeline.push({
        id: f.id,
        event_time: f.departure_at,
        end_time: f.arrival_at,
        type: 'flight',
        title: `${f.airline || ''} ${f.flight_number || ''} ${f.origin_airport || ''} → ${f.dest_airport || ''}`.trim(),
        details: [f.cabin_class, f.seat_number ? `Seat ${f.seat_number}` : null, f.booking_ref ? `Ref: ${f.booking_ref}` : null].filter(Boolean).join(' · ') || null,
        location: f.terminal_departure ? `Terminal ${f.terminal_departure}` : null,
        contact_id: null,
        status: f.status === 'completed' ? 'completed' : f.status === 'cancelled' ? 'cancelled' : f.status === 'delayed' ? 'delayed' : 'scheduled',
        delay_minutes: null,
        metadata: { airline: f.airline, flight_number: f.flight_number, seat: f.seat_number, terminal: f.terminal_departure, gate: null, lounge: f.lounge_access, baggage: f.baggage_allowance, ff_program: f.ff_program },
        sort_order: f.leg_order,
        source_table: 'trip_flights',
      })
    }
  }

  // 2. Hotels — checkin + checkout as separate events
  const { data: hotels } = await admin
    .from('trip_hotels')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .order('checkin_at', { ascending: true })

  for (const h of hotels || []) {
    if (h.checkin_at) {
      timeline.push({
        id: `${h.id}-checkin`,
        event_time: h.checkin_at,
        end_time: null,
        type: 'hotel_checkin',
        title: `Check in: ${h.name}`,
        details: [h.room_type, h.bed_type, h.booking_ref ? `Ref: ${h.booking_ref}` : null, h.breakfast_included ? 'Breakfast included' : null].filter(Boolean).join(' · ') || null,
        location: h.address,
        contact_id: null,
        status: h.status === 'checked_in' || h.status === 'checked_out' ? 'completed' : 'scheduled',
        delay_minutes: null,
        metadata: { hotel_name: h.name, confirmation: h.booking_ref, address: h.address, room_type: h.room_type, loyalty: h.loyalty_program, late_checkout: h.late_checkout, wifi: h.wifi_info },
        sort_order: h.leg_order,
        source_table: 'trip_hotels',
      })
    }
    if (h.checkout_at) {
      timeline.push({
        id: `${h.id}-checkout`,
        event_time: h.checkout_at,
        end_time: null,
        type: 'hotel_checkout',
        title: `Check out: ${h.name}`,
        details: h.late_checkout === 'confirmed' ? 'Late checkout confirmed' : null,
        location: h.address,
        contact_id: null,
        status: h.status === 'checked_out' ? 'completed' : 'scheduled',
        delay_minutes: null,
        metadata: { hotel_name: h.name },
        sort_order: (h.leg_order || 0) + 1000,
        source_table: 'trip_hotels',
      })
    }
  }

  // 3. Transports
  const { data: transports } = await admin
    .from('trip_transports')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .order('pickup_at', { ascending: true })

  for (const t of transports || []) {
    if (t.pickup_at) {
      timeline.push({
        id: t.id,
        event_time: t.pickup_at,
        end_time: null,
        type: 'transport',
        title: `${t.mode === 'airport_transfer' ? 'Airport Transfer' : t.provider || t.mode || 'Transport'}: ${t.pickup_location || ''} → ${t.dropoff_location || ''}`.trim(),
        details: [t.driver_name, t.driver_phone, t.vehicle_info, t.estimated_duration].filter(Boolean).join(' · ') || null,
        location: t.pickup_location,
        contact_id: null,
        status: 'scheduled',
        delay_minutes: null,
        metadata: { mode: t.mode, driver: t.driver_name, phone: t.driver_phone, vehicle: t.vehicle_info, est_duration: t.estimated_duration },
        sort_order: t.leg_order,
        source_table: 'trip_transports',
      })
    }
  }

  // 4. Meetings
  const { data: meetings } = await admin
    .from('trip_meetings')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .order('start_at', { ascending: true })

  for (const m of meetings || []) {
    if (m.start_at) {
      timeline.push({
        id: m.id,
        event_time: m.start_at,
        end_time: m.end_at,
        type: 'meeting',
        title: m.title,
        details: [m.host_name ? `with ${m.host_name}` : null, m.host_title, m.objectives].filter(Boolean).join(' · ') || null,
        location: m.location,
        contact_id: null,
        status: m.status === 'completed' ? 'completed' : m.status === 'cancelled' ? 'cancelled' : 'scheduled',
        delay_minutes: null,
        metadata: { meeting_type: m.meeting_type, host: m.host_name, host_title: m.host_title, company: null, prep_notes: m.brief, dress_code: m.dress_code, cultural_notes: m.cultural_notes, gift: m.gift, attendees: m.attendees },
        sort_order: null,
        source_table: 'trip_meetings',
      })
    }
  }

  // 5. Dinners
  const { data: dinners } = await admin
    .from('trip_dinners')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .order('start_at', { ascending: true })

  for (const d of dinners || []) {
    if (d.start_at) {
      timeline.push({
        id: d.id,
        event_time: d.start_at,
        end_time: null,
        type: 'meal',
        title: d.restaurant_name || 'Business Dinner',
        details: [d.cuisine, d.host ? `Host: ${d.host}` : null, d.price_range, d.dietary_notes].filter(Boolean).join(' · ') || null,
        location: d.address,
        contact_id: null,
        status: d.status === 'completed' ? 'completed' : 'scheduled',
        delay_minutes: null,
        metadata: { restaurant: d.restaurant_name, cuisine: d.cuisine, dietary_notes: d.dietary_notes, is_business: true, purpose: d.purpose, formality: d.formality, reservation: d.reservation_ref, private_room: d.private_room, etiquette: d.etiquette_notes, guests: d.guests },
        sort_order: null,
        source_table: 'trip_dinners',
      })
    }
  }

  // 6. Legacy: trip_timeline_events (manually created events, reminders, deadlines)
  const { data: legacyEvents } = await admin
    .from('trip_timeline_events')
    .select('*, contacts(id, name, company, email)')
    .eq('trip_id', tripId)
    .eq('user_id', userId)

  for (const e of legacyEvents || []) {
    // Skip types that are now in structured tables (avoid duplicates)
    // Only keep: free_time, reminder, deadline, and any manually created events
    if (['free_time', 'reminder', 'deadline'].includes(e.type) || !e.is_auto_generated) {
      timeline.push({
        id: e.id,
        event_time: e.event_time,
        end_time: e.end_time,
        type: e.type,
        title: e.title,
        details: e.details,
        location: e.location,
        contact_id: e.contact_id,
        status: e.status,
        delay_minutes: e.delay_minutes,
        metadata: e.metadata || {},
        sort_order: e.sort_order,
        source_table: 'trip_timeline_events',
        ...(e.contacts ? { contacts: e.contacts } : {}),
      })
    }
  }

  // Sort by time
  timeline.sort((a, b) => {
    const ta = new Date(a.event_time).getTime()
    const tb = new Date(b.event_time).getTime()
    if (ta !== tb) return ta - tb
    return (a.sort_order || 0) - (b.sort_order || 0)
  })

  return timeline
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tripId = searchParams.get('trip_id')

  if (!tripId) return NextResponse.json({ error: 'trip_id required' }, { status: 400 })

  const admin = createAdminClient()
  const timeline = await aggregateTimeline(admin, tripId, user.id)

  return NextResponse.json(timeline)
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
