/**
 * Unified Context Engine — the "brain" shared by all Agents.
 *
 * Provides a single API to get complete context about:
 * - A contact (cross-channel identity, interaction history, commitments)
 * - A time period (all events across all channels)
 * - The user's current state (what needs attention right now)
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { calculateTemperature } from '@/lib/contacts/temperature'
import { getOverdueCommitments, getCoolingContacts, getCalendarConflicts } from '@/lib/signals/query'

// ─── Types ───

export interface UnifiedContact {
  id: string
  email: string
  phone?: string
  name: string
  company?: string
  role?: string
  relationship?: string
  importance?: string
  channels: ('gmail' | 'outlook' | 'whatsapp' | 'telegram')[]
  lastInteraction: Date | null
  interactionCount30d: number
  temperature: number // 0-100
  activeCommitments: {
    iPromised: number
    waitingOnThem: number
  }
}

export interface ContactTimeline {
  contact: UnifiedContact
  events: Array<{
    type: 'email_in' | 'email_out' | 'whatsapp_in' | 'whatsapp_out' | 'meeting' | 'commitment_created' | 'commitment_resolved'
    timestamp: Date
    title: string
    snippet?: string
    metadata?: Record<string, any>
  }>
}

export interface UserState {
  urgentItems: number
  overdueCommitments: number
  pendingReplies: number
  todayMeetings: number
  activeTrip: boolean
  lastSync: Date | null
}

// ─── Contact Resolution ───

/**
 * Resolve a contact across all channels.
 * Matches by: email, phone number, or fuzzy name match.
 */
export async function resolveContact(
  userId: string,
  identifier: { email?: string; phone?: string; name?: string },
): Promise<UnifiedContact | null> {
  const admin = createAdminClient()

  // Try exact email match first
  if (identifier.email) {
    const { data: contact } = await admin
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .eq('email', identifier.email.toLowerCase())
      .single()

    if (contact) {
      return await enrichContact(admin, userId, contact)
    }
  }

  // Try phone match
  if (identifier.phone) {
    const { data: contact } = await admin
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .eq('phone', identifier.phone)
      .single()

    if (contact) {
      return await enrichContact(admin, userId, contact)
    }
  }

  // Try name match (fuzzy)
  if (identifier.name) {
    const { data: contacts } = await admin
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .ilike('name', `%${identifier.name}%`)
      .limit(1)

    if (contacts && contacts.length > 0) {
      return await enrichContact(admin, userId, contacts[0])
    }
  }

  return null
}

/**
 * Get the full interaction timeline for a contact.
 */
export async function getContactTimeline(
  userId: string,
  contactEmail: string,
  days = 30,
): Promise<ContactTimeline | null> {
  const contact = await resolveContact(userId, { email: contactEmail })
  if (!contact) return null

  const admin = createAdminClient()
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const [emailsRes, waRes, eventsRes, commitmentsRes] = await Promise.all([
    // Emails (both directions)
    admin
      .from('emails')
      .select('from_address, to_addresses, subject, snippet, received_at, labels')
      .eq('user_id', userId)
      .or(`from_address.eq.${contactEmail},to_addresses.cs.{${contactEmail}}`)
      .gte('received_at', since)
      .order('received_at', { ascending: true }),

    // WhatsApp messages (match by phone or name)
    contact.phone
      ? admin
          .from('whatsapp_messages')
          .select('from_number, to_number, body, direction, received_at')
          .eq('user_id', userId)
          .or(`from_number.eq.${contact.phone},to_number.eq.${contact.phone}`)
          .gte('received_at', since)
          .order('received_at', { ascending: true })
      : Promise.resolve({ data: [] }),

    // Calendar events with this contact
    admin
      .from('calendar_events')
      .select('title, start_time, attendees')
      .eq('user_id', userId)
      .gte('start_time', since)
      .order('start_time', { ascending: true }),

    // Commitments
    admin
      .from('follow_ups')
      .select('subject, type, status, created_at, due_date')
      .eq('user_id', userId)
      .eq('contact_email', contactEmail)
      .gte('created_at', since)
      .order('created_at', { ascending: true }),
  ])

  const events: ContactTimeline['events'] = []

  // Add emails
  for (const e of emailsRes.data || []) {
    const isOutbound = (e.labels || []).includes('SENT')
    events.push({
      type: isOutbound ? 'email_out' : 'email_in',
      timestamp: new Date(e.received_at),
      title: e.subject || '(no subject)',
      snippet: e.snippet || undefined,
    })
  }

  // Add WhatsApp
  for (const m of (waRes as any).data || []) {
    events.push({
      type: m.direction === 'inbound' ? 'whatsapp_in' : 'whatsapp_out',
      timestamp: new Date(m.received_at),
      title: (m.body || '').slice(0, 100),
    })
  }

  // Add meetings (filter by attendee)
  for (const evt of eventsRes.data || []) {
    const attendees = typeof evt.attendees === 'string' ? JSON.parse(evt.attendees) : evt.attendees || []
    const hasContact = attendees.some((a: any) =>
      a.email?.toLowerCase() === contactEmail.toLowerCase()
    )
    if (hasContact) {
      events.push({
        type: 'meeting',
        timestamp: new Date(evt.start_time),
        title: evt.title,
      })
    }
  }

  // Add commitments
  for (const c of commitmentsRes.data || []) {
    events.push({
      type: c.status === 'resolved' ? 'commitment_resolved' : 'commitment_created',
      timestamp: new Date(c.created_at),
      title: c.subject,
      metadata: { type: c.type, due_date: c.due_date },
    })
  }

  // Sort by timestamp
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  return { contact, events }
}

/**
 * Get the user's current state snapshot.
 */
export async function getUserState(userId: string): Promise<UserState> {
  const admin = createAdminClient()
  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)

  const [urgentRes, overdueRes, repliesRes, meetingsRes, tripRes, syncRes] = await Promise.all([
    admin
      .from('follow_ups')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('type', 'i_promised')
      .lte('due_date', todayISO),

    admin
      .from('follow_ups')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active')
      .lte('due_date', todayISO),

    admin
      .from('emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_reply_needed', true),

    admin
      .from('calendar_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('start_time', `${todayISO}T00:00:00`)
      .lte('start_time', `${todayISO}T23:59:59`),

    admin
      .from('trips')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active'),

    admin
      .from('sync_log')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  return {
    urgentItems: urgentRes.count || 0,
    overdueCommitments: overdueRes.count || 0,
    pendingReplies: repliesRes.count || 0,
    todayMeetings: meetingsRes.count || 0,
    activeTrip: (tripRes.count || 0) > 0,
    lastSync: syncRes.data?.completed_at ? new Date(syncRes.data.completed_at) : null,
  }
}

// ─── Internal ───

async function enrichContact(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  contact: any,
): Promise<UnifiedContact> {
  const email = contact.email?.toLowerCase() || ''
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  // Count recent interactions
  const { count: emailCount } = await admin
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('from_address', email)
    .gte('received_at', thirtyDaysAgo)

  // Count active commitments
  const { data: commitments } = await admin
    .from('follow_ups')
    .select('type')
    .eq('user_id', userId)
    .eq('contact_email', email)
    .eq('status', 'active')

  const iPromised = (commitments || []).filter(c => c.type === 'i_promised').length
  const waitingOnThem = (commitments || []).filter(c => c.type === 'waiting_on_them').length

  // Determine channels
  const channels: UnifiedContact['channels'] = []
  if (email && !email.startsWith('wa-')) channels.push('gmail')
  if (contact.phone) channels.push('whatsapp')

  // Unified temperature algorithm (shared with Weaver Agent)
  const temp = calculateTemperature({
    lastInteractionAt: contact.last_contact_at ? new Date(contact.last_contact_at) : null,
    recentInteractionCount: emailCount || 0,
    activeCommitmentCount: iPromised + waitingOnThem,
    importance: contact.importance || 'normal',
  })
  const temperature = temp.score

  return {
    id: contact.id,
    email,
    phone: contact.phone || undefined,
    name: contact.name || email,
    company: contact.company || undefined,
    role: contact.role || undefined,
    relationship: contact.relationship || undefined,
    importance: contact.importance || undefined,
    channels,
    lastInteraction: contact.last_contact_at ? new Date(contact.last_contact_at) : null,
    interactionCount30d: emailCount || 0,
    temperature,
    activeCommitments: { iPromised, waitingOnThem },
  }
}

// ─── Context Bundle (unified entry point for all Agents) ───

export type ContextMode = 'reply' | 'meeting_prep' | 'travel' | 'briefing' | 'family_conflict'
export type ContextDepth = 'light' | 'standard' | 'deep'

export interface ContextBundle {
  mode: ContextMode
  contact?: UnifiedContact
  timeline?: ContactTimeline
  overdueCommitments?: Awaited<ReturnType<typeof getOverdueCommitments>>
  coolingContacts?: Awaited<ReturnType<typeof getCoolingContacts>>
  calendarConflicts?: Awaited<ReturnType<typeof getCalendarConflicts>>
  userState?: UserState
  tripContext?: any
  summary: string
}

/**
 * Unified context bundle — the single function all Agents should call.
 *
 * Different modes load different data:
 * - reply: contact + commitments + recent interactions
 * - meeting_prep: contact + full timeline + commitments + organization
 * - travel: trip data + destination contacts + commitments due during trip
 * - briefing: overdue + cooling + conflicts + user state
 * - family_conflict: calendar conflicts involving family events
 */
export async function getContextBundle(
  userId: string,
  opts: {
    contactEmail?: string
    mode: ContextMode
    depth?: ContextDepth
  },
): Promise<ContextBundle> {
  const admin = createAdminClient()
  const { contactEmail, mode, depth = 'standard' } = opts
  const bundle: ContextBundle = { mode, summary: '' }

  // Contact-centric modes
  if (contactEmail && (mode === 'reply' || mode === 'meeting_prep')) {
    bundle.contact = await resolveContact(userId, { email: contactEmail }) || undefined

    if (mode === 'meeting_prep' || depth === 'deep') {
      bundle.timeline = await getContactTimeline(userId, contactEmail, 30) || undefined
    }
  }

  // Briefing mode: aggregate data
  if (mode === 'briefing') {
    const [overdue, cooling, conflicts, state] = await Promise.all([
      getOverdueCommitments(admin, userId),
      getCoolingContacts(admin, userId, { threshold: 40, limit: 5 }),
      getCalendarConflicts(admin, userId, { days: 7 }),
      getUserState(userId),
    ])
    bundle.overdueCommitments = overdue
    bundle.coolingContacts = cooling
    bundle.calendarConflicts = conflicts
    bundle.userState = state
  }

  // Family conflict mode
  if (mode === 'family_conflict') {
    bundle.calendarConflicts = await getCalendarConflicts(admin, userId, { days: 7 })
  }

  // Travel mode
  if (mode === 'travel') {
    const { data: activeTrip } = await admin
      .from('trips')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'planned', 'confirmed'])
      .order('start_date')
      .limit(1)
      .single()

    if (activeTrip) {
      bundle.tripContext = activeTrip
      // Get contacts in destination
      const city = activeTrip.destination_city
      if (city) {
        const { data: localContacts } = await admin
          .from('contacts')
          .select('name, email, importance, last_contact_at')
          .eq('user_id', userId)
          .ilike('city', `%${city}%`)
          .limit(10)
        bundle.tripContext.localContacts = localContacts || []
      }
    }
  }

  // Build summary
  const parts: string[] = []
  if (bundle.contact) parts.push(`Contact: ${bundle.contact.name} (${bundle.contact.importance || 'normal'}, temp=${bundle.contact.temperature})`)
  if (bundle.overdueCommitments?.length) parts.push(`${bundle.overdueCommitments.length} overdue commitments`)
  if (bundle.coolingContacts?.length) parts.push(`${bundle.coolingContacts.length} cooling contacts`)
  if (bundle.calendarConflicts?.length) parts.push(`${bundle.calendarConflicts.length} calendar conflicts`)
  bundle.summary = parts.join('; ') || 'No notable context'

  return bundle
}
