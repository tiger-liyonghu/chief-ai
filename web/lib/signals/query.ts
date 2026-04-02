/**
 * Unified signal query layer.
 *
 * All Agents and features should read data through these functions
 * instead of querying emails/whatsapp_messages/calendar_events directly.
 *
 * Benefits:
 * - New channels (Telegram, Slack) only need changes here
 * - Consistent filtering, sorting, and limits
 * - Single place to optimize query performance
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { calculateTemperature, type TemperatureResult } from '@/lib/contacts/temperature'

type DbClient = ReturnType<typeof createAdminClient>

// ─── Types ───

export interface Signal {
  id: string
  channel: 'email' | 'whatsapp' | 'calendar'
  direction: 'inbound' | 'outbound'
  senderEmail: string
  senderName: string
  timestamp: Date
  title: string
  preview: string
  metadata?: Record<string, any>
}

export interface OverdueCommitment {
  id: string
  type: 'i_promised' | 'waiting_on_them'
  title: string
  deadline: string | null
  contactEmail: string
  contactName: string
  daysOverdue: number
  confidence: number
  confidenceLabel: string
}

export interface CoolingContact {
  id: string
  email: string
  name: string
  company: string | null
  importance: string
  roles: string[]
  daysSinceContact: number
  temperature: TemperatureResult
}

export interface UnrepliedEmail {
  id: string
  from: string
  fromName: string
  subject: string
  receivedAt: Date
  daysSince: number
}

export interface CalendarConflict {
  event1: { id: string; title: string; startTime: Date; endTime: Date }
  event2: { id: string; title: string; startTime: Date; endTime: Date }
  overlapMinutes: number
  involvesFamilyEvent: boolean
}

// ─── Queries ───

/**
 * Get overdue commitments for a user.
 */
export async function getOverdueCommitments(
  db: DbClient,
  userId: string,
): Promise<OverdueCommitment[]> {
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await db
    .from('commitments')
    .select('id, type, title, deadline, contact_email, confidence, confidence_label, status')
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress', 'overdue'])
    .not('deadline', 'is', null)
    .lte('deadline', today)
    .order('deadline', { ascending: true })

  if (!data) return []

  return data.map(c => {
    const daysOverdue = c.deadline
      ? Math.ceil((Date.now() - new Date(c.deadline).getTime()) / 86400000)
      : 0

    return {
      id: c.id,
      type: c.type,
      title: c.title,
      deadline: c.deadline,
      contactEmail: c.contact_email || '',
      contactName: '', // will be enriched by caller if needed
      daysOverdue,
      confidence: c.confidence || 0,
      confidenceLabel: c.confidence_label || 'unknown',
    }
  })
}

/**
 * Get contacts whose relationship is cooling.
 * Uses unified temperature algorithm.
 */
export async function getCoolingContacts(
  db: DbClient,
  userId: string,
  opts: { threshold?: number; rolesFilter?: string[]; limit?: number } = {},
): Promise<CoolingContact[]> {
  const { threshold = 40, rolesFilter, limit = 20 } = opts
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  // Get important contacts
  let query = db
    .from('contacts')
    .select('id, email, name, company, importance, last_contact_at, roles')
    .eq('user_id', userId)
    .in('importance', ['vip', 'high', 'normal'])

  if (rolesFilter && rolesFilter.length > 0) {
    // Filter by any of the specified roles
    const conditions = rolesFilter.map(r => `roles.cs.["${r}"]`).join(',')
    query = query.or(conditions)
  }

  const { data: contacts } = await query.limit(100)
  if (!contacts || contacts.length === 0) return []

  // Batch get recent interaction counts
  const contactEmails = contacts.map(c => c.email.toLowerCase())
  const { data: recentEmails } = await db
    .from('emails')
    .select('from_address')
    .eq('user_id', userId)
    .in('from_address', contactEmails)
    .gte('received_at', thirtyDaysAgo)

  const interactionCounts = new Map<string, number>()
  for (const e of recentEmails || []) {
    const addr = (e.from_address || '').toLowerCase()
    interactionCounts.set(addr, (interactionCounts.get(addr) || 0) + 1)
  }

  // Batch get active commitment counts
  const { data: commitments } = await db
    .from('commitments')
    .select('contact_email')
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress', 'overdue'])
    .in('contact_email', contactEmails)

  const commitmentCounts = new Map<string, number>()
  for (const c of commitments || []) {
    const email = (c.contact_email || '').toLowerCase()
    commitmentCounts.set(email, (commitmentCounts.get(email) || 0) + 1)
  }

  // Calculate temperature and filter
  const results: CoolingContact[] = []
  for (const c of contacts) {
    const email = c.email.toLowerCase()
    const lastInteractionAt = c.last_contact_at ? new Date(c.last_contact_at) : null
    const daysSince = lastInteractionAt
      ? Math.ceil((Date.now() - lastInteractionAt.getTime()) / 86400000)
      : 999

    const temp = calculateTemperature({
      lastInteractionAt,
      recentInteractionCount: interactionCounts.get(email) || 0,
      activeCommitmentCount: commitmentCounts.get(email) || 0,
      importance: c.importance || 'normal',
    })

    if (temp.score < threshold) {
      results.push({
        id: c.id,
        email: c.email,
        name: c.name || c.email,
        company: c.company,
        importance: c.importance,
        roles: c.roles || [],
        daysSinceContact: daysSince,
        temperature: temp,
      })
    }
  }

  // Sort: needsAttention first, then coldest first
  results.sort((a, b) => {
    if (a.temperature.needsAttention && !b.temperature.needsAttention) return -1
    if (!a.temperature.needsAttention && b.temperature.needsAttention) return 1
    return a.temperature.score - b.temperature.score
  })

  return results.slice(0, limit)
}

/**
 * Get unreplied emails that need attention.
 */
export async function getUnrepliedEmails(
  db: DbClient,
  userId: string,
  opts: { limit?: number } = {},
): Promise<UnrepliedEmail[]> {
  const { limit = 20 } = opts

  const { data } = await db
    .from('emails')
    .select('id, from_address, from_name, subject, received_at')
    .eq('user_id', userId)
    .eq('is_reply_needed', true)
    .order('received_at', { ascending: false })
    .limit(limit)

  if (!data) return []

  return data.map(e => ({
    id: e.id,
    from: e.from_address || '',
    fromName: e.from_name || e.from_address || '',
    subject: e.subject || '(no subject)',
    receivedAt: new Date(e.received_at),
    daysSince: Math.ceil((Date.now() - new Date(e.received_at).getTime()) / 86400000),
  }))
}

/**
 * Get recent interactions with a specific contact across all channels.
 */
export async function getRecentInteractions(
  db: DbClient,
  userId: string,
  contactEmail: string,
  days = 30,
): Promise<Signal[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const signals: Signal[] = []

  const [emailsRes, waRes] = await Promise.all([
    // Emails (both directions)
    db
      .from('emails')
      .select('id, from_address, from_name, to_addresses, subject, snippet, received_at, labels')
      .eq('user_id', userId)
      .or(`from_address.eq.${contactEmail},to_addresses.cs.{${contactEmail}}`)
      .gte('received_at', since)
      .order('received_at', { ascending: false })
      .limit(20),

    // WhatsApp (match by contact email mapping — simplified)
    db
      .from('whatsapp_messages')
      .select('id, from_number, body, direction, received_at')
      .eq('user_id', userId)
      .gte('received_at', since)
      .order('received_at', { ascending: false })
      .limit(20),
  ])

  for (const e of emailsRes.data || []) {
    const isOutbound = (e.labels || []).includes('SENT')
    signals.push({
      id: e.id,
      channel: 'email',
      direction: isOutbound ? 'outbound' : 'inbound',
      senderEmail: e.from_address || '',
      senderName: e.from_name || e.from_address || '',
      timestamp: new Date(e.received_at),
      title: e.subject || '(no subject)',
      preview: e.snippet || '',
    })
  }

  // Sort by timestamp descending
  signals.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return signals
}

/**
 * Get calendar conflicts for a user in the next N days.
 * Includes family calendar hard constraint detection.
 */
export async function getCalendarConflicts(
  db: DbClient,
  userId: string,
  opts: { days?: number } = {},
): Promise<CalendarConflict[]> {
  const { days = 7 } = opts
  const now = new Date()
  const until = new Date(now.getTime() + days * 86400000)

  const [eventsRes, familyRes] = await Promise.all([
    db
      .from('calendar_events')
      .select('id, title, start_time, end_time')
      .eq('user_id', userId)
      .gte('start_time', now.toISOString())
      .lte('start_time', until.toISOString())
      .order('start_time'),

    db
      .from('family_calendar')
      .select('id, title, start_date, end_date, start_time, end_time, event_type, recurrence, recurrence_day')
      .eq('user_id', userId)
      .eq('is_active', true),
  ])

  const events = eventsRes.data || []
  const familyEvents = familyRes.data || []
  const conflicts: CalendarConflict[] = []

  // Check work events against each other
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i]
      const b = events[j]
      const overlapMs = getOverlap(
        new Date(a.start_time), new Date(a.end_time || a.start_time),
        new Date(b.start_time), new Date(b.end_time || b.start_time),
      )
      if (overlapMs > 0) {
        conflicts.push({
          event1: { id: a.id, title: a.title, startTime: new Date(a.start_time), endTime: new Date(a.end_time || a.start_time) },
          event2: { id: b.id, title: b.title, startTime: new Date(b.start_time), endTime: new Date(b.end_time || b.start_time) },
          overlapMinutes: Math.round(overlapMs / 60000),
          involvesFamilyEvent: false,
        })
      }
    }
  }

  // Check work events against family calendar
  for (const event of events) {
    const eventStart = new Date(event.start_time)
    const eventEnd = new Date(event.end_time || event.start_time)

    for (const fe of familyEvents) {
      if (isFamilyEventOnDate(fe, eventStart) && fe.start_time && fe.end_time) {
        // Build family event datetime on the same date
        const feDate = eventStart.toISOString().slice(0, 10)
        const feStart = new Date(`${feDate}T${fe.start_time}`)
        const feEnd = new Date(`${feDate}T${fe.end_time}`)

        const overlapMs = getOverlap(eventStart, eventEnd, feStart, feEnd)
        if (overlapMs > 0) {
          conflicts.push({
            event1: { id: event.id, title: event.title, startTime: eventStart, endTime: eventEnd },
            event2: { id: fe.id, title: fe.title, startTime: feStart, endTime: feEnd },
            overlapMinutes: Math.round(overlapMs / 60000),
            involvesFamilyEvent: true,
          })
        }
      }
    }
  }

  return conflicts
}

// ─── Helpers ───

function getOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const overlapStart = Math.max(aStart.getTime(), bStart.getTime())
  const overlapEnd = Math.min(aEnd.getTime(), bEnd.getTime())
  return Math.max(0, overlapEnd - overlapStart)
}

function isFamilyEventOnDate(fe: any, date: Date): boolean {
  const dayOfWeek = date.getDay() // 0=Sun
  const dateStr = date.toISOString().slice(0, 10)

  if (fe.recurrence === 'weekly' && fe.recurrence_day === dayOfWeek) return true
  if (fe.recurrence === 'none' && fe.start_date === dateStr) return true
  if (fe.recurrence === 'daily') return true
  if (fe.recurrence === 'yearly') {
    const feMonth = new Date(fe.start_date).getMonth()
    const feDay = new Date(fe.start_date).getDate()
    return date.getMonth() === feMonth && date.getDate() === feDay
  }
  return false
}
