/**
 * Alert detection engine — reusable across API route, chat context, and briefing.
 *
 * Each detector queries Supabase for a specific pattern and returns typed Alert objects.
 * The top-level `detectAlerts` function runs all detectors in parallel and returns a
 * severity-sorted, deduplicated list with a summary.
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'high' | 'medium' | 'low'

export type AlertType =
  | 'calendar_conflict'
  | 'transit_impossible'
  | 'overdue_reply'
  | 'overdue_commitment'
  | 'meeting_fatigue'
  | 'stale_urgent_task'
  | 'commitment_chain_break'
  | 'pre_trip_unfinished'
  | 'vip_silence'
  | 'family_work_conflict'

export interface Alert {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  detail: string
  created_at: string
  /** Related entity IDs for downstream actions */
  refs?: string[]
}

export interface AlertResult {
  alerts: Alert[]
  summary: { high: number; medium: number; low: number; total: number }
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function uid(type: string, ...parts: string[]): string {
  return `${type}::${parts.join('::')}`.replace(/\s+/g, '_').slice(0, 128)
}

function fmtTime(iso: string, tz = 'Asia/Singapore'): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: tz,
  })
}

function fmtDate(iso: string, tz = 'Asia/Singapore'): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: tz,
  })
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000)
}

function hoursBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 3_600_000)
}

// ────────────────────────────────────────────────────────────────────────────
// Individual detectors
// ────────────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string
  title: string
  start_time: string
  end_time: string
  location?: string | null
}

/**
 * Fetch events for today + next 7 days (shared across calendar-related detectors).
 */
async function fetchUpcomingEvents(
  db: SupabaseClient,
  userId: string,
): Promise<CalendarEvent[]> {
  const now = new Date()
  const weekLater = new Date(now.getTime() + 7 * 86_400_000)

  const { data } = await db
    .from('calendar_events')
    .select('id, title, start_time, end_time, location')
    .eq('user_id', userId)
    .gte('start_time', now.toISOString().slice(0, 10) + 'T00:00:00')
    .lte('start_time', weekLater.toISOString())
    .order('start_time', { ascending: true })

  return (data || []) as CalendarEvent[]
}

/** Group events by calendar date (YYYY-MM-DD in SGT). */
function groupByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    const dateKey = new Date(e.start_time).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Singapore',
    }) // YYYY-MM-DD
    if (!map.has(dateKey)) map.set(dateKey, [])
    map.get(dateKey)!.push(e)
  }
  return map
}

function rangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const sA = new Date(startA).getTime()
  const eA = new Date(endA).getTime()
  const sB = new Date(startB).getTime()
  const eB = new Date(endB).getTime()
  return sA < eB && sB < eA
}

// 1. Calendar conflicts
function detectCalendarConflicts(events: CalendarEvent[]): Alert[] {
  const alerts: Alert[] = []
  const byDate = groupByDate(events)

  for (const [, dayEvents] of byDate) {
    for (let i = 0; i < dayEvents.length; i++) {
      for (let j = i + 1; j < dayEvents.length; j++) {
        const a = dayEvents[i]
        const b = dayEvents[j]
        if (rangesOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) {
          alerts.push({
            id: uid('calendar_conflict', a.id, b.id),
            type: 'calendar_conflict',
            severity: 'high',
            title: 'Meeting conflict',
            detail: `"${a.title}" (${fmtTime(a.start_time)}-${fmtTime(a.end_time)}) overlaps with "${b.title}" (${fmtTime(b.start_time)}-${fmtTime(b.end_time)}) on ${fmtDate(a.start_time)}.`,
            created_at: new Date().toISOString(),
            refs: [a.id, b.id],
          })
        }
      }
    }
  }
  return alerts
}

// 2. Transit impossible
function detectTransitImpossible(events: CalendarEvent[]): Alert[] {
  const alerts: Alert[] = []
  const byDate = groupByDate(events)

  for (const [, dayEvents] of byDate) {
    const withLocation = dayEvents.filter((e) => e.location)
    for (let i = 0; i < withLocation.length - 1; i++) {
      const a = withLocation[i]
      const b = withLocation[i + 1]
      if (
        a.location!.toLowerCase().trim() ===
        b.location!.toLowerCase().trim()
      )
        continue
      const endA = new Date(a.end_time).getTime()
      const startB = new Date(b.start_time).getTime()
      const gapMin = Math.round((startB - endA) / 60_000)
      if (gapMin > 0 && gapMin < 15) {
        alerts.push({
          id: uid('transit_impossible', a.id, b.id),
          type: 'transit_impossible',
          severity: 'high',
          title: 'Not enough travel time',
          detail: `Only ${gapMin} min between "${a.title}" @ ${a.location} (ends ${fmtTime(a.end_time)}) and "${b.title}" @ ${b.location} (starts ${fmtTime(b.start_time)}).`,
          created_at: new Date().toISOString(),
          refs: [a.id, b.id],
        })
      }
    }
  }
  return alerts
}

// 3. Meeting fatigue (3+ back-to-back with < 15 min gap)
function detectMeetingFatigue(events: CalendarEvent[]): Alert[] {
  const alerts: Alert[] = []
  const byDate = groupByDate(events)

  for (const [, dayEvents] of byDate) {
    if (dayEvents.length < 3) continue
    let streak: CalendarEvent[] = [dayEvents[0]]

    for (let i = 1; i < dayEvents.length; i++) {
      const prevEnd = new Date(dayEvents[i - 1].end_time).getTime()
      const curStart = new Date(dayEvents[i].start_time).getTime()
      const gap = Math.round((curStart - prevEnd) / 60_000)
      if (gap < 15) {
        streak.push(dayEvents[i])
      } else {
        if (streak.length >= 3) emitFatigueAlert(streak, alerts)
        streak = [dayEvents[i]]
      }
    }
    if (streak.length >= 3) emitFatigueAlert(streak, alerts)
  }
  return alerts
}

function emitFatigueAlert(streak: CalendarEvent[], alerts: Alert[]) {
  const first = streak[0]
  const last = streak[streak.length - 1]
  alerts.push({
    id: uid(
      'meeting_fatigue',
      first.start_time.slice(0, 10),
      first.id,
    ),
    type: 'meeting_fatigue',
    severity: 'low',
    title: 'No break between meetings',
    detail: `You have ${streak.length} back-to-back meetings from ${fmtTime(first.start_time)} to ${fmtTime(last.end_time)} on ${fmtDate(first.start_time)}. Consider adding a break.`,
    created_at: new Date().toISOString(),
    refs: streak.map((e) => e.id),
  })
}

// 4. Overdue email replies
async function detectOverdueReplies(
  db: SupabaseClient,
  userId: string,
): Promise<Alert[]> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 3_600_000).toISOString()

  const { data: emails } = await db
    .from('emails')
    .select('id, from_name, from_address, subject, received_at')
    .eq('user_id', userId)
    .eq('is_reply_needed', true)
    .lt('received_at', twentyFourHoursAgo)
    .order('received_at', { ascending: true })
    .limit(10)

  return (emails || []).map((e: any) => {
    const hours = hoursBetween(new Date(), new Date(e.received_at))
    const days = Math.floor(hours / 24)
    const ageLabel = days > 0 ? `${days} day${days > 1 ? 's' : ''}` : `${hours} hours`
    const sender = e.from_name || e.from_address || 'Unknown'
    return {
      id: uid('overdue_reply', e.id),
      type: 'overdue_reply' as AlertType,
      severity: 'medium' as AlertSeverity,
      title: `Email waiting ${ageLabel}`,
      detail: `Email from ${sender} about "${e.subject || '(no subject)'}" received ${ageLabel} ago, still no reply.`,
      created_at: new Date().toISOString(),
      refs: [e.id],
    }
  })
}

// 5. Overdue commitments (follow-ups past due)
async function detectOverdueCommitments(
  db: SupabaseClient,
  userId: string,
): Promise<Alert[]> {
  const todayISO = new Date().toISOString().slice(0, 10)

  const { data: followUps } = await db
    .from('follow_ups')
    .select('id, contact_name, contact_email, subject, commitment_text, due_date')
    .eq('user_id', userId)
    .eq('status', 'active')
    .lt('due_date', todayISO)
    .order('due_date', { ascending: true })
    .limit(10)

  return (followUps || []).map((f: any) => {
    const days = daysBetween(new Date(), new Date(f.due_date))
    const who = f.contact_name || f.contact_email || 'someone'
    const what = f.commitment_text || f.subject || 'a commitment'
    return {
      id: uid('overdue_commitment', f.id),
      type: 'overdue_commitment' as AlertType,
      severity: 'high' as AlertSeverity,
      title: 'Promise overdue',
      detail: `You promised ${who} to "${what}" by ${fmtDate(f.due_date)}. It's now ${days} day${days > 1 ? 's' : ''} late.`,
      created_at: new Date().toISOString(),
      refs: [f.id],
    }
  })
}

// 6. Stale urgent tasks (priority 1, pending > 48 hours)
async function detectStaleUrgentTasks(
  db: SupabaseClient,
  userId: string,
): Promise<Alert[]> {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 3_600_000).toISOString()

  const { data: tasks } = await db
    .from('tasks')
    .select('id, title, created_at')
    .eq('user_id', userId)
    .eq('priority', 1)
    .eq('status', 'pending')
    .lt('created_at', fortyEightHoursAgo)
    .order('created_at', { ascending: true })
    .limit(10)

  return (tasks || []).map((t: any) => {
    const days = daysBetween(new Date(), new Date(t.created_at))
    return {
      id: uid('stale_urgent_task', t.id),
      type: 'stale_urgent_task' as AlertType,
      severity: 'medium' as AlertSeverity,
      title: 'Urgent task aging',
      detail: `"${t.title}" has been urgent for ${days} day${days > 1 ? 's' : ''} without progress.`,
      created_at: new Date().toISOString(),
      refs: [t.id],
    }
  })
}

// ────────────────────────────────────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

// ── New Detectors (Sophia Eyes upgrade) ──

async function detectCommitmentChainBreak(
  db: SupabaseClient,
  userId: string,
): Promise<Alert[]> {
  // Find commitments that are blocked by other overdue commitments
  const { data } = await db
    .from('commitments')
    .select('id, title, contact_name, description, deadline')
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress'])
    .not('description', 'is', null)

  const alerts: Alert[] = []
  for (const c of data || []) {
    if (c.description && /依赖|blocked|等.*先/.test(c.description)) {
      alerts.push({
        id: uid('chain_break', c.id),
        type: 'commitment_chain_break',
        severity: 'high',
        title: `承诺链断裂：${c.title}`,
        detail: `${c.contact_name || '?'} 的「${c.title}」可能被阻塞（${c.description.slice(0, 80)}）`,
        created_at: new Date().toISOString(),
        refs: [c.id],
      })
    }
  }
  return alerts
}

async function detectPreTripUnfinished(
  db: SupabaseClient,
  userId: string,
): Promise<Alert[]> {
  const threeDaysLater = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  const todayISO = new Date().toISOString().slice(0, 10)

  // Find trips starting within 3 days
  const { data: trips } = await db
    .from('trips')
    .select('id, title, destination_city, start_date')
    .eq('user_id', userId)
    .in('status', ['upcoming', 'pre_trip'])
    .lte('start_date', threeDaysLater)
    .gte('start_date', todayISO)

  if (!trips || trips.length === 0) return []

  // Find overdue/pending commitments due before trip starts
  const alerts: Alert[] = []
  for (const trip of trips) {
    const { data: commitments } = await db
      .from('commitments')
      .select('title, contact_name, deadline')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress', 'overdue'])
      .lte('deadline', trip.start_date)
      .limit(3)

    if (commitments && commitments.length > 0) {
      alerts.push({
        id: uid('pre_trip', trip.id),
        type: 'pre_trip_unfinished',
        severity: 'high',
        title: `出差前有 ${commitments.length} 件事未完成`,
        detail: `${trip.destination_city || trip.title} 出差 ${trip.start_date} 前：${commitments.map(c => c.title).join('、')}`,
        created_at: new Date().toISOString(),
        refs: [trip.id],
      })
    }
  }
  return alerts
}

async function detectVipSilence(
  db: SupabaseClient,
  userId: string,
): Promise<Alert[]> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString()

  const { data: coldVips } = await db
    .from('contacts')
    .select('id, name, company, last_contact_at')
    .eq('user_id', userId)
    .in('importance', ['vip', 'high'])
    .lt('last_contact_at', fourteenDaysAgo)
    .limit(3)

  return (coldVips || []).map(v => {
    const days = daysBetween(new Date(), new Date(v.last_contact_at))
    return {
      id: uid('vip_silence', v.id),
      type: 'vip_silence' as AlertType,
      severity: 'medium' as AlertSeverity,
      title: `${v.name} 已 ${days} 天没联系`,
      detail: `${v.name} (${v.company || 'VIP'}) 上次联系是 ${fmtDate(v.last_contact_at)}，可能需要跟进`,
      created_at: new Date().toISOString(),
      refs: [v.id],
    }
  })
}

export async function detectAlerts(
  db: SupabaseClient,
  userId: string,
): Promise<AlertResult> {
  // Fetch events once (used by 3 detectors)
  const events = await fetchUpcomingEvents(db, userId)

  // Run all detectors in parallel
  const [
    calendarConflicts,
    transitImpossible,
    meetingFatigue,
    overdueReplies,
    overdueCommitments,
    staleUrgentTasks,
    chainBreaks,
    preTripAlerts,
    vipSilence,
  ] = await Promise.all([
    Promise.resolve(detectCalendarConflicts(events)),
    Promise.resolve(detectTransitImpossible(events)),
    Promise.resolve(detectMeetingFatigue(events)),
    detectOverdueReplies(db, userId),
    detectOverdueCommitments(db, userId),
    detectStaleUrgentTasks(db, userId),
    detectCommitmentChainBreak(db, userId),
    detectPreTripUnfinished(db, userId),
    detectVipSilence(db, userId),
  ])

  const allAlerts = [
    ...calendarConflicts,
    ...transitImpossible,
    ...meetingFatigue,
    ...overdueReplies,
    ...overdueCommitments,
    ...staleUrgentTasks,
    ...chainBreaks,
    ...preTripAlerts,
    ...vipSilence,
  ]

  // Sort: high first, then by most recent
  allAlerts.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sevDiff !== 0) return sevDiff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const summary = {
    high: allAlerts.filter((a) => a.severity === 'high').length,
    medium: allAlerts.filter((a) => a.severity === 'medium').length,
    low: allAlerts.filter((a) => a.severity === 'low').length,
    total: allAlerts.length,
  }

  return { alerts: allAlerts, summary }
}

/**
 * Format alerts as a plain-text block suitable for inclusion in an LLM system prompt.
 */
export function formatAlertsForPrompt(result: AlertResult): string {
  if (result.alerts.length === 0) return 'No issues detected.'

  const lines = result.alerts.map(
    (a) => `- [${a.severity.toUpperCase()}] ${a.title}: ${a.detail}`,
  )

  return `DETECTED ISSUES (${result.summary.total} total — ${result.summary.high} high, ${result.summary.medium} medium, ${result.summary.low} low):\n${lines.join('\n')}`
}
