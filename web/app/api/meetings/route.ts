import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch calendar events for the next 7 days
  const now = new Date()
  const sevenDaysLater = new Date(now.getTime() + 7 * 86400000)

  const { data: events, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', user.id)
    .gte('start_time', now.toISOString())
    .lte('start_time', sevenDaysLater.toISOString())
    .order('start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!events || events.length === 0) {
    return NextResponse.json([])
  }

  // Fetch existing briefs for these events
  const eventIds = events.map(e => e.id)
  const { data: briefs } = await supabase
    .from('meeting_briefs')
    .select('*')
    .eq('user_id', user.id)
    .in('event_id', eventIds)

  // Group briefs by event_id for fast lookup
  const briefsByEvent: Record<string, any[]> = {}
  for (const brief of briefs || []) {
    if (!briefsByEvent[brief.event_id]) {
      briefsByEvent[brief.event_id] = []
    }
    briefsByEvent[brief.event_id].push(brief)
  }

  // Attach briefs to events
  const result = events.map(event => ({
    ...event,
    attendees: typeof event.attendees === 'string'
      ? JSON.parse(event.attendees)
      : event.attendees || [],
    briefs: briefsByEvent[event.id] || null,
  }))

  return NextResponse.json(result)
}
