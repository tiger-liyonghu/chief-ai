import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET: Check today's family conflicts with work calendar
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)
  const dayOfWeek = now.getDay()

  // Get today's family hard constraints
  const { data: familyEvents } = await admin
    .from('family_calendar')
    .select('title, start_time, end_time, event_type, recurrence, recurrence_day, family_member')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('event_type', 'hard_constraint')

  // Get today's work events
  const { data: workEvents } = await admin
    .from('calendar_events')
    .select('title, start_time, end_time')
    .eq('user_id', user.id)
    .gte('start_time', `${todayISO}T00:00:00`)
    .lte('start_time', `${todayISO}T23:59:59`)

  const conflicts: Array<{ family_event: string; work_event: string; family_member?: string }> = []

  for (const fe of familyEvents || []) {
    // Check if this family event applies today
    let appliesToday = false
    if (fe.recurrence === 'weekly' && fe.recurrence_day === dayOfWeek) appliesToday = true
    if (fe.recurrence === 'daily') appliesToday = true
    if (fe.recurrence === 'none') appliesToday = true // one-off events already filtered by query

    if (!appliesToday || !fe.start_time) continue

    // Check time overlap with work events
    for (const we of workEvents || []) {
      const weStart = new Date(we.start_time).toTimeString().slice(0, 5)
      const weEnd = new Date(we.end_time).toTimeString().slice(0, 5)
      if (fe.start_time < weEnd && weStart < (fe.end_time || fe.start_time)) {
        conflicts.push({
          family_event: fe.title,
          work_event: we.title,
          family_member: fe.family_member || undefined,
        })
      }
    }
  }

  return NextResponse.json({
    date: todayISO,
    has_conflicts: conflicts.length > 0,
    conflicts,
  })
}

// POST: Check if a proposed date/time conflicts with family calendar
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const body = await req.json()
  const { date, start_time, end_time } = body
  // date: "2026-04-03", start_time: "14:00", end_time: "15:30"

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  // Get all active family events
  const { data: events } = await admin
    .from('family_calendar')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const conflicts: Array<{
    event: typeof events extends (infer T)[] | null ? T : never
    conflict_type: string
  }> = []

  const checkDate = new Date(date)
  const dayOfWeek = checkDate.getDay() // 0=Sun..6=Sat

  for (const event of events || []) {
    let isConflict = false
    let conflictType = ''

    // Check recurring events
    if (event.recurrence === 'weekly' && event.recurrence_day === dayOfWeek) {
      // Check time overlap if times are specified
      if (event.start_time && start_time) {
        if ((!end_time || event.start_time < end_time) && (!event.end_time || start_time < event.end_time)) {
          isConflict = true
          conflictType = 'time_overlap'
        }
      } else {
        isConflict = true
        conflictType = 'day_conflict'
      }
    }

    // Check date range events (school_cycle, etc)
    // Skip for recurring events — they're handled by the recurrence checks above/below
    if (event.recurrence === 'none' && event.start_date <= date && (!event.end_date || event.end_date >= date)) {
      if (event.event_type === 'hard_constraint') {
        isConflict = true
        conflictType = 'hard_constraint'
      } else if (event.event_type === 'important_date') {
        isConflict = true
        conflictType = 'important_date'
      } else if (event.event_type === 'school_cycle') {
        isConflict = true
        conflictType = 'advisory'
      } else if (event.event_type === 'family_commitment') {
        isConflict = true
        conflictType = 'family_commitment'
      }
    }

    // Check date range for school cycles (they span multiple weeks, recurrence=none but cover a range)
    if (event.event_type === 'school_cycle' && event.start_date <= date && event.end_date && event.end_date >= date) {
      isConflict = true
      conflictType = 'advisory'
    }

    // Check yearly recurring (birthdays, anniversaries)
    if (event.recurrence === 'yearly') {
      const eventMonth = new Date(event.start_date).getMonth()
      const eventDay = new Date(event.start_date).getDate()
      if (checkDate.getMonth() === eventMonth && checkDate.getDate() === eventDay) {
        isConflict = true
        conflictType = 'important_date'
      }
    }

    if (isConflict) {
      conflicts.push({ event, conflict_type: conflictType })
    }
  }

  return NextResponse.json({
    date,
    has_conflicts: conflicts.length > 0,
    has_hard_conflicts: conflicts.some(c => c.conflict_type === 'hard_constraint' || c.conflict_type === 'time_overlap'),
    conflicts,
  })
}
