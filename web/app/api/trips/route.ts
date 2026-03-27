import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Auto-update trip statuses based on current date.
 * - today >= start_date && today <= end_date -> 'active'
 * - today > end_date -> 'completed'
 * - otherwise -> 'upcoming'
 */
async function autoUpdateTripStatuses(userId: string, trips: any[]) {
  const admin = createAdminClient()
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  for (const trip of trips) {
    const start = trip.start_date
    const end = trip.end_date

    let expectedStatus: string
    if (today > end) {
      expectedStatus = 'completed'
    } else if (today >= start && today <= end) {
      expectedStatus = 'active'
    } else {
      expectedStatus = 'upcoming'
    }

    if (trip.status !== expectedStatus) {
      await admin
        .from('trips')
        .update({ status: expectedStatus, updated_at: new Date().toISOString() })
        .eq('id', trip.id)
      trip.status = expectedStatus
    }
  }

  return trips
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: trips, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .order('start_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-update trip statuses based on dates
  await autoUpdateTripStatuses(user.id, trips || [])

  // Fetch expenses for each trip
  const tripIds = (trips || []).map(t => t.id)
  const { data: expenses } = tripIds.length > 0
    ? await supabase
        .from('trip_expenses')
        .select('*')
        .in('trip_id', tripIds)
        .order('expense_date', { ascending: true })
    : { data: [] }

  // Fetch calendar events that overlap with trip date ranges
  const { data: calendarEvents } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, end_time, location, meeting_link, attendees')
    .eq('user_id', user.id)
    .order('start_time', { ascending: true })

  // Enrich trips with expenses and meetings
  const enrichedTrips = (trips || []).map(trip => {
    const tripExpenses = (expenses || []).filter(e => e.trip_id === trip.id)
    const totalExpenses = tripExpenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount || 0), 0)

    // Find meetings during this trip
    const tripStart = new Date(trip.start_date)
    const tripEnd = new Date(trip.end_date)
    tripEnd.setHours(23, 59, 59) // Include the entire end date
    const meetings = (calendarEvents || []).filter(evt => {
      const evtDate = new Date(evt.start_time)
      return evtDate >= tripStart && evtDate <= tripEnd
    })

    return {
      ...trip,
      expenses: tripExpenses,
      total_expenses: totalExpenses,
      expense_currency: tripExpenses[0]?.currency || 'SGD',
      meetings_count: meetings.length,
      meetings,
    }
  })

  return NextResponse.json(enrichedTrips)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const { data: trip, error } = await supabase
    .from('trips')
    .insert({
      user_id: user.id,
      title: body.title,
      destination_city: body.destination_city || null,
      destination_country: body.destination_country || null,
      start_date: body.start_date,
      end_date: body.end_date,
      status: body.status || 'upcoming',
      flight_info: body.flight_info || [],
      hotel_info: body.hotel_info || [],
      notes: body.notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(trip)
}
