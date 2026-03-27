import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/trips/pre-flight?trip_id=xxx
 *
 * "Reply Before You Fly" — returns emails that need reply and
 * urgent tasks due before or during the trip.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tripId = request.nextUrl.searchParams.get('trip_id')
  if (!tripId) {
    return NextResponse.json({ error: 'trip_id is required' }, { status: 400 })
  }

  // Fetch the trip
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .single()

  if (tripError || !trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  const tripStartDate = trip.start_date // YYYY-MM-DD
  const tripEndDate = trip.end_date     // YYYY-MM-DD

  // Fetch emails that need reply and were received before the trip starts
  const { data: emails } = await supabase
    .from('emails')
    .select('id, from_name, from_address, subject, snippet, received_at, reply_urgency, source_account_email, thread_id')
    .eq('user_id', user.id)
    .eq('is_reply_needed', true)
    .lt('received_at', tripStartDate + 'T23:59:59Z')
    .order('reply_urgency', { ascending: false })
    .order('received_at', { ascending: false })
    .limit(20)

  // Fetch urgent tasks (priority 1-2) due before or during the trip
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, priority, due_date, due_reason, source_account_email, status')
    .eq('user_id', user.id)
    .neq('status', 'done')
    .lte('priority', 2)
    .order('priority', { ascending: true })
    .order('due_date', { ascending: true })
    .limit(20)

  // Filter tasks: those with due_date before trip end, or no due_date but high priority
  const relevantTasks = (tasks || []).filter(task => {
    if (!task.due_date) return task.priority === 1
    return task.due_date <= tripEndDate
  })

  return NextResponse.json({
    trip: {
      id: trip.id,
      title: trip.title,
      destination_city: trip.destination_city,
      destination_country: trip.destination_country,
      start_date: trip.start_date,
      end_date: trip.end_date,
      status: trip.status,
    },
    emails: emails || [],
    tasks: relevantTasks,
  })
}
