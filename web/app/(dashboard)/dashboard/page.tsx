'use client'

import { motion } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import {
  CheckSquare,
  Mail,
  Clock,
  Calendar,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Loader2,
  Send,
  Forward,
  X,
  MessageCircle,
  Settings,
  Users,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { AlarmSuggestion } from '@/components/dashboard/AlarmSuggestion'
import { AlertsBanner } from '@/components/dashboard/AlertsBanner'
import { DepartureReminder } from '@/components/dashboard/DepartureReminder'
import { OnboardingProgress } from '@/components/dashboard/OnboardingProgress'
import Recommendations from '@/components/dashboard/Recommendations'
import { cn } from '@/lib/utils'

/* ─── Contact Intelligence Types & Components ─── */

type RelationshipGroup = 'all' | 'boss' | 'team' | 'client' | 'investor' | 'partner' | 'vendor' | 'personal'

interface Contact {
  id: string
  email: string
  name: string | null
  company: string | null
  role: string | null
  relationship: string
  importance: string
  email_count: number
}

const RELATIONSHIP_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  boss: { label: 'contactBoss', color: 'bg-red-100 text-red-700 border-red-200', dotColor: 'bg-red-500' },
  team: { label: 'contactTeam', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dotColor: 'bg-emerald-500' },
  client: { label: 'contactClient', color: 'bg-blue-100 text-blue-700 border-blue-200', dotColor: 'bg-blue-500' },
  investor: { label: 'contactInvestor', color: 'bg-purple-100 text-purple-700 border-purple-200', dotColor: 'bg-purple-500' },
  partner: { label: 'contactPartner', color: 'bg-amber-100 text-amber-700 border-amber-200', dotColor: 'bg-amber-500' },
  vendor: { label: 'contactVendor', color: 'bg-slate-100 text-slate-700 border-slate-200', dotColor: 'bg-slate-500' },
  personal: { label: 'contactPersonal', color: 'bg-pink-100 text-pink-700 border-pink-200', dotColor: 'bg-pink-500' },
}

function ContactGroupFilter({
  contacts,
  selected,
  onSelect,
}: {
  contacts: Contact[]
  selected: RelationshipGroup
  onSelect: (group: RelationshipGroup) => void
}) {
  const { t } = useI18n()

  const groups: { key: RelationshipGroup; label: string }[] = [
    { key: 'all', label: t('contactAll' as any) },
    { key: 'boss', label: t('contactBoss' as any) },
    { key: 'team', label: t('contactTeam' as any) },
    { key: 'client', label: t('contactClient' as any) },
    { key: 'investor', label: t('contactInvestor' as any) },
    { key: 'partner', label: t('contactPartner' as any) },
    { key: 'vendor', label: t('contactVendor' as any) },
    { key: 'personal', label: t('contactPersonal' as any) },
  ]

  const counts: Record<string, number> = {}
  for (const c of contacts) {
    counts[c.relationship] = (counts[c.relationship] || 0) + 1
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
      <Users className="w-4 h-4 text-text-tertiary shrink-0" />
      {groups.map((g) => {
        const count = g.key === 'all' ? contacts.length : (counts[g.key] || 0)
        if (g.key !== 'all' && count === 0) return null
        const isActive = selected === g.key
        return (
          <button
            key={g.key}
            onClick={() => onSelect(g.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 border',
              isActive
                ? (RELATIONSHIP_CONFIG[g.key]?.color || 'bg-primary text-white border-primary')
                : 'bg-white text-text-secondary border-border hover:bg-surface-secondary'
            )}
          >
            {g.label}
            {count > 0 && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                isActive ? 'bg-white/30' : 'bg-surface-secondary'
              )}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function RelationshipDot({ contact }: { contact: Contact | undefined }) {
  const { t } = useI18n()
  if (!contact || !RELATIONSHIP_CONFIG[contact.relationship]) return null
  const config = RELATIONSHIP_CONFIG[contact.relationship]
  const label = t(config.label as any)
  const detail = contact.company ? `${label} @ ${contact.company}` : label

  return (
    <span className="group/dot relative inline-flex items-center">
      <span className={cn('w-2 h-2 rounded-full shrink-0', config.dotColor)} />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-[10px] rounded-md whitespace-nowrap opacity-0 group-hover/dot:opacity-100 transition-opacity pointer-events-none z-10">
        {detail}
      </span>
    </span>
  )
}

interface TransportData {
  transport_cards: any[]
  alarm_suggestion: {
    first_meeting_time: string
    first_meeting_title: string
    first_meeting_location: string
    suggested_alarm: string
    commute_estimate: string
  } | null
  upcoming_reminder: {
    next_event_title: string
    next_event_time: string
    next_event_location: string
    minutes_until_depart: number
    depart_by: string
    address: string
  } | null
}

interface DashboardData {
  tasks: any[]
  pendingReplies: any[]
  followUps: any[]
  todayEvents: any[]
}

type Tone = 'formal' | 'friendly' | 'brief'
type InboxTab = 'overview' | 'needsReply' | 'whatsapp'

const stagger = {
  animate: { transition: { staggerChildren: 0.05 } },
}

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

function timeAgo(dateStr: string, t: (key: any, params?: Record<string, string | number>) => string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return t('mAgo', { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('hAgo', { n: hours })
  const days = Math.floor(hours / 24)
  return t('dAgo', { n: days })
}

function StatCard({ icon: Icon, label, count, color, href }: {
  icon: any; label: string; count: number; color: string; href: string
}) {
  return (
    <Link href={href}>
      <motion.div
        variants={fadeUp}
        className="bg-white rounded-2xl border border-border p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center`}>
            <Icon className="w-5 h-5" />
          </div>
          <ArrowRight className="w-4 h-4 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </div>
        <p className="text-2xl font-bold">{count}</p>
        <p className="text-sm text-text-secondary mt-0.5">{label}</p>
      </motion.div>
    </Link>
  )
}

function TaskItem({ task }: { task: any }) {
  const { t } = useI18n()
  const priorityColors: Record<number, string> = {
    1: 'bg-red-100 text-red-700',
    2: 'bg-amber-100 text-amber-700',
    3: 'bg-blue-100 text-blue-700',
  }
  const priorityLabels: Record<number, string> = {
    1: t('urgentLabel'),
    2: t('thisWeekLabel'),
    3: t('laterLabel'),
  }

  return (
    <motion.div
      variants={fadeUp}
      className="flex items-start gap-3 p-4 bg-white rounded-xl border border-border hover:shadow-sm transition-all duration-200"
    >
      <div className="mt-0.5">
        <div className="w-5 h-5 rounded-md border-2 border-border hover:border-primary transition-colors cursor-pointer" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{task.title}</p>
        {task.due_reason && (
          <p className="text-xs text-text-tertiary mt-1">{task.due_reason}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority] || priorityColors[3]}`}>
          {priorityLabels[task.priority] || t('laterLabel')}
        </span>
        {task.source_account_email && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-secondary text-text-tertiary truncate max-w-[140px]">
            {task.source_account_email}
          </span>
        )}
      </div>
    </motion.div>
  )
}

function SourceBadge({ email }: { email: string }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-secondary text-text-tertiary truncate max-w-[160px]">
      {email}
    </span>
  )
}

function EmailItem({ email, contact }: { email: any; contact?: Contact }) {
  const { t } = useI18n()
  return (
    <motion.div
      variants={fadeUp}
      className="flex items-center gap-3 p-4 bg-white rounded-xl border border-border hover:shadow-sm transition-all duration-200 cursor-pointer"
    >
      <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold shrink-0">
        {(email.from_name || email.from_address || '?')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-text-primary truncate">{email.from_name || email.from_address}</p>
          <RelationshipDot contact={contact} />
        </div>
        <p className="text-xs text-text-secondary truncate">{email.subject}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-xs text-text-tertiary whitespace-nowrap">{timeAgo(email.received_at, t)}</span>
        {email.source_account_email && (
          <SourceBadge email={email.source_account_email} />
        )}
      </div>
    </motion.div>
  )
}

function EventItem({ event }: { event: any }) {
  const { t } = useI18n()
  const startTime = new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const attendees = typeof event.attendees === 'string' ? JSON.parse(event.attendees) : (event.attendees || [])

  return (
    <motion.div
      variants={fadeUp}
      className="flex items-center gap-3 p-4 bg-white rounded-xl border border-border"
    >
      <div className="text-center shrink-0 w-12">
        <p className="text-xs text-text-tertiary">{startTime}</p>
      </div>
      <div className="w-1 h-8 bg-primary rounded-full shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{event.title}</p>
        {attendees.length > 0 && (
          <p className="text-xs text-text-tertiary">{attendees.length} {t('attendees')}</p>
        )}
      </div>
    </motion.div>
  )
}

function daysOverdue(dueDateStr: string | null): number {
  if (!dueDateStr) return 0
  const diff = Date.now() - new Date(dueDateStr).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

/* ─── Replies Tab (moved from replies/page.tsx) ─── */
function RepliesPanel({ emails, setEmails, loading, fetchEmails, contactByEmail }: {
  emails: any[]
  setEmails: React.Dispatch<React.SetStateAction<any[]>>
  loading: boolean
  fetchEmails: () => Promise<void>
  contactByEmail?: Map<string, Contact>
}) {
  const { t } = useI18n()
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null)
  const [draft, setDraft] = useState('')
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [tone, setTone] = useState<Tone>('friendly')
  const [showForward, setShowForward] = useState(false)
  const [forwardTo, setForwardTo] = useState('')
  const [forwardNote, setForwardNote] = useState('')
  const [forwarding, setForwarding] = useState(false)
  const [dismissingId, setDismissingId] = useState<string | null>(null)

  // Full email body state
  const [fullBody, setFullBody] = useState<string | null>(null)
  const [bodyLoading, setBodyLoading] = useState(false)
  const bodyCache = useRef<Map<string, string>>(new Map())

  // Thread state
  const [threadEmails, setThreadEmails] = useState<any[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null)
  const [threadBodyCache, setThreadBodyCache] = useState<Map<string, string>>(new Map())
  const [threadBodyLoading, setThreadBodyLoading] = useState<string | null>(null)

  // Fetch full body when email is selected
  const fetchFullBody = useCallback(async (emailId: string) => {
    // Check in-memory cache first
    if (bodyCache.current.has(emailId)) {
      setFullBody(bodyCache.current.get(emailId)!)
      return
    }

    setBodyLoading(true)
    setFullBody(null)
    try {
      const res = await fetch(`/api/emails/${emailId}`)
      if (res.ok) {
        const data = await res.json()
        const body = data.body || ''
        bodyCache.current.set(emailId, body)
        setFullBody(body)
      }
    } catch {
      // Fallback handled in UI
    } finally {
      setBodyLoading(false)
    }
  }, [])

  // Fetch thread emails when email is selected
  const fetchThread = useCallback(async (emailId: string) => {
    setThreadLoading(true)
    setThreadEmails([])
    setExpandedThreadId(null)
    try {
      const res = await fetch(`/api/emails/${emailId}/thread`)
      if (res.ok) {
        const data = await res.json()
        setThreadEmails(data)
      }
    } catch {
      // Silently fail
    } finally {
      setThreadLoading(false)
    }
  }, [])

  // Fetch body for a thread email
  const fetchThreadEmailBody = useCallback(async (emailId: string) => {
    if (threadBodyCache.has(emailId)) return
    setThreadBodyLoading(emailId)
    try {
      const res = await fetch(`/api/emails/${emailId}`)
      if (res.ok) {
        const data = await res.json()
        setThreadBodyCache(prev => new Map(prev).set(emailId, data.body || ''))
      }
    } catch {
      // Silently fail
    } finally {
      setThreadBodyLoading(null)
    }
  }, [threadBodyCache])

  // When selecting an email, fetch its full body and thread
  const handleSelectEmail = useCallback((email: any) => {
    setSelectedEmail(email)
    setDraft('')
    setShowForward(false)
    setForwardTo('')
    setForwardNote('')
    setThreadBodyCache(new Map())
    fetchFullBody(email.id)
    fetchThread(email.id)
  }, [fetchFullBody, fetchThread])

  const handleDismiss = useCallback(async (emailId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDismissingId(emailId)

    try {
      const res = await fetch('/api/emails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: emailId, is_reply_needed: false }),
      })

      if (res.ok) {
        setTimeout(() => {
          setEmails(prev => prev.filter(e => e.id !== emailId))
          if (selectedEmail?.id === emailId) {
            setSelectedEmail(null)
            setFullBody(null)
          }
          setDismissingId(null)
        }, 300)
      } else {
        setDismissingId(null)
      }
    } catch {
      setDismissingId(null)
    }
  }, [selectedEmail, setEmails])

  const handleGenerateDraft = async () => {
    if (!selectedEmail) return
    setGenerating(true)
    setDraft('')

    // Use full body if available, fall back to snippet
    const emailContent = fullBody || bodyCache.current.get(selectedEmail.id) || selectedEmail.snippet

    try {
      const res = await fetch('/api/ai/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread: emailContent,
          tone,
          from: selectedEmail.from_name || selectedEmail.from_address,
          subject: selectedEmail.subject,
        }),
      })

      if (!res.ok) throw new Error('Failed to generate')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value)
          setDraft(prev => prev + text)
        }
      }
    } catch (err) {
      setDraft(t('draftError'))
    } finally {
      setGenerating(false)
    }
  }

  const handleSend = async () => {
    if (!selectedEmail || !draft || sending) return
    setSending(true)
    setSuccessMsg('')

    try {
      const res = await fetch('/api/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: selectedEmail.id,
          to: selectedEmail.from_address,
          subject: selectedEmail.subject?.startsWith('Re: ')
            ? selectedEmail.subject
            : `Re: ${selectedEmail.subject}`,
          body: draft,
          threadId: selectedEmail.thread_id,
          messageId: selectedEmail.message_id,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send')
      }

      setEmails(prev => prev.filter(e => e.id !== selectedEmail.id))
      setSelectedEmail(null)
      setDraft('')
      setSuccessMsg('Reply sent successfully')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      alert(`Failed to send reply: ${err.message}`)
    } finally {
      setSending(false)
    }
  }

  const handleForward = async () => {
    if (!selectedEmail || !forwardTo || forwarding) return
    setForwarding(true)

    try {
      const res = await fetch('/api/forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: selectedEmail.id,
          to: forwardTo,
          note: forwardNote || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to forward')
      }

      setShowForward(false)
      setForwardTo('')
      setForwardNote('')
      setSuccessMsg('Email forwarded successfully')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      alert(`Failed to forward: ${err.message}`)
    } finally {
      setForwarding(false)
    }
  }

  const urgencyBadge = (u: number) => {
    if (u >= 3) return <span className="w-2 h-2 rounded-full bg-danger shrink-0" />
    if (u >= 2) return <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
    return null
  }

  return (
    <div>
      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mb-4 px-4 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-medium border border-green-200"
        >
          {successMsg}
        </motion.div>
      )}

      <div className="flex h-[calc(100vh-280px)] min-h-[400px] rounded-xl border border-border overflow-hidden bg-white">
        {/* Email List */}
        <div className="w-80 lg:w-96 border-r border-border overflow-y-auto shrink-0">
          {loading ? (
            <div className="text-center py-16">
              <Loader2 className="w-6 h-6 text-primary mx-auto animate-spin" />
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Mail className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
              <p className="text-sm text-text-tertiary">{t('noEmailsSyncPrompt')}</p>
            </div>
          ) : (
            emails.map((email) => (
              <div
                key={email.id}
                className={cn(
                  'relative group/email transition-all duration-300',
                  dismissingId === email.id && 'opacity-0 -translate-x-4 h-0 overflow-hidden'
                )}
              >
                <button
                  onClick={() => handleSelectEmail(email)}
                  className={cn(
                    'w-full text-left p-4 border-b border-border hover:bg-surface-secondary transition-all duration-150',
                    selectedEmail?.id === email.id && 'bg-primary-light border-l-2 border-l-primary'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold shrink-0">
                      {(email.from_name || email.from_address || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{email.from_name || email.from_address}</span>
                        {urgencyBadge(email.reply_urgency)}
                        {contactByEmail && <RelationshipDot contact={contactByEmail.get((email.from_address || '').toLowerCase())} />}
                      </div>
                    </div>
                    <span className="text-xs text-text-tertiary">{timeAgo(email.received_at, t)}</span>
                  </div>
                  <p className="text-sm font-medium text-text-primary truncate pl-10">{email.subject}</p>
                  <p className="text-xs text-text-tertiary truncate pl-10 mt-0.5">{email.snippet}</p>
                  {email.source_account_email && (
                    <div className="pl-10 mt-1">
                      <SourceBadge email={email.source_account_email} />
                    </div>
                  )}
                </button>
                {/* Dismiss button — appears on hover */}
                <button
                  onClick={(e) => handleDismiss(email.id, e)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-white border border-border text-text-tertiary hover:text-red-500 hover:border-red-200 hover:bg-red-50 opacity-0 group-hover/email:opacity-100 transition-all duration-200 shadow-sm"
                  title="Not needed"
                  aria-label="Dismiss email"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Reply Composer */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedEmail ? (
            <>
              <div className="p-6 border-b border-border">
                <h2 className="text-lg font-semibold">{selectedEmail.subject}</h2>
                <p className="text-sm text-text-secondary mt-1">
                  From: {selectedEmail.from_name || ''} &lt;{selectedEmail.from_address}&gt;
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {/* Original Email — full body */}
                <div className="bg-surface-secondary rounded-xl p-4 mb-6">
                  <p className="text-xs text-text-tertiary mb-2 font-medium">{t('originalEmail')}</p>
                  {bodyLoading ? (
                    <div className="flex items-center gap-2 py-4">
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      <span className="text-sm text-text-tertiary">Loading full email...</span>
                    </div>
                  ) : (
                    <div className="text-sm text-text-secondary leading-relaxed max-h-[400px] overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-sans break-words">
                        {fullBody || selectedEmail.snippet}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Thread view — other emails in the same thread */}
                {threadEmails.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs text-text-tertiary mb-3 font-medium flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      Thread ({threadEmails.length + 1} messages)
                    </p>
                    <div className="space-y-2">
                      {threadEmails.map((te) => {
                        const isExpanded = expandedThreadId === te.id
                        return (
                          <div
                            key={te.id}
                            className="border border-border rounded-xl overflow-hidden bg-white"
                          >
                            <button
                              onClick={() => {
                                if (isExpanded) {
                                  setExpandedThreadId(null)
                                } else {
                                  setExpandedThreadId(te.id)
                                  if (!threadBodyCache.has(te.id) && !te.body_text) {
                                    fetchThreadEmailBody(te.id)
                                  }
                                }
                              }}
                              className="w-full text-left p-3 flex items-center gap-3 hover:bg-surface-secondary transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-text-tertiary shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
                              )}
                              <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold shrink-0">
                                {(te.from_name || te.from_address || '?')[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-text-primary truncate block">
                                  {te.from_name || te.from_address}
                                </span>
                                <span className="text-xs text-text-tertiary truncate block">
                                  {te.subject}
                                </span>
                              </div>
                              <span className="text-xs text-text-tertiary whitespace-nowrap shrink-0">
                                {timeAgo(te.received_at, t)}
                              </span>
                            </button>
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-1 border-t border-border bg-surface-secondary/50">
                                {threadBodyLoading === te.id ? (
                                  <div className="flex items-center gap-2 py-3">
                                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                    <span className="text-sm text-text-tertiary">Loading...</span>
                                  </div>
                                ) : (
                                  <div className="text-sm text-text-secondary leading-relaxed max-h-[300px] overflow-y-auto">
                                    <pre className="whitespace-pre-wrap font-sans break-words">
                                      {threadBodyCache.get(te.id) || te.body_text || te.snippet || '(no content)'}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {threadLoading && (
                  <div className="flex items-center gap-2 mb-6">
                    <Loader2 className="w-4 h-4 text-text-tertiary animate-spin" />
                    <span className="text-xs text-text-tertiary">Loading thread...</span>
                  </div>
                )}

                {draft && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-primary/20 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium text-primary">{t('aiDraft')}</span>
                    </div>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="w-full min-h-[200px] text-sm text-text-primary leading-relaxed resize-none focus:outline-none bg-transparent"
                    />
                  </motion.div>
                )}
              </div>

              <div className="p-4 border-t border-border flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 bg-surface-secondary rounded-xl p-1">
                  {(['formal', 'friendly', 'brief'] as Tone[]).map((toneVal) => (
                    <button
                      key={toneVal}
                      onClick={() => setTone(toneVal)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 capitalize',
                        tone === toneVal ? 'bg-white text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'
                      )}
                    >
                      {t(toneVal)}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleGenerateDraft}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary-light text-primary rounded-xl text-sm font-medium hover:bg-indigo-100 transition-all duration-200"
                >
                  <Sparkles className={`w-4 h-4 ${generating ? 'animate-pulse' : ''}`} />
                  {generating ? t('generating') : t('draftWithAI')}
                </button>

                <button
                  onClick={() => setShowForward(!showForward)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    showForward
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-surface-secondary text-text-secondary hover:bg-amber-50 hover:text-amber-700'
                  )}
                >
                  <Forward className="w-4 h-4" />
                  {t('forward') || 'Forward'}
                </button>

                <div className="flex-1" />

                {draft && (
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {sending ? t('syncing') : t('sendReply')}
                  </button>
                )}
              </div>

              {/* Forward inline form */}
              {showForward && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-amber-200 bg-amber-50/50 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Forward className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">{t('forwardEmail') || 'Forward email'}</span>
                    </div>
                    <button
                      onClick={() => setShowForward(false)}
                      className="p-1 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      <X className="w-4 h-4 text-amber-600" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-1 block">{t('forwardTo') || 'Forward to'}</label>
                      <input
                        type="email"
                        value={forwardTo}
                        onChange={(e) => setForwardTo(e.target.value)}
                        placeholder="recipient@example.com"
                        className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-1 block">{t('forwardNote') || 'Note (optional)'}</label>
                      <textarea
                        value={forwardNote}
                        onChange={(e) => setForwardNote(e.target.value)}
                        placeholder={t('forwardNotePlaceholder') || 'Add a note...'}
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 resize-none bg-white"
                      />
                    </div>
                    <button
                      onClick={handleForward}
                      disabled={!forwardTo || forwarding}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {forwarding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Forward className="w-4 h-4" />
                      )}
                      {forwarding ? (t('forwarding') || 'Forwarding...') : (t('forwardSend') || 'Forward')}
                    </button>
                  </div>
                </motion.div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <Mail className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
                <p className="text-text-secondary font-medium">{t('selectEmail')}</p>
                <p className="text-sm text-text-tertiary mt-1">{t('aiHelpDraft')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── WhatsApp Panel ─── */
function WhatsAppPanel({ messages, loading, connected, t }: {
  messages: any[]
  loading: boolean
  connected: boolean | null
  t: (key: any, params?: Record<string, string | number>) => string
}) {
  if (loading) {
    return (
      <div className="text-center py-16">
        <Loader2 className="w-6 h-6 text-primary mx-auto animate-spin" />
      </div>
    )
  }

  if (connected === false) {
    return (
      <div className="text-center py-16 px-4">
        <MessageCircle className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
        <p className="text-text-secondary font-medium mb-1">{t('whatsAppNotConnected')}</p>
        <p className="text-sm text-text-tertiary mb-4">{t('whatsAppSetupPrompt')}</p>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary bg-primary/10 px-5 py-2.5 rounded-xl hover:bg-primary/20 transition-colors"
        >
          <Settings className="w-4 h-4" />
          {t('waGoToSettings')}
        </Link>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <MessageCircle className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
        <p className="text-text-secondary font-medium">{t('noWhatsAppMessages')}</p>
      </div>
    )
  }

  // Group messages by contact (from_number for inbound, to_number for outbound)
  const contactMap = new Map<string, { name: string | null; number: string; messages: any[] }>()
  for (const msg of messages) {
    const contactNumber = msg.direction === 'inbound' ? msg.from_number : msg.to_number
    if (!contactMap.has(contactNumber)) {
      contactMap.set(contactNumber, {
        name: msg.from_name || null,
        number: contactNumber,
        messages: [],
      })
    }
    const group = contactMap.get(contactNumber)!
    // Update name if we find one
    if (msg.from_name && !group.name) group.name = msg.from_name
    group.messages.push(msg)
  }

  const contacts = Array.from(contactMap.values()).sort((a, b) => {
    const aLatest = new Date(a.messages[0]?.received_at || 0).getTime()
    const bLatest = new Date(b.messages[0]?.received_at || 0).getTime()
    return bLatest - aLatest
  })

  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const activeContact = contacts.find((c) => c.number === selectedContact)

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[400px] rounded-xl border border-border overflow-hidden bg-white">
      {/* Contact List */}
      <div className="w-80 lg:w-96 border-r border-border overflow-y-auto shrink-0">
        <div className="p-3 border-b border-border">
          <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">{t('waGroupedBy')}</p>
        </div>
        {contacts.map((contact) => {
          const lastMsg = contact.messages[0]
          const unread = contact.messages.filter((m: any) => m.direction === 'inbound' && !m.is_task_extracted).length

          return (
            <button
              key={contact.number}
              onClick={() => setSelectedContact(contact.number)}
              className={cn(
                'w-full text-left p-4 border-b border-border hover:bg-surface-secondary transition-all duration-150',
                selectedContact === contact.number && 'bg-primary-light border-l-2 border-l-primary',
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-semibold shrink-0">
                  {(contact.name || contact.number || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{contact.name || contact.number}</span>
                    {unread > 0 && (
                      <span className="w-5 h-5 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                        {unread}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-tertiary truncate mt-0.5">
                    {lastMsg?.body?.slice(0, 60) || '(media)'}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Chat View */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeContact ? (
          <>
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="w-9 h-9 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-semibold shrink-0">
                {(activeContact.name || activeContact.number)[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold">{activeContact.name || activeContact.number}</p>
                {activeContact.name && (
                  <p className="text-xs text-text-tertiary">{activeContact.number}</p>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {[...activeContact.messages].reverse().map((msg: any) => (
                <div
                  key={msg.id}
                  className={cn(
                    'max-w-[70%] rounded-2xl px-4 py-2.5',
                    msg.direction === 'inbound'
                      ? 'bg-surface-secondary text-text-primary self-start mr-auto'
                      : 'bg-primary text-white self-end ml-auto',
                  )}
                >
                  <p className="text-sm leading-relaxed">{msg.body || `[${msg.message_type}]`}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn(
                      'text-[10px]',
                      msg.direction === 'inbound' ? 'text-text-tertiary' : 'text-white/60',
                    )}>
                      {new Date(msg.received_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </span>
                    {msg.is_task_extracted && (
                      <span className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                        msg.direction === 'inbound'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-white/20 text-white',
                      )}>
                        {t('waTaskExtracted')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <MessageCircle className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
              <p className="text-text-secondary font-medium">{t('waGroupedBy')}</p>
              <p className="text-sm text-text-tertiary mt-1">{contacts.length} {t('waRecentMessages')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Main Inbox Page ─── */
export default function DashboardPage() {
  const { t, setLocale } = useI18n()
  const [data, setData] = useState<DashboardData>({ tasks: [], pendingReplies: [], followUps: [], todayEvents: [] })
  const [allEmails, setAllEmails] = useState<any[]>([])
  const [transportData, setTransportData] = useState<TransportData | null>(null)
  const [reminderDismissed, setReminderDismissed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [emailsLoading, setEmailsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<InboxTab>('overview')
  const [briefing, setBriefing] = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [waMessages, setWaMessages] = useState<any[]>([])
  const [waLoading, setWaLoading] = useState(false)
  const [waConnected, setWaConnected] = useState<boolean | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactGroup, setContactGroup] = useState<RelationshipGroup>('all')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [detectedTimezone, setDetectedTimezone] = useState('')
  const [detectedLanguage, setDetectedLanguage] = useState('en')

  // Auto-onboarding detection on mount
  useEffect(() => {
    const alreadyOnboarded = localStorage.getItem('chief-onboarded')
    if (alreadyOnboarded) return

    // Detect timezone and language from browser
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const navLang = navigator.language
    const lang = navLang.startsWith('zh') ? 'zh'
      : navLang.startsWith('ms') ? 'ms'
      : 'en'

    setDetectedTimezone(tz)
    setDetectedLanguage(lang)

    // Auto-set i18n locale
    if (['en', 'zh', 'ms'].includes(lang)) {
      setLocale(lang as any)
    }

    // Check cookie or just trigger onboarding for first-time users
    const needsOnboarding = document.cookie.includes('chief-needs-onboarding=true')
    if (needsOnboarding || !alreadyOnboarded) {
      setShowOnboarding(true)
    }
  }, [setLocale])

  const [onboardingJustFinished, setOnboardingJustFinished] = useState(false)

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false)
    localStorage.setItem('chief-onboarded', 'true')
    // Clear the cookie
    document.cookie = 'chief-needs-onboarding=; path=/; max-age=0'
    // Signal to refetch data after onboarding
    setOnboardingJustFinished(true)
  }, [])

  const today = new Date()
  const greeting = today.getHours() < 12 ? t('goodMorning') : today.getHours() < 18 ? t('goodAfternoon') : t('goodEvening')
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const todayStr = today.toISOString().slice(0, 10)

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch('/api/emails')
      if (res.ok) {
        const data = await res.json()
        setAllEmails(data)
      }
    } finally {
      setEmailsLoading(false)
    }
  }, [])

  const fetchAll = useCallback(async () => {
    try {
      const [tasksRes, emailsRes, followUpsRes, calendarRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/emails'),
        fetch('/api/follow-ups'),
        fetch('/api/calendar'),
      ])

      const [tasks, emails, followUps, calendar] = await Promise.all([
        tasksRes.ok ? tasksRes.json() : [],
        emailsRes.ok ? emailsRes.json() : [],
        followUpsRes.ok ? followUpsRes.json() : [],
        calendarRes.ok ? calendarRes.json() : [],
      ])

      setAllEmails(emails || [])
      setEmailsLoading(false)

      setData({
        tasks: (tasks || []).filter((t: any) => t.status !== 'done').slice(0, 4),
        pendingReplies: (emails || []).slice(0, 3),
        followUps: (followUps || []).filter((f: any) => f.status === 'active').slice(0, 3),
        todayEvents: (calendar || []).filter((e: any) => e.start_time?.slice(0, 10) === todayStr).slice(0, 5),
      })

      // Fetch transport data in background (non-blocking)
      fetch('/api/transport')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setTransportData(d) })
        .catch(() => {})
    } finally {
      setLoading(false)
    }
  }, [todayStr])

  const fetchBriefing = useCallback(async () => {
    // Check localStorage cache (1 hour TTL)
    const cached = localStorage.getItem('chief_briefing')
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        const age = Date.now() - new Date(parsed.generated_at).getTime()
        if (age < 60 * 60 * 1000) {
          setBriefing(parsed.briefing)
          return
        }
      } catch { /* ignore parse errors */ }
    }

    setBriefingLoading(true)
    try {
      const res = await fetch('/api/briefing')
      if (res.ok) {
        const data = await res.json()
        setBriefing(data.briefing)
        localStorage.setItem('chief_briefing', JSON.stringify({
          briefing: data.briefing,
          generated_at: data.generated_at,
        }))
      }
    } catch { /* silently fail — fallback text shown */ }
    finally { setBriefingLoading(false) }
  }, [])

  // Fetch WhatsApp messages when tab is activated
  const fetchWhatsApp = useCallback(async () => {
    setWaLoading(true)
    try {
      const [connRes, msgRes] = await Promise.all([
        fetch('/api/whatsapp'),
        fetch('/api/whatsapp/messages?limit=100'),
      ])
      if (connRes.ok) {
        const connData = await connRes.json()
        setWaConnected(connData.connected === true)
      }
      if (msgRes.ok) {
        const msgData = await msgRes.json()
        setWaMessages(msgData)
      }
    } catch {
      // Silently fail
    } finally {
      setWaLoading(false)
    }
  }, [])

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/contacts')
      if (res.ok) {
        const data = await res.json()
        setContacts(data)
      }
    } catch { /* silently fail */ }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { fetchBriefing() }, [fetchBriefing])
  useEffect(() => { fetchContacts() }, [fetchContacts])
  useEffect(() => { if (activeTab === 'whatsapp') fetchWhatsApp() }, [activeTab, fetchWhatsApp])

  // Listen for background sync events from SyncManager
  useEffect(() => {
    const onSyncComplete = () => {
      fetchAll()
      fetchContacts()
    }
    window.addEventListener('chief-sync-complete', onSyncComplete)
    return () => window.removeEventListener('chief-sync-complete', onSyncComplete)
  }, [fetchAll, fetchContacts])

  // Refetch all data after onboarding completes
  useEffect(() => {
    if (onboardingJustFinished) {
      setOnboardingJustFinished(false)
      fetchAll()
      fetchContacts()
    }
  }, [onboardingJustFinished, fetchAll, fetchContacts])

  // Build a contact lookup map by email address
  const contactByEmail = new Map<string, Contact>()
  for (const c of contacts) {
    contactByEmail.set(c.email.toLowerCase(), c)
  }

  // Helper: get emails from contacts in the selected group
  const contactGroupEmails = contactGroup === 'all'
    ? null
    : new Set(contacts.filter(c => c.relationship === contactGroup).map(c => c.email.toLowerCase()))

  function filterByContactGroup<T extends { from_address?: string; contact_email?: string }>(items: T[]): T[] {
    if (!contactGroupEmails) return items
    return items.filter(item => {
      const email = (item.from_address || item.contact_email || '').toLowerCase()
      return contactGroupEmails.has(email)
    })
  }

  const urgentCount = data.tasks.filter(t => t.priority === 1).length

  const tabs: { key: InboxTab; label: string; count?: number }[] = [
    { key: 'overview', label: t('overview') },
    { key: 'needsReply', label: t('needsReply'), count: allEmails.length },
    { key: 'whatsapp', label: t('whatsapp'), count: waMessages.filter(m => m.direction === 'inbound').length || undefined },
  ]

  return (
    <div>
      {/* Onboarding overlay for first-time users */}
      {showOnboarding && (
        <OnboardingProgress
          timezone={detectedTimezone}
          language={detectedLanguage}
          onComplete={handleOnboardingComplete}
        />
      )}

      <TopBar
        title={`${greeting} \u{1F44B}`}
        subtitle={dateStr}
        onSyncComplete={fetchAll}
        autoSync
      />

      <div className="p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="text-center py-24">
            <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />
            <p className="text-sm text-text-tertiary mt-4">{t('loadingDashboard')}</p>
          </div>
        ) : (
          <>
            {/* AI Brief Banner */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-6 text-white mb-8"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-lg mb-1">{t('todaysBrief')}</h2>
                  {briefingLoading ? (
                    <div className="space-y-2">
                      <div className="h-3 bg-white/20 rounded-full w-full animate-pulse" />
                      <div className="h-3 bg-white/20 rounded-full w-4/5 animate-pulse" />
                      <div className="h-3 bg-white/20 rounded-full w-3/5 animate-pulse" />
                    </div>
                  ) : briefing ? (
                    <p className="text-white/90 text-sm leading-relaxed">{briefing}</p>
                  ) : (
                    <p className="text-white/90 text-sm leading-relaxed">
                      {data.tasks.length === 0 && data.pendingReplies.length === 0 && data.todayEvents.length === 0 ? (
                        <>{t('syncPrompt')}</>
                      ) : (
                        <>
                          {urgentCount > 0 && <>{t('urgentTasks', { n: urgentCount })} </>}
                          {data.pendingReplies.length > 0 && <>{t('emailsWaiting', { n: data.pendingReplies.length })} </>}
                          {data.todayEvents.length > 0 && <>{t('firstMeetingAt', { time: new Date(data.todayEvents[0].start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) })} </>}
                          {data.followUps.length > 0 && <>{t('followUpsNeedAttention', { n: data.followUps.length })}</>}
                        </>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Alarm Suggestion Banner */}
            {transportData?.alarm_suggestion && (
              <AlarmSuggestion {...transportData.alarm_suggestion} />
            )}

            {/* Proactive Alerts */}
            {activeTab === 'overview' && <AlertsBanner />}

            {/* Stats */}
            <motion.div
              variants={stagger}
              initial="initial"
              animate="animate"
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8"
            >
              <StatCard icon={CheckSquare} label={t('pendingTasks')} count={data.tasks.length} color="bg-emerald-50 text-emerald-600" href="/dashboard/tasks" />
              <StatCard icon={Mail} label={t('needsReply')} count={data.pendingReplies.length} color="bg-blue-50 text-blue-600" href="#" />
              <StatCard icon={Clock} label={t('followUps')} count={data.followUps.length} color="bg-amber-50 text-amber-600" href="/dashboard/tasks" />
              <StatCard icon={Calendar} label={t('todaysMeetings')} count={data.todayEvents.length} color="bg-purple-50 text-purple-600" href="/dashboard/calendar" />
            </motion.div>

            {/* Smart Recommendations */}
            <div className="mb-8">
              <Recommendations />
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 mb-6">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2',
                    activeTab === tab.key
                      ? 'bg-primary text-white'
                      : 'bg-white border border-border text-text-secondary hover:bg-surface-secondary'
                  )}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full font-medium',
                      activeTab === tab.key
                        ? 'bg-white/20 text-white'
                        : 'bg-danger text-white'
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' ? (
              /* ─── Overview Tab ─── */
              <div>
                {contacts.length > 0 && (
                  <ContactGroupFilter contacts={contacts} selected={contactGroup} onSelect={setContactGroup} />
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                {/* Left: Tasks + Replies */}
                <div className="space-y-6 lg:space-y-8">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-text-primary">{t('priorityTasks')}</h3>
                      <Link href="/dashboard/tasks" className="text-sm text-primary hover:underline">{t('viewAll')}</Link>
                    </div>
                    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-2">
                      {data.tasks.length > 0 ? data.tasks.map((task) => (
                        <TaskItem key={task.id} task={task} />
                      )) : (
                        <p className="text-sm text-text-tertiary py-4">{t('noPendingTasks')}</p>
                      )}
                    </motion.div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-text-primary flex items-center gap-2">
                        {t('needsReply')}
                        {filterByContactGroup(data.pendingReplies).length > 0 && (
                          <span className="bg-danger text-white text-xs px-2 py-0.5 rounded-full">{filterByContactGroup(data.pendingReplies).length}</span>
                        )}
                      </h3>
                      <button onClick={() => setActiveTab('needsReply')} className="text-sm text-primary hover:underline">{t('viewAll')}</button>
                    </div>
                    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-2">
                      {filterByContactGroup(data.pendingReplies).length > 0 ? filterByContactGroup(data.pendingReplies).map((email) => (
                        <EmailItem key={email.id} email={email} contact={contactByEmail.get((email.from_address || '').toLowerCase())} />
                      )) : (
                        <p className="text-sm text-text-tertiary py-4">{t('noEmailsNeedReply')}</p>
                      )}
                    </motion.div>
                  </div>
                </div>

                {/* Right: Calendar + Follow-ups */}
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-text-primary">{t('todaysSchedule')}</h3>
                      <Link href="/dashboard/calendar" className="text-sm text-primary hover:underline">{t('fullCalendar')}</Link>
                    </div>
                    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-2">
                      {data.todayEvents.length > 0 ? data.todayEvents.map((event) => (
                        <EventItem key={event.id} event={event} />
                      )) : (
                        <p className="text-sm text-text-tertiary py-4">{t('noEventsToday')}</p>
                      )}
                    </motion.div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-text-primary flex items-center gap-2">
                        {t('followUps')}
                        {data.followUps.some(f => daysOverdue(f.due_date) > 0) && (
                          <AlertCircle className="w-4 h-4 text-warning" />
                        )}
                      </h3>
                      <Link href="/dashboard/tasks" className="text-sm text-primary hover:underline">{t('viewAll')}</Link>
                    </div>
                    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-2">
                      {filterByContactGroup(data.followUps).length > 0 ? filterByContactGroup(data.followUps).map((fu) => (
                        <motion.div
                          key={fu.id}
                          variants={fadeUp}
                          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-border"
                        >
                          <div className={`w-2 h-2 rounded-full ${daysOverdue(fu.due_date) > 0 ? 'bg-danger' : 'bg-success'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-text-primary">{fu.contact_name}</p>
                              <RelationshipDot contact={contactByEmail.get((fu.contact_email || '').toLowerCase())} />
                            </div>
                            <p className="text-xs text-text-secondary truncate">{fu.subject}</p>
                          </div>
                          <span className={`text-xs font-medium ${daysOverdue(fu.due_date) > 0 ? 'text-danger' : 'text-text-tertiary'}`}>
                            {daysOverdue(fu.due_date) > 0 ? t('dOverdue', { n: daysOverdue(fu.due_date) }) : t('onTrack')}
                          </span>
                        </motion.div>
                      )) : (
                        <p className="text-sm text-text-tertiary py-4">{t('noActiveFollowUps')}</p>
                      )}
                    </motion.div>
                  </div>
                </div>
              </div>
              </div>
            ) : activeTab === 'needsReply' ? (
              /* ─── Needs Reply Tab ─── */
              <div>
                {contacts.length > 0 && (
                  <ContactGroupFilter contacts={contacts} selected={contactGroup} onSelect={setContactGroup} />
                )}
                <RepliesPanel
                  emails={contactGroupEmails ? allEmails.filter(e => contactGroupEmails.has((e.from_address || '').toLowerCase())) : allEmails}
                  setEmails={setAllEmails}
                  loading={emailsLoading}
                  fetchEmails={fetchEmails}
                  contactByEmail={contactByEmail}
                />
              </div>
            ) : (
              /* ─── WhatsApp Tab ─── */
              <WhatsAppPanel
                messages={waMessages}
                loading={waLoading}
                connected={waConnected}
                t={t}
              />
            )}
          </>
        )}
      </div>

      {/* Departure Reminder - fixed bottom bar */}
      {!reminderDismissed &&
        transportData?.upcoming_reminder &&
        transportData.upcoming_reminder.minutes_until_depart <= 30 && (
          <DepartureReminder
            {...transportData.upcoming_reminder}
            onDismiss={() => setReminderDismissed(true)}
          />
        )}
    </div>
  )
}
