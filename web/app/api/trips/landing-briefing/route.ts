import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { LANDING_BRIEFING_SYSTEM, buildLandingBriefingPrompt } from '@/lib/ai/prompts/landing-briefing'

// Common timezone mappings for destination countries
const COUNTRY_TIMEZONES: Record<string, string> = {
  SG: 'Asia/Singapore',
  IN: 'Asia/Kolkata',
  US: 'America/New_York',
  GB: 'Europe/London',
  JP: 'Asia/Tokyo',
  CN: 'Asia/Shanghai',
  HK: 'Asia/Hong_Kong',
  AU: 'Australia/Sydney',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  AE: 'Asia/Dubai',
  TH: 'Asia/Bangkok',
  ID: 'Asia/Jakarta',
  MY: 'Asia/Kuala_Lumpur',
  PH: 'Asia/Manila',
  VN: 'Asia/Ho_Chi_Minh',
  KR: 'Asia/Seoul',
  TW: 'Asia/Taipei',
  NZ: 'Pacific/Auckland',
  CA: 'America/Toronto',
  NL: 'Europe/Amsterdam',
  CH: 'Europe/Zurich',
  IT: 'Europe/Rome',
  ES: 'Europe/Madrid',
  BR: 'America/Sao_Paulo',
  MX: 'America/Mexico_City',
  IL: 'Asia/Jerusalem',
  SA: 'Asia/Riyadh',
  QA: 'Asia/Qatar',
  LK: 'Asia/Colombo',
  BD: 'Asia/Dhaka',
  MM: 'Asia/Yangon',
  KH: 'Asia/Phnom_Penh',
  LA: 'Asia/Vientiane',
  NP: 'Asia/Kathmandu',
}

function getDestinationTimezone(country: string | null): string {
  if (!country) return 'UTC'
  return COUNTRY_TIMEZONES[country.toUpperCase()] || 'UTC'
}

function getTimezoneOffset(tz: string): string {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    })
    const parts = formatter.formatToParts(now)
    const tzPart = parts.find(p => p.type === 'timeZoneName')
    return tzPart?.value || tz
  } catch {
    return tz
  }
}

function getCurrentLocalTime(tz: string): string {
  try {
    return new Date().toLocaleString('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return new Date().toISOString()
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { trip_id } = await request.json()
    if (!trip_id) {
      return NextResponse.json({ error: 'trip_id is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Fetch trip details
    const { data: trip, error: tripError } = await admin
      .from('trips')
      .select('*')
      .eq('id', trip_id)
      .eq('user_id', user.id)
      .single()

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    // Determine timezones
    const homeTimezone = 'Asia/Singapore' // Default home timezone
    const destTimezone = getDestinationTimezone(trip.destination_country)
    const currentLocalTime = getCurrentLocalTime(destTimezone)
    const homeOffset = getTimezoneOffset(homeTimezone)
    const destOffset = getTimezoneOffset(destTimezone)

    // Fetch today's meetings at destination
    const today = new Date().toISOString().split('T')[0]
    const todayEnd = today + 'T23:59:59.999Z'
    const todayStart = today + 'T00:00:00.000Z'

    const { data: todayMeetings } = await admin
      .from('calendar_events')
      .select('id, title, start_time, end_time, location, meeting_link, attendees')
      .eq('user_id', user.id)
      .gte('start_time', todayStart)
      .lte('start_time', todayEnd)
      .order('start_time', { ascending: true })

    // Fetch emails since trip start (or last 24 hours, whichever is more recent)
    const tripStart = new Date(trip.start_date)
    const oneDayAgo = new Date()
    oneDayAgo.setHours(oneDayAgo.getHours() - 24)
    const emailsSince = tripStart > oneDayAgo ? tripStart : oneDayAgo

    const { data: emailsSinceDeparture } = await admin
      .from('emails')
      .select('id, from_name, from_address, subject, is_reply_needed, reply_urgency, received_at')
      .eq('user_id', user.id)
      .gte('received_at', emailsSince.toISOString())
      .order('received_at', { ascending: false })
      .limit(50)

    // Fetch pending tasks
    const { data: pendingTasks } = await admin
      .from('tasks')
      .select('id, title, priority, due_date, status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .limit(10)

    // Fetch follow-ups
    const { data: followUps } = await admin
      .from('follow_ups')
      .select('id, contact_name, contact_email, subject, due_date, type')
      .eq('user_id', user.id)
      .is('resolved_at', null)
      .order('due_date', { ascending: true })
      .limit(10)

    // Build prompt context
    const promptContext = buildLandingBriefingPrompt({
      destination_city: trip.destination_city,
      destination_country: trip.destination_country,
      trip_start: trip.start_date,
      trip_end: trip.end_date,
      home_timezone: homeTimezone,
      destination_timezone: destTimezone,
      todayMeetings: (todayMeetings || []).map(m => ({
        title: m.title,
        start_time: m.start_time,
        end_time: m.end_time,
        attendees: m.attendees,
        location: m.location,
      })),
      emailsSinceDeparture: (emailsSinceDeparture || []).map(e => ({
        from_name: e.from_name,
        from_address: e.from_address,
        subject: e.subject,
        is_reply_needed: e.is_reply_needed,
        reply_urgency: e.reply_urgency,
      })),
      pendingTasks: (pendingTasks || []).map(t => ({
        title: t.title,
        priority: t.priority,
        due_date: t.due_date,
      })),
      followUps: (followUps || []).map(f => ({
        contact_name: f.contact_name,
        contact_email: f.contact_email,
        subject: f.subject,
        due_date: f.due_date,
      })),
      currentLocalTime,
    })

    // Generate briefing with user's configured LLM
    const { client, model } = await createUserAIClient(user.id)
    const aiResponse = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: LANDING_BRIEFING_SYSTEM },
        { role: 'user', content: promptContext },
      ],
      temperature: 0.4,
    })

    const briefing = aiResponse.choices[0]?.message?.content || 'Unable to generate briefing.'

    // Find next meeting
    const nextMeeting = (todayMeetings || []).find(m => new Date(m.start_time) > new Date())

    // Count emails needing reply
    const emailsNeedingReply = (emailsSinceDeparture || []).filter(e => e.is_reply_needed).length

    return NextResponse.json({
      briefing,
      timezone_info: {
        home: homeTimezone,
        home_offset: homeOffset,
        destination: destTimezone,
        destination_offset: destOffset,
        current_local_time: currentLocalTime,
      },
      next_meeting: nextMeeting ? {
        title: nextMeeting.title,
        start_time: nextMeeting.start_time,
        location: nextMeeting.location,
      } : null,
      emails_since_departure: emailsSinceDeparture?.length || 0,
      emails_needing_reply: emailsNeedingReply,
      pending_tasks_count: pendingTasks?.length || 0,
    })
  } catch (error: any) {
    console.error('Landing briefing error:', error)
    return NextResponse.json({ error: error.message || 'Briefing generation failed' }, { status: 500 })
  }
}
