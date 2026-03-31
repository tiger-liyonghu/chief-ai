'use client'

import { motion } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Clock,
  Calendar,
  MessageSquare,
  AlertCircle,
  Loader2,
  ChevronRight,
  ExternalLink,
  Thermometer,
  PenLine,
  CalendarPlus,
  Send,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { cn, fixDoubleUtf8 } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

/* ─── Types ─── */

interface ContactDetail {
  id: string
  email: string
  name: string | null
  company: string | null
  role: string | null
  phone: string | null
  relationship: string
  importance: string
  email_count: number
  last_contact_at: string | null
  notes: string | null
}

interface EmailItem {
  id: string
  subject: string
  from_address: string
  from_name: string | null
  received_at: string
  is_reply_needed: boolean
  reply_urgency: string | null
  snippet: string | null
}

interface WhatsAppMessage {
  id: string
  from_number: string
  from_name: string | null
  body: string
  received_at: string
  chat_name: string | null
}

interface FollowUp {
  id: string
  type: string
  subject: string | null
  commitment_text: string | null
  due_date: string | null
  status: string
  created_at: string
}

interface CalendarEvent {
  id: string
  title: string
  start_time: string
  end_time: string
  attendees: any
  location: string | null
}

interface TaskItem {
  id: string
  title: string
  priority: string
  status: string
  due_date: string | null
  created_at: string
}

interface RelationshipData {
  temperature: number
  status: 'hot' | 'warm' | 'cooling' | 'cold'
  days_since_contact: number
  recent_interactions_30d: number
  needs_attention: boolean
}

type TimelineItem =
  | { type: 'email'; data: EmailItem; date: string }
  | { type: 'whatsapp'; data: WhatsAppMessage; date: string }
  | { type: 'commitment'; data: FollowUp; date: string }
  | { type: 'event'; data: CalendarEvent; date: string }

/* ─── Constants ─── */

const IMPORTANCE_STYLES: Record<string, { label: string; className: string }> = {
  vip: { label: 'VIP', className: 'bg-amber-100 text-amber-700 border border-amber-300' },
  high: { label: 'High', className: 'bg-blue-100 text-blue-700 border border-blue-300' },
  normal: { label: 'Normal', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
  low: { label: 'Low', className: 'bg-gray-50 text-gray-400 border border-gray-100' },
}

const RELATIONSHIP_LABEL_KEYS: Record<string, 'contactBoss' | 'contactTeam' | 'contactClient' | 'contactInvestor' | 'contactPartner' | 'contactVendor' | 'contactPersonal' | 'contactRecruiter' | 'contactOther'> = {
  boss: 'contactBoss',
  team: 'contactTeam',
  client: 'contactClient',
  investor: 'contactInvestor',
  partner: 'contactPartner',
  vendor: 'contactVendor',
  personal: 'contactPersonal',
  recruiter: 'contactRecruiter',
  other: 'contactOther',
}

/* ─── Helpers ─── */

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function getAvatarColor(name: string | null, email: string): string {
  const str = name || email
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-red-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
  ]
  return colors[Math.abs(hash) % colors.length]
}

function getTemperatureColor(temp: number): string {
  if (temp >= 70) return 'bg-emerald-600'
  if (temp >= 40) return 'bg-emerald-400'
  if (temp >= 20) return 'bg-amber-400'
  return 'bg-red-400'
}

function getTemperatureTextColor(status: string): string {
  switch (status) {
    case 'hot': return 'text-emerald-600'
    case 'warm': return 'text-emerald-500'
    case 'cooling': return 'text-amber-500'
    case 'cold': return 'text-red-500'
    default: return 'text-gray-500'
  }
}

function getTemperatureLabelKey(status: string): 'tempHot' | 'tempWarm' | 'tempCooling' | 'tempCold' | 'unknown' {
  switch (status) {
    case 'hot': return 'tempHot'
    case 'warm': return 'tempWarm'
    case 'cooling': return 'tempCooling'
    case 'cold': return 'tempCold'
    default: return 'unknown'
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

/* ─── Temperature Gauge ─── */

function TemperatureGauge({ temperature, status }: { temperature: number; status: string }) {
  const { t } = useI18n()
  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-text-tertiary" />
          <h3 className="text-sm font-semibold text-text-primary">{t('relationshipTemperature')}</h3>
        </div>
        <span className={cn('text-sm font-bold', getTemperatureTextColor(status))}>
          {t(getTemperatureLabelKey(status))}
        </span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${temperature}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={cn('h-full rounded-full', getTemperatureColor(temperature))}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-text-tertiary">{t('tempCold')}</span>
        <span className="text-xs font-medium text-text-secondary">{temperature}/100</span>
        <span className="text-[10px] text-text-tertiary">{t('tempHot')}</span>
      </div>
    </div>
  )
}

/* ─── Profile Card ─── */

function ProfileCard({ contact }: { contact: ContactDetail }) {
  const { t } = useI18n()
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-border p-5"
    >
      <div className="flex items-start gap-4">
        <div className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0',
          getAvatarColor(contact.name, contact.email)
        )}>
          {getInitials(contact.name, contact.email)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-text-primary">
              {contact.name || contact.email}
            </h2>
            <span className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              IMPORTANCE_STYLES[contact.importance]?.className || IMPORTANCE_STYLES.normal.className
            )}>
              {IMPORTANCE_STYLES[contact.importance]?.label || 'Normal'}
            </span>
            {contact.relationship && contact.relationship !== 'other' && (
              <span className="text-xs text-text-tertiary bg-surface-secondary px-2 py-0.5 rounded-full">
                {RELATIONSHIP_LABEL_KEYS[contact.relationship] ? t(RELATIONSHIP_LABEL_KEYS[contact.relationship]) : contact.relationship}
              </span>
            )}
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Mail className="w-4 h-4 text-text-tertiary shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Phone className="w-4 h-4 text-text-tertiary shrink-0" />
                <span>{contact.phone}</span>
              </div>
            )}
            {contact.company && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Building2 className="w-4 h-4 text-text-tertiary shrink-0" />
                <span>{contact.company}</span>
              </div>
            )}
            {contact.role && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Briefcase className="w-4 h-4 text-text-tertiary shrink-0" />
                <span>{contact.role}</span>
              </div>
            )}
          </div>
          {contact.notes && (
            <p className="mt-3 text-xs text-text-tertiary bg-surface-secondary rounded-xl px-3 py-2">
              {contact.notes}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Interaction Timeline ─── */

function InteractionTimeline({ items }: { items: TimelineItem[] }) {
  const { t } = useI18n()
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-text-tertiary" />
          {t('interactionTimeline')}
        </h3>
        <p className="text-sm text-text-tertiary text-center py-6">
          {t('noInteractions')}
        </p>
      </div>
    )
  }

  function getIconStyle(type: TimelineItem['type']) {
    switch (type) {
      case 'email': return { bg: 'bg-blue-100 text-blue-600', icon: <Mail className="w-3.5 h-3.5" /> }
      case 'whatsapp': return { bg: 'bg-emerald-100 text-emerald-600', icon: <MessageSquare className="w-3.5 h-3.5" /> }
      case 'commitment': return { bg: 'bg-amber-100 text-amber-600', icon: <AlertCircle className="w-3.5 h-3.5" /> }
      case 'event': return { bg: 'bg-indigo-100 text-indigo-600', icon: <Calendar className="w-3.5 h-3.5" /> }
    }
  }

  function getLabel(type: TimelineItem['type']) {
    switch (type) {
      case 'email': return t('email')
      case 'whatsapp': return t('whatsappLabel')
      case 'commitment': return t('commitment')
      case 'event': return t('meetingLabel')
    }
  }

  function getTitle(item: TimelineItem): string {
    switch (item.type) {
      case 'email': return fixDoubleUtf8((item.data as EmailItem).subject || '(No subject)')
      case 'whatsapp': return (item.data as WhatsAppMessage).body
      case 'commitment': {
        const fu = item.data as FollowUp
        return fu.commitment_text || fu.subject || 'Follow-up'
      }
      case 'event': return (item.data as CalendarEvent).title
    }
  }

  function getSubtitle(item: TimelineItem): string | null {
    if (item.type === 'email') return (item.data as EmailItem).snippet || null
    if (item.type === 'commitment') {
      const fu = item.data as FollowUp
      return fu.status === 'active' ? 'Active' : fu.status === 'done' ? 'Completed' : fu.status
    }
    if (item.type === 'event') {
      const ev = item.data as CalendarEvent
      return ev.location || null
    }
    return null
  }

  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-text-tertiary" />
        {t('interactionTimeline')}
        <span className="text-xs text-text-tertiary font-normal ml-auto">
          {items.length} interactions
        </span>
      </h3>
      <div className="space-y-1">
        {items.map((item, idx) => {
          const iconStyle = getIconStyle(item.type)
          const title = getTitle(item)
          const subtitle = getSubtitle(item)
          const dateStr = new Date(item.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })

          return (
            <motion.div
              key={`${item.type}-${item.data.id}-${idx}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-surface-secondary transition-colors"
            >
              {/* Date column */}
              <span className="text-[11px] text-text-tertiary w-10 shrink-0 pt-1 text-right font-medium">
                {dateStr}
              </span>

              {/* Icon */}
              <div className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                iconStyle.bg,
              )}>
                {iconStyle.icon}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{title}</p>
                {subtitle && (
                  <p className="text-xs text-text-tertiary truncate mt-0.5">{subtitle}</p>
                )}
                <p className="text-[11px] text-text-tertiary mt-1">
                  {getLabel(item.type)} · {formatRelativeTime(item.date)}
                </p>
              </div>

              {/* Badges */}
              {item.type === 'email' && (item.data as EmailItem).is_reply_needed && (
                <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                  Needs reply
                </span>
              )}
              {item.type === 'commitment' && (item.data as FollowUp).status === 'done' && (
                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                  Completed
                </span>
              )}
              {item.type === 'commitment' && (item.data as FollowUp).status === 'active' && (
                <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                  Active
                </span>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Follow-ups Section ─── */

function FollowUpsSection({ followUps }: { followUps: FollowUp[] }) {
  const active = followUps.filter(f => f.status === 'active')
  if (active.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-500" />
        Open Commitments
        <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full ml-auto">
          {active.length}
        </span>
      </h3>
      <div className="space-y-2">
        {active.map((fu) => {
          const isOverdue = fu.due_date && new Date(fu.due_date) < new Date()
          return (
            <div
              key={fu.id}
              className={cn(
                'p-3 rounded-xl border',
                isOverdue ? 'border-red-200 bg-red-50' : 'border-border bg-surface-secondary'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  'text-[10px] font-medium px-2 py-0.5 rounded-full',
                  fu.type === 'i_promised'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                )}>
                  {fu.type === 'i_promised' ? 'You promised' : 'Waiting on them'}
                </span>
                {isOverdue && (
                  <span className="text-[10px] font-medium text-red-600">Overdue</span>
                )}
              </div>
              <p className="text-sm text-text-primary">
                {fu.commitment_text || fu.subject || 'Follow-up'}
              </p>
              {fu.due_date && (
                <p className="text-xs text-text-tertiary mt-1">
                  Due: {formatDate(fu.due_date)}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Upcoming Events Section ─── */

function UpcomingEventsSection({ events }: { events: CalendarEvent[] }) {
  const now = new Date()
  const upcoming = events.filter(e => new Date(e.start_time) >= now)
  if (upcoming.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-primary" />
        Upcoming Meetings
        <span className="text-xs text-text-tertiary font-normal ml-auto">
          {upcoming.length}
        </span>
      </h3>
      <div className="space-y-2">
        {upcoming.slice(0, 5).map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary"
          >
            <div className="w-10 text-center shrink-0">
              <p className="text-xs text-text-tertiary">
                {new Date(event.start_time).toLocaleDateString('en-US', { month: 'short' })}
              </p>
              <p className="text-lg font-bold text-primary">
                {new Date(event.start_time).getDate()}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate">{event.title}</p>
              <p className="text-xs text-text-tertiary">
                {new Date(event.start_time).toLocaleTimeString('en-US', {
                  hour: 'numeric', minute: '2-digit', hour12: true,
                })}
                {' - '}
                {new Date(event.end_time).toLocaleTimeString('en-US', {
                  hour: 'numeric', minute: '2-digit', hour12: true,
                })}
              </p>
              {event.location && (
                <p className="text-xs text-text-tertiary truncate mt-0.5">{event.location}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Main Page ─── */

export default function ContactDetailPage() {
  const { t } = useI18n()
  const params = useParams()
  const router = useRouter()
  const contactId = params.id as string

  const [contact, setContact] = useState<ContactDetail | null>(null)
  const [emails, setEmails] = useState<EmailItem[]>([])
  const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppMessage[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [sharedEvents, setSharedEvents] = useState<CalendarEvent[]>([])
  const [relData, setRelData] = useState<RelationshipData | null>(null)
  const [nextMeeting, setNextMeeting] = useState<{ title: string; start_time: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch contact detail (includes emails, tasks, follow-ups, events)
      const res = await fetch(`/api/contacts/${contactId}`)
      if (!res.ok) {
        router.push('/dashboard/contacts')
        return
      }
      const data = await res.json()
      setContact(data.contact)
      setEmails(data.recentEmails || [])
      setFollowUps(data.followUps || [])
      setSharedEvents(data.sharedEvents || [])

      // Fetch WhatsApp messages if contact has a phone number
      if (data.contact.phone) {
        const waRes = await fetch(`/api/whatsapp/messages?from=${encodeURIComponent(data.contact.phone)}&limit=20`)
        if (waRes.ok) {
          const waData = await waRes.json()
          setWhatsappMessages(Array.isArray(waData) ? waData : waData.messages || [])
        }
      }

      // Fetch next meeting with this contact
      if (data.contact.email) {
        try {
          const meetRes = await fetch(`/api/contacts/${contactId}/next-meeting`)
          if (meetRes.ok) {
            const meetData = await meetRes.json()
            setNextMeeting(meetData.meeting || null)
          }
        } catch { /* ignore */ }
      }

      // Fetch relationship temperature from weaver
      const weaverRes = await fetch('/api/agents/weaver')
      if (weaverRes.ok) {
        const weaverData = await weaverRes.json()
        const rel = (weaverData.relationships || []).find(
          (r: any) => r.email.toLowerCase() === data.contact.email.toLowerCase()
        )
        if (rel) {
          setRelData({
            temperature: rel.temperature,
            status: rel.status,
            days_since_contact: rel.days_since_contact,
            recent_interactions_30d: rel.recent_interactions_30d,
            needs_attention: rel.needs_attention,
          })
        }
      }
    } catch (err) {
      console.error('Failed to fetch contact:', err)
    } finally {
      setLoading(false)
    }
  }, [contactId, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Build merged timeline (emails + whatsapp + commitments + events)
  const timeline: TimelineItem[] = [
    ...emails.map((e) => ({
      type: 'email' as const,
      data: e,
      date: e.received_at,
    })),
    ...whatsappMessages.map((m) => ({
      type: 'whatsapp' as const,
      data: m,
      date: m.received_at,
    })),
    ...followUps.map((f) => ({
      type: 'commitment' as const,
      data: f,
      date: f.created_at,
    })),
    ...sharedEvents.map((ev) => ({
      type: 'event' as const,
      data: ev,
      date: ev.start_time,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (loading) {
    return (
      <>
        <TopBar title={t('contacts' as any)} />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-text-tertiary">Loading contact...</span>
        </div>
      </>
    )
  }

  if (!contact) {
    return (
      <>
        <TopBar title={t('contacts' as any)} />
        <div className="text-center py-32">
          <p className="text-sm text-text-secondary">Contact not found.</p>
          <Link href="/dashboard/contacts" className="text-sm text-primary mt-2 inline-block">
            Back to contacts
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar
        title={contact.name || contact.email}
        subtitle={contact.company || undefined}
      />

      <div className="px-4 sm:px-8 py-6 max-w-4xl">
        {/* Back link + action buttons */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <Link
            href="/dashboard/contacts"
            className="inline-flex items-center gap-1.5 text-sm text-text-tertiary hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All contacts
          </Link>

          <div className="flex items-center gap-2">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors"
              >
                <PenLine className="w-3.5 h-3.5" />
                Draft Email
              </a>
            )}
            <Link
              href={`/dashboard/calendar`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Schedule Meeting
            </Link>
            {contact.email && (
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('chief-open-chat', {
                    detail: { prefill: `Draft a quick check-in email to ${contact.name || contact.email} at ${contact.email}` }
                  }))
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/20 bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Send Check-in
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column: Profile + Temperature + Follow-ups + Events */}
          <div className="lg:col-span-1 space-y-4">
            <ProfileCard contact={contact} />

            {/* Next meeting */}
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                {nextMeeting ? (
                  <span className="text-text-secondary">
                    <span className="font-medium text-text-primary">Next meeting:</span>{' '}
                    {nextMeeting.title} on{' '}
                    {new Date(nextMeeting.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                ) : (
                  <span className="text-text-tertiary">No upcoming meetings</span>
                )}
              </div>
            </div>

            {relData && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <TemperatureGauge temperature={relData.temperature} status={relData.status} />
              </motion.div>
            )}

            {/* Quick Stats */}
            {relData && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white rounded-2xl border border-border p-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-text-primary">
                      {relData.days_since_contact < 999 ? `${relData.days_since_contact}d` : '--'}
                    </p>
                    <p className="text-[10px] text-text-tertiary">Last contact</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-text-primary">
                      {relData.recent_interactions_30d}
                    </p>
                    <p className="text-[10px] text-text-tertiary">Emails (30d)</p>
                  </div>
                </div>
              </motion.div>
            )}

            <FollowUpsSection followUps={followUps} />
            <UpcomingEventsSection events={sharedEvents} />
          </div>

          {/* Right column: Interaction Timeline */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <InteractionTimeline items={timeline} />
            </motion.div>
          </div>
        </div>
      </div>
    </>
  )
}
