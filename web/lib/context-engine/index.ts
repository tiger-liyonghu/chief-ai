/**
 * Unified Context Engine — the "brain" shared by all Agents.
 *
 * Provides a single API to get complete context about:
 * - A contact (cross-channel identity, interaction history, commitments)
 * - A time period (all events across all channels)
 * - The user's current state (what needs attention right now)
 */

import { createAdminClient } from '@/lib/supabase/admin'

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

  // Calculate temperature
  const daysSince = contact.last_contact_at
    ? Math.ceil((Date.now() - new Date(contact.last_contact_at).getTime()) / 86400000)
    : 999

  let temperature = 50
  if (daysSince <= 3) temperature += 30
  else if (daysSince <= 7) temperature += 20
  else if (daysSince <= 14) temperature += 10
  else if (daysSince <= 30) temperature -= 10
  else temperature -= 30
  temperature += Math.min((emailCount || 0) * 3, 15)
  temperature += (iPromised + waitingOnThem) * 5
  temperature = Math.max(0, Math.min(100, temperature))

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
