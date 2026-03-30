import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/trip-timeline/auto-generate
 * Auto-generates timeline events for a trip:
 * - Flight events from flight_info JSONB
 * - Hotel check-in / check-out from hotel_info JSONB
 * - Meeting events from calendar_events overlapping the trip
 * - Transport estimates between sequential locations
 * - Free-time gaps between events
 * Also detects family_calendar conflicts and writes them to trips.family_conflicts.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const tripId = body.trip_id
  if (!tripId) return NextResponse.json({ error: 'trip_id required' }, { status: 400 })

  // ── 1. Load the trip ──────────────────────────────────────────────────
  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .single()

  if (tripErr || !trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  const tripStart = trip.start_date as string   // "2026-04-10"
  const tripEnd = trip.end_date as string       // "2026-04-13"
  const tripStartDt = new Date(`${tripStart}T00:00:00`)
  const tripEndDt = new Date(`${tripEnd}T23:59:59`)

  // ── 2. Load existing auto-generated events (for dedup) ────────────────
  const { data: existingEvents } = await supabase
    .from('trip_timeline_events')
    .select('id, type, title, event_time, calendar_event_id, metadata')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .eq('is_auto_generated', true)

  const existing = existingEvents || []

  // Helper: check if an event with same type + time already exists
  function isDuplicate(type: string, eventTime: string, calendarEventId?: string): boolean {
    return existing.some(e => {
      if (calendarEventId && e.calendar_event_id === calendarEventId) return true
      return e.type === type && e.event_time === eventTime
    })
  }

  const newEvents: Array<Record<string, unknown>> = []
  let sortOrder = 0

  // ── 3. Flight events from flight_info JSONB ───────────────────────────
  const flights = Array.isArray(trip.flight_info) ? trip.flight_info : []
  for (const flight of flights) {
    // Departure event
    if (flight.departure_time && !isDuplicate('flight', flight.departure_time)) {
      newEvents.push({
        trip_id: tripId,
        user_id: user.id,
        type: 'flight',
        title: `${flight.airline || 'Flight'} ${flight.flight_number || ''} — ${flight.origin || ''} → ${flight.destination || ''}`.trim(),
        event_time: flight.departure_time,
        end_time: flight.arrival_time || null,
        location: flight.origin || null,
        details: `${flight.airline || ''} ${flight.flight_number || ''} ${flight.origin || ''}→${flight.destination || ''}`.trim(),
        metadata: {
          source: 'flight_info',
          flight_number: flight.flight_number,
          airline: flight.airline,
          origin: flight.origin,
          destination: flight.destination,
          terminal: flight.terminal,
          gate: flight.gate,
          seat: flight.seat,
          booking_ref: flight.booking_ref,
          direction: flight.direction || 'outbound',
        },
        is_auto_generated: true,
        is_confirmed: true,
        status: 'scheduled',
        sort_order: sortOrder++,
      })
    }
  }

  // ── 4. Hotel check-in / check-out from hotel_info JSONB ───────────────
  const hotels = Array.isArray(trip.hotel_info) ? trip.hotel_info : []
  for (const hotel of hotels) {
    const hotelName = hotel.name || hotel.hotel_name || 'Hotel'
    const checkinTime = hotel.checkin_time || `${hotel.checkin_date || tripStart}T15:00:00`
    const checkoutTime = hotel.checkout_time || `${hotel.checkout_date || tripEnd}T11:00:00`

    if (!isDuplicate('hotel_checkin', checkinTime)) {
      newEvents.push({
        trip_id: tripId,
        user_id: user.id,
        type: 'hotel_checkin',
        title: `Check in — ${hotelName}`,
        event_time: checkinTime,
        location: hotel.address || hotelName,
        location_lat: hotel.lat || null,
        location_lng: hotel.lng || null,
        details: `${hotelName}${hotel.confirmation ? ' — Ref: ' + hotel.confirmation : ''}`,
        metadata: {
          source: 'hotel_info',
          hotel_name: hotelName,
          confirmation: hotel.confirmation || hotel.booking_ref,
          room_type: hotel.room_type,
          address: hotel.address,
        },
        is_auto_generated: true,
        is_confirmed: true,
        status: 'scheduled',
        sort_order: sortOrder++,
      })
    }

    if (!isDuplicate('hotel_checkout', checkoutTime)) {
      newEvents.push({
        trip_id: tripId,
        user_id: user.id,
        type: 'hotel_checkout',
        title: `Check out — ${hotelName}`,
        event_time: checkoutTime,
        location: hotel.address || hotelName,
        details: `${hotelName}`,
        metadata: {
          source: 'hotel_info',
          hotel_name: hotelName,
          confirmation: hotel.confirmation || hotel.booking_ref,
        },
        is_auto_generated: true,
        is_confirmed: true,
        status: 'scheduled',
        sort_order: sortOrder++,
      })
    }
  }

  // ── 5. Meeting events from calendar_events ────────────────────────────
  const { data: calendarEvents } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, end_time, location, meeting_link, attendees, description')
    .eq('user_id', user.id)
    .gte('start_time', `${tripStart}T00:00:00`)
    .lte('start_time', `${tripEnd}T23:59:59`)
    .order('start_time', { ascending: true })

  for (const evt of calendarEvents || []) {
    if (isDuplicate('meeting', evt.start_time, evt.id)) continue

    newEvents.push({
      trip_id: tripId,
      user_id: user.id,
      type: 'meeting',
      title: evt.title,
      event_time: evt.start_time,
      end_time: evt.end_time,
      location: evt.location || null,
      calendar_event_id: evt.id,
      details: {
        meeting_link: evt.meeting_link,
        attendees: evt.attendees,
        description: evt.description,
      },
      metadata: { source: 'calendar' },
      is_auto_generated: true,
      is_confirmed: true,
      status: 'scheduled',
      sort_order: sortOrder++,
    })
  }

  // ── 6. Insert all new events ──────────────────────────────────────────
  let inserted: any[] = []
  if (newEvents.length > 0) {
    const { data, error: insertErr } = await supabase
      .from('trip_timeline_events')
      .insert(newEvents)
      .select()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }
    inserted = data || []
  }

  // ── 7. Re-read all events to build transport + free-time gaps ─────────
  const { data: allEvents } = await supabase
    .from('trip_timeline_events')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .order('event_time', { ascending: true })
    .order('sort_order', { ascending: true })

  const timeline = allEvents || []
  const gapEvents: Array<Record<string, unknown>> = []

  for (let i = 0; i < timeline.length - 1; i++) {
    const current = timeline[i]
    const next = timeline[i + 1]

    const currentEnd = current.end_time || current.event_time
    const gapStartDt = new Date(currentEnd)
    const gapEndDt = new Date(next.event_time)
    const gapMinutes = (gapEndDt.getTime() - gapStartDt.getTime()) / 60000

    if (gapMinutes <= 0) continue

    // If both events have different locations, add a transport estimate
    const fromLoc = current.location
    const toLoc = next.location
    const hasLocationChange = fromLoc && toLoc && fromLoc !== toLoc

    if (hasLocationChange && gapMinutes >= 15) {
      const transportTime = `${gapStartDt.toISOString()}`
      if (!isDuplicate('transport', transportTime)) {
        // Estimate 30-45 min for city transport
        const estimatedMinutes = Math.min(Math.max(30, Math.round(gapMinutes * 0.4)), 90)
        gapEvents.push({
          trip_id: tripId,
          user_id: user.id,
          type: 'transport',
          title: `Travel: ${fromLoc} → ${toLoc}`,
          event_time: transportTime,
          end_time: new Date(gapStartDt.getTime() + estimatedMinutes * 60000).toISOString(),
          location: fromLoc,
          details: {
            from: fromLoc,
            to: toLoc,
            estimated_minutes: estimatedMinutes,
          },
          metadata: { source: 'auto_gap' },
          is_auto_generated: true,
          is_confirmed: false,
          status: 'tentative',
          sort_order: sortOrder++,
        })
      }
    }

    // If gap is 60+ minutes and no location change, mark as free time
    if (gapMinutes >= 60 && !hasLocationChange) {
      const freeTimeStart = gapStartDt.toISOString()
      if (!isDuplicate('free_time', freeTimeStart)) {
        gapEvents.push({
          trip_id: tripId,
          user_id: user.id,
          type: 'free_time',
          title: `Free time (${Math.round(gapMinutes)} min)`,
          event_time: freeTimeStart,
          end_time: gapEndDt.toISOString(),
          details: { duration_minutes: Math.round(gapMinutes) },
          metadata: { source: 'auto_gap' },
          is_auto_generated: true,
          is_confirmed: false,
          status: 'tentative',
          sort_order: sortOrder++,
        })
      }
    }
  }

  // Insert gap events (transport + free_time)
  if (gapEvents.length > 0) {
    const { data: gapInserted, error: gapErr } = await supabase
      .from('trip_timeline_events')
      .insert(gapEvents)
      .select()

    if (!gapErr && gapInserted) {
      inserted = [...inserted, ...gapInserted]
    }
  }

  // ── 8. Detect family calendar conflicts ───────────────────────────────
  const { data: familyEvents } = await supabase
    .from('family_calendar')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const familyConflicts: Array<Record<string, unknown>> = []

  for (const fEvent of familyEvents || []) {
    let isConflict = false
    let conflictType = ''

    // Check if family event overlaps with trip dates
    if (fEvent.start_date && fEvent.start_date <= tripEnd && (!fEvent.end_date || fEvent.end_date >= tripStart)) {
      if (fEvent.event_type === 'hard_constraint') {
        isConflict = true
        conflictType = 'hard_constraint'
      } else if (fEvent.event_type === 'important_date') {
        isConflict = true
        conflictType = 'important_date'
      } else if (fEvent.event_type === 'school_cycle') {
        isConflict = true
        conflictType = 'advisory'
      } else if (fEvent.event_type === 'family_commitment') {
        isConflict = true
        conflictType = 'family_commitment'
      }
    }

    // Check weekly recurring events
    if (fEvent.recurrence === 'weekly' && fEvent.recurrence_day != null) {
      // Check if any day in the trip range falls on the recurring day
      const cursor = new Date(tripStartDt)
      while (cursor <= tripEndDt) {
        if (cursor.getDay() === fEvent.recurrence_day) {
          isConflict = true
          conflictType = 'recurring_weekly'
          break
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    }

    // Check yearly recurring (birthdays, anniversaries)
    if (fEvent.recurrence === 'yearly' && fEvent.start_date) {
      const fMonth = new Date(fEvent.start_date).getMonth()
      const fDay = new Date(fEvent.start_date).getDate()
      const cursor = new Date(tripStartDt)
      while (cursor <= tripEndDt) {
        if (cursor.getMonth() === fMonth && cursor.getDate() === fDay) {
          isConflict = true
          conflictType = 'important_date'
          break
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    }

    if (isConflict) {
      familyConflicts.push({
        family_event_id: fEvent.id,
        title: fEvent.title,
        event_type: fEvent.event_type,
        conflict_type: conflictType,
        family_member: fEvent.family_member,
        start_date: fEvent.start_date,
        end_date: fEvent.end_date,
      })
    }
  }

  // Write conflicts back to the trip record
  if (familyConflicts.length > 0) {
    await supabase
      .from('trips')
      .update({ family_conflicts: familyConflicts })
      .eq('id', tripId)
      .eq('user_id', user.id)
  } else {
    await supabase
      .from('trips')
      .update({ family_conflicts: null })
      .eq('id', tripId)
      .eq('user_id', user.id)
  }

  return NextResponse.json({
    trip_id: tripId,
    events_created: inserted.length,
    events_existing: existing.length,
    family_conflicts: familyConflicts,
    timeline_total: (timeline.length || 0) + gapEvents.length,
  })
}
