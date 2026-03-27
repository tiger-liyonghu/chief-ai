import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { TRANSPORT_SYSTEM, TRANSPORT_USER } from '@/lib/ai/prompts/transport'

interface CalendarEvent {
  id: string
  title: string
  start_time: string
  end_time: string
  location?: string | null
}

interface TransportEstimate {
  travel_minutes: number
  transport_mode: 'walk' | 'mrt' | 'taxi'
  estimated_cost_sgd: string
  route_summary: string
  google_maps_directions_url: string
}

function getStatus(gapMinutes: number, travelMinutes: number): 'plenty_of_time' | 'tight' | 'warning' {
  const buffer = gapMinutes - travelMinutes
  if (buffer >= 30) return 'plenty_of_time'
  if (buffer >= 10) return 'tight'
  return 'warning'
}

function formatTimeHHMM(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Singapore' })
}

function formatTimeDisplay(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Singapore' })
}

async function estimateTransport(
  fromLocation: string,
  toLocation: string,
  departureTime: string,
  gapMinutes: number,
  aiClient?: OpenAI,
  aiModel?: string,
): Promise<TransportEstimate> {
  try {
    const client = aiClient || (await import('@/lib/ai/unified-client')).systemAIClient
    const model = aiModel || 'deepseek-chat'
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: TRANSPORT_SYSTEM },
        { role: 'user', content: TRANSPORT_USER({ from_location: fromLocation, to_location: toLocation, departure_time: departureTime, gap_minutes: gapMinutes }) },
      ],
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Empty AI response')

    return JSON.parse(content) as TransportEstimate
  } catch (err) {
    // Fallback: rough estimate without AI
    const encodedFrom = encodeURIComponent(fromLocation)
    const encodedTo = encodeURIComponent(toLocation)
    return {
      travel_minutes: 30,
      transport_mode: 'taxi',
      estimated_cost_sgd: 'S$15-25',
      route_summary: `${fromLocation} to ${toLocation} (estimate)`,
      google_maps_directions_url: `https://www.google.com/maps/dir/?api=1&origin=${encodedFrom}&destination=${encodedTo}&travelmode=driving`,
    }
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  // Fetch today's events
  const { data: todayEvents, error: todayError } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', user.id)
    .gte('start_time', todayStart.toISOString())
    .lte('start_time', todayEnd.toISOString())
    .order('start_time', { ascending: true })

  if (todayError) return NextResponse.json({ error: todayError.message }, { status: 500 })

  // Fetch tomorrow's events for alarm suggestion
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  const tomorrowEnd = new Date(todayEnd)
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)

  const { data: tomorrowEvents } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', user.id)
    .gte('start_time', tomorrowStart.toISOString())
    .lte('start_time', tomorrowEnd.toISOString())
    .order('start_time', { ascending: true })
    .limit(1)

  const events: CalendarEvent[] = todayEvents || []
  const { client: aiClient, model: aiModel } = await createUserAIClient(user.id)

  // ─── Transport cards between consecutive events with locations ────────
  const transport_cards = []
  const eventsWithLocation = events.filter(e => e.location)

  for (let i = 0; i < eventsWithLocation.length - 1; i++) {
    const eventA = eventsWithLocation[i]
    const eventB = eventsWithLocation[i + 1]

    if (!eventA.location || !eventB.location) continue
    // Skip if same location
    if (eventA.location.toLowerCase().trim() === eventB.location.toLowerCase().trim()) continue

    const endA = new Date(eventA.end_time)
    const startB = new Date(eventB.start_time)
    const gapMinutes = Math.round((startB.getTime() - endA.getTime()) / 60000)

    if (gapMinutes <= 0) continue // overlapping events

    const estimate = await estimateTransport(
      eventA.location,
      eventB.location,
      formatTimeHHMM(endA),
      gapMinutes,
      aiClient,
      aiModel,
    )

    const suggestedDeparture = new Date(startB.getTime() - (estimate.travel_minutes + 15) * 60000)

    transport_cards.push({
      from_event: {
        title: eventA.title,
        end_time: eventA.end_time,
        location: eventA.location,
      },
      to_event: {
        title: eventB.title,
        start_time: eventB.start_time,
        location: eventB.location,
      },
      gap_minutes: gapMinutes,
      estimated_travel_minutes: estimate.travel_minutes,
      transport_mode: estimate.transport_mode,
      estimated_cost: estimate.estimated_cost_sgd,
      suggested_departure: formatTimeDisplay(suggestedDeparture),
      google_maps_url: estimate.google_maps_directions_url,
      route_summary: estimate.route_summary,
      status: getStatus(gapMinutes, estimate.travel_minutes),
    })
  }

  // ─── Alarm suggestion for tomorrow's first meeting ────────────────────
  let alarm_suggestion = null
  const firstTomorrow = (tomorrowEvents || [])[0] as CalendarEvent | undefined
  if (firstTomorrow) {
    const meetingTime = new Date(firstTomorrow.start_time)
    let commuteMinutes = 30 // default commute estimate

    if (firstTomorrow.location) {
      try {
        const est = await estimateTransport('Home', firstTomorrow.location, formatTimeHHMM(meetingTime), 120, aiClient, aiModel)
        commuteMinutes = est.travel_minutes
      } catch {}
    }

    // Alarm = meeting time - commute - 60 min (get ready)
    const alarmTime = new Date(meetingTime.getTime() - (commuteMinutes + 60) * 60000)

    alarm_suggestion = {
      first_meeting_time: formatTimeDisplay(meetingTime),
      first_meeting_title: firstTomorrow.title,
      first_meeting_location: firstTomorrow.location || 'No location specified',
      suggested_alarm: formatTimeDisplay(alarmTime),
      commute_estimate: `${commuteMinutes} minutes`,
    }
  }

  // ─── Upcoming departure reminder (next event with location) ───────────
  let upcoming_reminder = null
  const futureEvents = events.filter(e => new Date(e.start_time) > now && e.location)

  if (futureEvents.length > 0) {
    const nextEvent = futureEvents[0]
    const startTime = new Date(nextEvent.start_time)

    // Find matching transport card or estimate
    let travelMinutes = 30
    const matchingCard = transport_cards.find(c => c.to_event.start_time === nextEvent.start_time)
    if (matchingCard) {
      travelMinutes = matchingCard.estimated_travel_minutes
    }

    const departBy = new Date(startTime.getTime() - (travelMinutes + 15) * 60000)
    const minutesUntilDepart = Math.round((departBy.getTime() - now.getTime()) / 60000)

    upcoming_reminder = {
      next_event_title: nextEvent.title,
      next_event_time: formatTimeDisplay(startTime),
      next_event_location: nextEvent.location,
      minutes_until_depart: Math.max(0, minutesUntilDepart),
      depart_by: formatTimeDisplay(departBy),
      address: nextEvent.location,
    }
  }

  return NextResponse.json({
    transport_cards,
    alarm_suggestion,
    upcoming_reminder,
  })
}
