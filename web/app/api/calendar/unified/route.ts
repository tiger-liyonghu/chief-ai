/**
 * GET /api/calendar/unified
 * Sophia's Command View — all calendar layers in one response.
 *
 * Returns: work events + family events + commitment deadlines + trip days + conflicts
 * Each item has a `layer` field for color coding in the UI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface UnifiedEvent {
  id: string
  layer: 'work' | 'family' | 'commitment' | 'trip'
  title: string
  start_time: string
  end_time: string
  all_day: boolean
  location?: string
  attendees?: any[]
  meeting_link?: string
  // Layer-specific fields
  urgency?: number         // commitment urgency_score
  commitment_type?: string // i_promised / they_promised / family
  contact_name?: string
  family_member?: string
  event_type?: string      // hard_constraint / important_date / etc.
  trip_destination?: string
  is_conflict?: boolean
  conflict_with?: string
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const url = new URL(request.url)

  // Parse date range from query params (default: today to +14 days)
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const from = fromParam || todayStart.toISOString()
  const to = toParam || new Date(now.getTime() + 14 * 86400000).toISOString()
  const fromISO = from.slice(0, 10)
  const toISO = to.slice(0, 10)

  // Fetch all layers in parallel
  const [workEvents, familyEvents, commitments, trips] = await Promise.all([
    // Layer 1: Work calendar events
    admin
      .from('calendar_events')
      .select('id, title, start_time, end_time, location, attendees, meeting_link')
      .eq('user_id', user.id)
      .gte('end_time', from)
      .lte('start_time', to)
      .order('start_time', { ascending: true }),

    // Layer 2: Family events (expand recurring into date range)
    admin
      .from('family_calendar')
      .select('id, title, event_type, start_date, end_date, start_time, end_time, recurrence, recurrence_day, family_member')
      .eq('user_id', user.id)
      .eq('is_active', true),

    // Layer 3: Commitment deadlines
    admin
      .from('commitments')
      .select('id, type, contact_name, title, deadline, urgency_score, family_member')
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress', 'overdue'])
      .gte('deadline', fromISO)
      .lte('deadline', toISO)
      .order('urgency_score', { ascending: false }),

    // Layer 4: Trips
    admin
      .from('trips')
      .select('id, title, destination_city, start_date, end_date, status')
      .eq('user_id', user.id)
      .or(`and(start_date.lte.${toISO},end_date.gte.${fromISO})`),
  ])

  const unified: UnifiedEvent[] = []

  // 1. Work events
  for (const e of workEvents.data || []) {
    unified.push({
      id: e.id,
      layer: 'work',
      title: e.title,
      start_time: e.start_time,
      end_time: e.end_time,
      all_day: false,
      location: e.location,
      attendees: typeof e.attendees === 'string' ? JSON.parse(e.attendees) : e.attendees,
      meeting_link: e.meeting_link,
    })
  }

  // 2. Family events — expand recurring events into concrete dates
  const fromDate = new Date(fromISO)
  const toDate = new Date(toISO)

  for (const fe of familyEvents.data || []) {
    if (fe.recurrence === 'none') {
      // One-off: check if date falls in range
      if (fe.start_date >= fromISO && fe.start_date <= toISO) {
        unified.push({
          id: fe.id,
          layer: 'family',
          title: fe.title,
          start_time: fe.start_time ? `${fe.start_date}T${fe.start_time}` : `${fe.start_date}T00:00:00`,
          end_time: fe.end_time ? `${fe.start_date}T${fe.end_time}` : `${fe.start_date}T23:59:59`,
          all_day: !fe.start_time,
          family_member: fe.family_member,
          event_type: fe.event_type,
        })
      }
    } else if (fe.recurrence === 'weekly' && fe.recurrence_day != null) {
      // Weekly: generate instances for each matching day in range
      for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === fe.recurrence_day) {
          const dateStr = d.toISOString().slice(0, 10)
          unified.push({
            id: `${fe.id}-${dateStr}`,
            layer: 'family',
            title: fe.title,
            start_time: fe.start_time ? `${dateStr}T${fe.start_time}` : `${dateStr}T00:00:00`,
            end_time: fe.end_time ? `${dateStr}T${fe.end_time}` : `${dateStr}T23:59:59`,
            all_day: !fe.start_time,
            family_member: fe.family_member,
            event_type: fe.event_type,
          })
        }
      }
    } else if (fe.recurrence === 'daily') {
      // Daily: generate for weekdays only in range
      for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay()
        if (dow >= 1 && dow <= 5) { // weekdays
          const dateStr = d.toISOString().slice(0, 10)
          unified.push({
            id: `${fe.id}-${dateStr}`,
            layer: 'family',
            title: fe.title,
            start_time: fe.start_time ? `${dateStr}T${fe.start_time}` : `${dateStr}T00:00:00`,
            end_time: fe.end_time ? `${dateStr}T${fe.end_time}` : `${dateStr}T23:59:59`,
            all_day: !fe.start_time,
            family_member: fe.family_member,
            event_type: fe.event_type,
          })
        }
      }
    } else if (fe.recurrence === 'yearly') {
      // Yearly: check if this year's date falls in range
      const thisYear = new Date(fe.start_date)
      thisYear.setFullYear(now.getFullYear())
      const dateStr = thisYear.toISOString().slice(0, 10)
      if (dateStr >= fromISO && dateStr <= toISO) {
        unified.push({
          id: `${fe.id}-${dateStr}`,
          layer: 'family',
          title: fe.title,
          start_time: `${dateStr}T00:00:00`,
          end_time: `${dateStr}T23:59:59`,
          all_day: true,
          family_member: fe.family_member,
          event_type: fe.event_type,
        })
      }
    }
  }

  // 3. Commitment deadlines
  for (const c of commitments.data || []) {
    if (!c.deadline) continue
    unified.push({
      id: c.id,
      layer: 'commitment',
      title: `${c.type === 'i_promised' ? '📤' : c.type === 'they_promised' ? '📥' : '💗'} ${c.title}`,
      start_time: `${c.deadline}T00:00:00`,
      end_time: `${c.deadline}T23:59:59`,
      all_day: true,
      urgency: c.urgency_score,
      commitment_type: c.type,
      contact_name: c.contact_name,
      family_member: c.family_member,
    })
  }

  // 4. Trip spans
  for (const t of trips.data || []) {
    unified.push({
      id: t.id,
      layer: 'trip',
      title: `✈️ ${t.destination_city || t.title}`,
      start_time: `${t.start_date}T00:00:00`,
      end_time: `${t.end_date}T23:59:59`,
      all_day: true,
      trip_destination: t.destination_city,
    })
  }

  // 5. Detect conflicts (timed work events vs timed family hard constraints)
  // Only compare events with specific times — skip all-day events to avoid false positives
  const familyHardTimed = unified.filter(e =>
    e.layer === 'family' && e.event_type === 'hard_constraint' && !e.all_day
  )
  const workTimed = unified.filter(e =>
    e.layer === 'work' && !e.all_day
  )

  for (const fe of familyHardTimed) {
    for (const we of workTimed) {
      // Only compare events on the same day
      const feDate = fe.start_time.slice(0, 10)
      const weDate = we.start_time.slice(0, 10)
      if (feDate !== weDate) continue

      // Time overlap check
      if (fe.start_time < we.end_time && we.start_time < fe.end_time) {
        we.is_conflict = true
        we.conflict_with = fe.title
        fe.is_conflict = true
        fe.conflict_with = we.title
      }
    }
  }

  // Sort by start_time
  unified.sort((a, b) => a.start_time.localeCompare(b.start_time))

  // Summary for Sophia
  const summary = {
    total: unified.length,
    work: unified.filter(e => e.layer === 'work').length,
    family: unified.filter(e => e.layer === 'family').length,
    commitments: unified.filter(e => e.layer === 'commitment').length,
    trips: unified.filter(e => e.layer === 'trip').length,
    conflicts: unified.filter(e => e.is_conflict).length,
  }

  return NextResponse.json({ events: unified, summary })
}
