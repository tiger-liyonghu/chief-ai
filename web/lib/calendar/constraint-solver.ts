/**
 * Calendar Constraint Solver — 日历不是功能，是约束求解器
 *
 * Checks proposed time slots against:
 * 1. Family calendar (HARD constraint — cannot be overridden without explicit confirmation)
 * 2. Existing calendar events (SOFT constraint — warns but allows)
 * 3. Meeting fatigue (WARNING — 3+ meetings already that day)
 * 4. User energy patterns (WARNING — scheduling in low-energy periods)
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface ScheduleConstraint {
  type: 'hard' | 'soft'
  source: 'family' | 'calendar' | 'energy' | 'fatigue'
  label: string
  time_range?: { start: string; end: string }
}

export interface ConstraintCheckResult {
  ok: boolean                    // true if no hard constraints violated
  conflicts: ScheduleConstraint[] // hard + soft conflicts
  warnings: ScheduleConstraint[]  // non-blocking warnings
  summary: string                // human-readable summary for LLM/UI
}

function timeOverlaps(
  aStart: string | Date,
  aEnd: string | Date,
  bStart: string | Date,
  bEnd: string | Date,
): boolean {
  const as = new Date(aStart).getTime()
  const ae = new Date(aEnd).getTime()
  const bs = new Date(bStart).getTime()
  const be = new Date(bEnd).getTime()
  return as < be && bs < ae
}

export async function checkConstraints(
  admin: SupabaseClient,
  userId: string,
  proposedStart: string,
  proposedEnd: string,
): Promise<ConstraintCheckResult> {
  const date = proposedStart.slice(0, 10)

  const [calEvents, familyEvents, behaviorProfile] = await Promise.all([
    admin
      .from('calendar_events')
      .select('title, start_time, end_time')
      .eq('user_id', userId)
      .gte('start_time', `${date}T00:00:00`)
      .lte('start_time', `${date}T23:59:59`)
      .order('start_time', { ascending: true }),
    admin
      .from('family_calendar')
      .select('title, start_date, end_date, start_time, end_time, recurrence, recurrence_day, family_member')
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`start_date.eq.${date},and(start_date.lte.${date},end_date.gte.${date}),recurrence.neq.none`),
    admin
      .from('user_behavior_profile')
      .select('peak_hours, energy_pattern')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const conflicts: ScheduleConstraint[] = []
  const warnings: ScheduleConstraint[] = []

  // 1. Family conflicts = HARD constraint
  const todayDayOfWeek = new Date(date).getDay()
  for (const fe of familyEvents.data || []) {
    // Check if this family event applies today (handle recurrence)
    let appliesToday = false
    if (fe.recurrence === 'none') {
      appliesToday = fe.start_date === date || (fe.start_date <= date && fe.end_date && fe.end_date >= date)
    } else if (fe.recurrence === 'weekly' && fe.recurrence_day === todayDayOfWeek) {
      appliesToday = true
    } else if (fe.recurrence === 'daily') {
      appliesToday = true
    }
    if (!appliesToday) continue

    // If family event has specific times, check overlap
    if (fe.start_time) {
      const feStart = `${date}T${fe.start_time}`
      const feEnd = fe.end_time ? `${date}T${fe.end_time}` : `${date}T${fe.start_time}`
      if (timeOverlaps(proposedStart, proposedEnd, feStart, feEnd)) {
        const memberStr = fe.family_member ? ` (${fe.family_member})` : ''
        conflicts.push({
          type: 'hard',
          source: 'family',
          label: `家庭时间冲突: ${fe.title}${memberStr} @ ${fe.start_time}`,
          time_range: { start: feStart, end: feEnd },
        })
      }
    } else {
      // All-day family event — warn but don't block
      warnings.push({
        type: 'soft',
        source: 'family',
        label: `今天有家庭事件: ${fe.title} (全天)`,
      })
    }
  }

  // 2. Calendar conflicts = SOFT constraint
  for (const ce of calEvents.data || []) {
    if (timeOverlaps(proposedStart, proposedEnd, ce.start_time, ce.end_time)) {
      conflicts.push({
        type: 'soft',
        source: 'calendar',
        label: `已有会议: ${ce.title}`,
        time_range: { start: ce.start_time, end: ce.end_time },
      })
    }
  }

  // 3. Meeting fatigue = WARNING
  const existingCount = (calEvents.data || []).length
  if (existingCount >= 3) {
    warnings.push({
      type: 'soft',
      source: 'fatigue',
      label: `今天已有${existingCount}个会议，再加会导致会议疲劳`,
    })
  }

  // 4. Low energy period = WARNING
  const proposedHour = new Date(proposedStart).getHours()
  const profile = behaviorProfile.data
  if (profile?.energy_pattern?.lowest_energy_day !== undefined) {
    const dayOfWeek = new Date(proposedStart).getDay()
    if (dayOfWeek === profile.energy_pattern.lowest_energy_day) {
      warnings.push({
        type: 'soft',
        source: 'energy',
        label: `今天是你精力最低的一天，建议安排轻量会议`,
      })
    }
  }

  const hardConflicts = conflicts.filter(c => c.type === 'hard')
  const ok = hardConflicts.length === 0

  // Build summary
  const summaryParts: string[] = []
  if (hardConflicts.length > 0) {
    summaryParts.push(`⛔ 家庭时间冲突: ${hardConflicts.map(c => c.label).join('; ')}`)
  }
  if (conflicts.filter(c => c.type === 'soft').length > 0) {
    summaryParts.push(`⚠️ 日程冲突: ${conflicts.filter(c => c.type === 'soft').map(c => c.label).join('; ')}`)
  }
  if (warnings.length > 0) {
    summaryParts.push(warnings.map(w => `💡 ${w.label}`).join('; '))
  }

  return {
    ok,
    conflicts,
    warnings,
    summary: summaryParts.length > 0 ? summaryParts.join('\n') : '没有冲突',
  }
}
