/**
 * GET /api/calendar/suggest-time
 * Sophia's smart scheduling — find free time slots.
 *
 * Parameters:
 *   duration: number (minutes, default 60)
 *   date: string (YYYY-MM-DD, default today)
 *   prefer: 'morning' | 'afternoon' | 'any' (default 'any')
 *
 * Returns available slots, respecting:
 * - Existing calendar events
 * - Family hard constraints
 * - Working hours (8am-6pm)
 * - Minimum 30-min gaps between meetings
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface TimeSlot {
  start: string // HH:MM
  end: string   // HH:MM
  score: number // 0-1, higher = better
  reason: string
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const url = new URL(request.url)
  const duration = parseInt(url.searchParams.get('duration') || '60')
  const dateStr = url.searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const prefer = url.searchParams.get('prefer') || 'any'

  const dayOfWeek = new Date(dateStr).getDay()

  // Fetch all blockers for this day
  const [events, familyEvents] = await Promise.all([
    admin
      .from('calendar_events')
      .select('start_time, end_time')
      .eq('user_id', user.id)
      .gte('start_time', `${dateStr}T00:00:00`)
      .lte('start_time', `${dateStr}T23:59:59`)
      .order('start_time', { ascending: true }),
    admin
      .from('family_calendar')
      .select('start_time, end_time, event_type, recurrence, recurrence_day')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .or(`and(recurrence.eq.none,start_date.eq.${dateStr}),and(recurrence.eq.weekly,recurrence_day.eq.${dayOfWeek}),recurrence.eq.daily`),
  ])

  // Build blocked intervals [startMin, endMin] (minutes from midnight)
  const blocked: Array<[number, number]> = []

  for (const e of events.data || []) {
    const start = new Date(e.start_time)
    const end = new Date(e.end_time)
    blocked.push([start.getHours() * 60 + start.getMinutes(), end.getHours() * 60 + end.getMinutes()])
  }

  for (const fe of familyEvents.data || []) {
    if (fe.start_time && fe.end_time) {
      const [sh, sm] = fe.start_time.split(':').map(Number)
      const [eh, em] = fe.end_time.split(':').map(Number)
      blocked.push([sh * 60 + sm, eh * 60 + em])
    }
  }

  // Sort by start time
  blocked.sort((a, b) => a[0] - b[0])

  // Working hours: 8am-6pm (480-1080 minutes)
  const workStart = 480
  const workEnd = 1080
  const buffer = 15 // 15-min buffer around meetings

  // Find free slots
  const slots: TimeSlot[] = []
  let cursor = workStart

  for (const [bStart, bEnd] of blocked) {
    const effectiveStart = Math.max(bStart - buffer, workStart)
    const effectiveEnd = Math.min(bEnd + buffer, workEnd)

    if (cursor + duration <= effectiveStart) {
      // There's room before this blocked period
      const slotStart = cursor
      const slotEnd = slotStart + duration
      const h1 = Math.floor(slotStart / 60)
      const m1 = slotStart % 60
      const h2 = Math.floor(slotEnd / 60)
      const m2 = slotEnd % 60

      let score = 0.5
      if (prefer === 'morning' && h1 < 12) score = 0.9
      else if (prefer === 'afternoon' && h1 >= 12) score = 0.9
      if (h1 >= 9 && h1 <= 11) score += 0.1 // prime morning hours
      if (h1 >= 14 && h1 <= 16) score += 0.05 // prime afternoon

      slots.push({
        start: `${String(h1).padStart(2, '0')}:${String(m1).padStart(2, '0')}`,
        end: `${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}`,
        score: Math.min(score, 1),
        reason: `Free slot with ${Math.round((effectiveStart - cursor) / 60 * 10) / 10}h buffer before next event`,
      })
    }

    cursor = Math.max(cursor, effectiveEnd)
  }

  // Check after last blocked period
  if (cursor + duration <= workEnd) {
    const h1 = Math.floor(cursor / 60)
    const m1 = cursor % 60
    const h2 = Math.floor((cursor + duration) / 60)
    const m2 = (cursor + duration) % 60

    let score = 0.5
    if (prefer === 'morning' && h1 < 12) score = 0.8
    else if (prefer === 'afternoon' && h1 >= 12) score = 0.8

    slots.push({
      start: `${String(h1).padStart(2, '0')}:${String(m1).padStart(2, '0')}`,
      end: `${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}`,
      score,
      reason: 'Free slot after all events',
    })
  }

  // Sort by score (best first)
  slots.sort((a, b) => b.score - a.score)

  return NextResponse.json({
    date: dateStr,
    duration_minutes: duration,
    preference: prefer,
    available_slots: slots.slice(0, 5), // Top 5
    total_free_minutes: slots.reduce((sum, s) => {
      const [h1, m1] = s.start.split(':').map(Number)
      const [h2, m2] = s.end.split(':').map(Number)
      return sum + (h2 * 60 + m2) - (h1 * 60 + m1)
    }, 0),
  })
}
