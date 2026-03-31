'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import {
  Target,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Heart,
  Plus,
  Mail,
  MessageSquare,
  Mic,
  PenLine,
  TrendingUp,
  CheckCircle2,
  Send,
  MoreHorizontal,
  Timer,
  Sparkles,
  Search,
  Loader2,
  XCircle,
  Link2,
  Calendar,
  MapPin,
  Users,
  Video,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { CommitmentDiscovery } from '@/components/dashboard/CommitmentDiscovery'

/* ─── Types ─── */

interface BlockedByInfo {
  id: string
  title: string
  deadline: string | null
  days_overdue: number
}

interface Commitment {
  id: string
  type: 'i_promised' | 'they_promised' | 'family'
  contact_id: string | null
  contact_name: string | null
  contact_email: string | null
  family_member: string | null
  title: string
  description: string | null
  source_type: string
  deadline: string | null
  deadline_fuzzy: string | null
  urgency_score: number
  status: string
  created_at: string
  contacts?: { id: string; name: string; company: string; email: string; importance: string } | null
  blocked_by?: BlockedByInfo[]
}

interface Stats {
  needs_action: number
  waiting_on_them: number
  family_active: number
  due_today: number
  overdue: number
  compliance_rate: number | null
  family_compliance_rate: number | null
  period_total: number
  period_completed: number
  avg_response_hours: number
  fastest_response_hours: number
  completion_sources?: {
    web: number
    whatsapp: number
    auto: number
  }
}

interface UnifiedEvent {
  id: string
  layer: 'work' | 'family' | 'commitment' | 'trip'
  title: string
  start_time: string
  end_time: string
  all_day: boolean
  location?: string
  attendees?: Array<{ email?: string; name?: string }>
  meeting_link?: string
  urgency?: number
  commitment_type?: string
  contact_name?: string
  family_member?: string
  event_type?: string
  trip_destination?: string
  is_conflict?: boolean
  conflict_with?: string
}

interface StaleVip {
  id: string
  name: string
  company: string | null
  days_since_contact: number
}

interface DraftData {
  to: string
  subject: string
  body: string
  fromEmail?: string | null
  tone?: string
  commitmentId: string
}

/* ─── Helpers ─── */

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - new Date().getTime()
  return Math.ceil(diff / 86400000)
}

function sourceIcon(type: string) {
  switch (type) {
    case 'email': return Mail
    case 'whatsapp': return MessageSquare
    case 'voice': return Mic
    default: return PenLine
  }
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${Math.round(hours)}h`
  return `${Math.round(hours / 24)}d`
}

function hasEscalationSuggestion(description: string | null): boolean {
  return !!description && description.includes('---ESCALATION---')
}

function urgencyColor(score: number, days: number | null): string {
  if (days !== null && days < 0) return 'text-red-600 bg-red-50 border-red-200'
  if (days !== null && days === 0) return 'text-orange-600 bg-orange-50 border-orange-200'
  if (score >= 5) return 'text-red-600 bg-red-50 border-red-200'
  if (score >= 3) return 'text-orange-600 bg-orange-50 border-orange-200'
  return 'text-slate-700 bg-white border-slate-200'
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatEventTime(isoStr: string): string {
  const d = new Date(isoStr)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function isToday(isoStr: string): boolean {
  const d = new Date(isoStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

function extractMeetingPlatform(link?: string): string | null {
  if (!link) return null
  if (link.includes('zoom.us') || link.includes('zoom.com')) return 'Zoom'
  if (link.includes('teams.microsoft')) return 'Teams'
  if (link.includes('meet.google')) return 'Meet'
  return 'Join'
}

/* ─── Draft Email Modal ─── */

function DraftEmailModal({ draft, onClose, onSent }: { draft: DraftData; onClose: () => void; onSent: () => void }) {
  const [to, setTo] = useState(draft.to)
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState(draft.body)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSend = async () => {
    if (!to || !subject || !body) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          body,
          fromEmail: draft.fromEmail || undefined,
        }),
      })
      if (res.ok) {
        setSent(true)
        await fetch('/api/commitments', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: draft.commitmentId, status: 'done' }),
        })
        setTimeout(() => {
          onSent()
          onClose()
        }, 1500)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to send email')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">
              {sent ? 'Email Sent' : 'Review & Send Email'}
            </h3>
            {draft.tone && (
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', {
                'bg-blue-100 text-blue-700': draft.tone === 'gentle',
                'bg-orange-100 text-orange-700': draft.tone === 'firm',
                'bg-red-100 text-red-700': draft.tone === 'urgent',
              })}>
                {draft.tone}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        {sent ? (
          <div className="p-8 flex flex-col items-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <p className="text-sm font-medium text-green-700">Email sent successfully</p>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">To</label>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !to || !body}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}

/* ─── Today's Most Important Card ─── */

function MostImportantCard({ c, onUpdate, onDraft }: { c: Commitment; onUpdate: () => void; onDraft: (draft: DraftData) => void }) {
  const days = daysUntil(c.deadline)
  const isOverdue = days !== null && days < 0
  const isDueToday = days === 0
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const bgClass = isOverdue
    ? 'bg-red-50 border-red-200'
    : isDueToday
    ? 'bg-amber-50 border-amber-200'
    : 'bg-orange-50 border-orange-200'

  const contactDisplay = c.type === 'family'
    ? c.family_member
    : (c.contacts?.name || c.contact_name || c.contact_email)

  const handleAction = async (action: string) => {
    if (action === 'done') {
      await fetch('/api/commitments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, status: 'done' }),
      })
      await fetch('/api/commitments/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback_type: 'confirmed',
          commitment_id: c.id,
          original_title: c.title,
          original_type: c.type,
          source_type: c.source_type,
        }),
      })
      onUpdate()
    } else if (action === 'draft_reply') {
      if (!c.contact_email) return
      setActionLoading('draft_reply')
      try {
        const res = await fetch('/api/commitments/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: c.id, action: 'draft_reply' }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.draft) {
            onDraft({
              to: data.draft.to,
              subject: data.draft.subject,
              body: data.draft.body,
              fromEmail: data.fromEmail,
              commitmentId: c.id,
            })
          }
        }
      } catch { /* ignore */ }
      setActionLoading(null)
    } else if (action === 'send_nudge') {
      if (!c.contact_email) return
      setActionLoading('send_nudge')
      try {
        const res = await fetch('/api/commitments/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: c.id, action: 'send_nudge' }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.draft) {
            onDraft({
              to: data.draft.to,
              subject: data.draft.subject,
              body: data.draft.body,
              fromEmail: data.fromEmail,
              tone: data.tone,
              commitmentId: c.id,
            })
          }
        }
      } catch { /* ignore */ }
      setActionLoading(null)
    }
  }

  return (
    <div className={cn('border rounded-xl p-4 transition-all', bgClass)}>
      {/* Title row */}
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 w-2 h-2 rounded-full shrink-0', isOverdue ? 'bg-red-500' : 'bg-amber-500')} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary leading-snug">{c.title}</p>
          {isOverdue && days != null && (
            <span className="text-xs font-medium text-red-600 mt-0.5 inline-block">
              {Math.abs(days)} day{Math.abs(days) > 1 ? 's' : ''} overdue
            </span>
          )}
          {isDueToday && (
            <span className="text-xs font-medium text-amber-600 mt-0.5 inline-block">
              Due today
            </span>
          )}
        </div>
      </div>

      {/* Contact info */}
      <div className="mt-2 ml-5 flex items-center gap-2 text-xs text-text-tertiary">
        {c.contacts?.id ? (
          <Link
            href={`/dashboard/contacts/${c.contacts.id}`}
            className="font-medium text-text-secondary hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {contactDisplay}
          </Link>
        ) : (
          <span className="font-medium text-text-secondary">{contactDisplay}</span>
        )}
        {c.contacts?.company && (
          <>
            <span className="text-text-tertiary">&middot;</span>
            <span>{c.contacts.company}</span>
          </>
        )}
        {c.contacts?.importance === 'vip' && (
          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold uppercase">VIP</span>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-3 ml-5 flex items-center gap-2">
        {c.type === 'i_promised' && c.contact_email && (
          <button
            onClick={() => handleAction('draft_reply')}
            disabled={actionLoading === 'draft_reply'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/80 border border-slate-200 text-text-secondary rounded-lg hover:bg-white transition-colors disabled:opacity-50"
          >
            {actionLoading === 'draft_reply' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <PenLine className="w-3 h-3" />
            )}
            Draft Reply
          </button>
        )}
        {c.type === 'they_promised' && c.contact_email && (
          <button
            onClick={() => handleAction('send_nudge')}
            disabled={actionLoading === 'send_nudge'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/80 border border-slate-200 text-text-secondary rounded-lg hover:bg-white transition-colors disabled:opacity-50"
          >
            {actionLoading === 'send_nudge' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Send className="w-3 h-3" />
            )}
            Send Nudge
          </button>
        )}
        <button
          onClick={() => handleAction('done')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/80 border border-slate-200 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
        >
          <CheckCircle2 className="w-3 h-3" />
          Done
        </button>
      </div>
    </div>
  )
}

/* ─── Schedule Timeline Event ─── */

function ScheduleEvent({ event, contacts }: { event: UnifiedEvent; contacts?: Array<{ id: string; email: string; name: string | null }> }) {
  const isFamily = event.layer === 'family'
  const platform = extractMeetingPlatform(event.meeting_link)
  const attendeeCount = event.attendees?.length || 0

  // Try to match first attendee to a contact for linking
  const firstAttendee = event.attendees?.[0]
  const matchedContact = firstAttendee && contacts
    ? contacts.find(c => c.email && firstAttendee.email && c.email.toLowerCase() === firstAttendee.email.toLowerCase())
    : null

  return (
    <div className={cn(
      'flex items-start gap-3 py-2.5',
      event.is_conflict && 'border-l-4 border-l-red-400 pl-3 -ml-3',
    )}>
      {/* Time column */}
      <div className="w-12 shrink-0 text-right">
        {!event.all_day ? (
          <span className={cn('text-sm font-medium', isFamily ? 'text-pink-600' : 'text-text-primary')}>
            {formatEventTime(event.start_time)}
          </span>
        ) : (
          <span className="text-xs text-text-tertiary">all day</span>
        )}
      </div>

      {/* Event content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isFamily && <Heart className="w-3 h-3 text-pink-500 shrink-0" />}
          <span className={cn(
            'text-sm truncate',
            isFamily ? 'text-pink-700 font-medium' : 'text-text-primary',
          )}>
            {/* Strip emoji prefix from unified API titles */}
            {event.title.replace(/^[\u{1F4E4}\u{1F4E5}\u{1F497}\u{2708}\u{FE0F}\u{1F4D7}]\s*/u, '')}
          </span>
          {event.location && (
            <>
              <span className="text-text-tertiary">&middot;</span>
              <span className="text-xs text-text-tertiary truncate flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {event.location}
              </span>
            </>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-0.5">
          {attendeeCount > 0 && matchedContact ? (
            <Link
              href={`/dashboard/contacts/${matchedContact.id}`}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              <Users className="w-3 h-3" />
              {matchedContact.name || firstAttendee?.name || firstAttendee?.email}
              {attendeeCount > 1 && <span className="text-text-tertiary">+{attendeeCount - 1}</span>}
            </Link>
          ) : attendeeCount > 0 ? (
            <span className="text-xs text-text-tertiary flex items-center gap-1">
              <Users className="w-3 h-3" />
              {firstAttendee?.name || firstAttendee?.email || `${attendeeCount}`}
              {attendeeCount > 1 && <span>+{attendeeCount - 1}</span>}
            </span>
          ) : null}
          {platform && event.meeting_link && (
            <a
              href={event.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Video className="w-3 h-3" />
              {platform}
            </a>
          )}
        </div>

        {/* Conflict resolution card */}
        {event.is_conflict && event.conflict_with && (
          <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-2 text-sm text-red-700 font-medium mb-2">
              <AlertTriangle className="w-4 h-4" />
              和「{event.conflict_with}」时间冲突
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => alert('Coming soon')}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-red-200 rounded-lg hover:bg-red-50 text-red-700"
              >
                🔄 改到其他时间
              </button>
              <button
                onClick={() => alert('Coming soon')}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-red-200 rounded-lg hover:bg-red-50 text-red-700"
              >
                💬 通知家人
              </button>
              <button
                onClick={() => alert('Coming soon')}
                className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-600"
              >
                保持不变
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Waiting On Them Card ─── */

function WaitingCard({ c, onDraft }: { c: Commitment; onDraft: (draft: DraftData) => void }) {
  const days = daysUntil(c.deadline)
  const [actionLoading, setActionLoading] = useState(false)

  const contactDisplay = c.contacts?.name || c.contact_name || c.contact_email || 'Unknown'

  const handleNudge = async () => {
    if (!c.contact_email) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/commitments/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, action: 'send_nudge' }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.draft) {
          onDraft({
            to: data.draft.to,
            subject: data.draft.subject,
            body: data.draft.body,
            fromEmail: data.fromEmail,
            tone: data.tone,
            commitmentId: c.id,
          })
        }
      }
    } catch { /* ignore */ }
    setActionLoading(false)
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          {c.contacts?.id ? (
            <Link
              href={`/dashboard/contacts/${c.contacts.id}`}
              className="font-medium text-text-primary hover:text-primary transition-colors"
            >
              {contactDisplay}
            </Link>
          ) : (
            <span className="font-medium text-text-primary">{contactDisplay}</span>
          )}
          {c.contacts?.company && (
            <>
              <span className="text-text-tertiary">&middot;</span>
              <span className="text-xs text-text-tertiary">{c.contacts.company}</span>
            </>
          )}
        </div>
        <p className="text-sm text-text-secondary truncate">{c.title}</p>
        {days != null && (
          <span className="text-xs text-text-tertiary">
            {days < 0 ? `${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''} overdue` : `${days} day${days !== 1 ? 's' : ''}`}
          </span>
        )}
      </div>
      {c.contact_email && (
        <button
          onClick={handleNudge}
          disabled={actionLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-text-secondary rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 shrink-0"
        >
          {actionLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Send className="w-3 h-3" />
          )}
          Send Nudge
        </button>
      )}
    </div>
  )
}

/* ─── Sophia Says ─── */

function SophiaSays({ stats, commitments }: { stats: Stats; commitments: Commitment[] }) {
  const activeCount = stats.needs_action + stats.waiting_on_them + stats.family_active
  const overdue = commitments.filter(c => c.deadline && daysUntil(c.deadline)! < 0)
  const vipCooling = commitments.filter(c => c.contacts?.importance === 'vip' && c.type === 'they_promised')

  const messages: string[] = []

  // Overcommitted warning
  if (activeCount > 10) {
    messages.push(`You have ${activeCount} active commitments. Consider focusing on the top 2-3 today and deferring the rest.`)
  }

  // Compliance rate dropping
  if (stats.compliance_rate != null && stats.compliance_rate < 70) {
    messages.push(`Your completion rate is at ${stats.compliance_rate}%. Closing a few quick wins today would help.`)
  }

  // VIP cooling
  if (vipCooling.length > 0) {
    const vipName = vipCooling[0].contacts?.name || vipCooling[0].contact_name
    if (vipName) {
      messages.push(`${vipName} (VIP) still owes you a response. Consider a gentle nudge.`)
    }
  }

  // Nothing important = silence
  if (messages.length === 0) return null

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-500 mb-1">Sophia says</p>
          {messages.map((msg, i) => (
            <p key={i} className="text-sm text-violet-800">{msg}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Commitment Card (full list) ─── */

function CommitmentCard({ c, t, onUpdate, onDraft }: { c: Commitment; t: ReturnType<typeof useI18n>['t']; onUpdate: () => void; onDraft: (draft: DraftData) => void }) {
  const days = daysUntil(c.deadline)
  const isOverdue = days !== null && days < 0
  const isDueToday = days === 0
  const SourceIcon = sourceIcon(c.source_type)
  const colorClass = urgencyColor(c.urgency_score, days)
  const [showActions, setShowActions] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const handleAction = async (action: string) => {
    setShowActions(false)
    if (action === 'done') {
      await fetch('/api/commitments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, status: 'done' }),
      })
      await fetch('/api/commitments/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback_type: 'confirmed',
          commitment_id: c.id,
          original_title: c.title,
          original_type: c.type,
          source_type: c.source_type,
        }),
      })
      onUpdate()
    } else if (action === 'postpone') {
      if (c.type === 'family' && !confirm(t('confirmPostponeFamily'))) return
      const newDeadline = new Date()
      newDeadline.setDate(newDeadline.getDate() + 7)
      await fetch('/api/commitments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, deadline: newDeadline.toISOString().split('T')[0] }),
      })
      onUpdate()
    } else if (action === 'not_a_commitment') {
      await fetch('/api/commitments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, status: 'cancelled' }),
      })
      await fetch('/api/commitments/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback_type: 'rejected',
          commitment_id: c.id,
          original_title: c.title,
          original_type: c.type,
          source_type: c.source_type,
        }),
      })
      onUpdate()
    } else if (action === 'draft_reply') {
      if (!c.contact_email) return
      setActionLoading('draft_reply')
      try {
        const res = await fetch('/api/commitments/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: c.id, action: 'draft_reply' }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.draft) {
            onDraft({
              to: data.draft.to,
              subject: data.draft.subject,
              body: data.draft.body,
              fromEmail: data.fromEmail,
              commitmentId: c.id,
            })
          }
        }
      } catch { /* ignore */ }
      setActionLoading(null)
    } else if (action === 'send_nudge') {
      if (!c.contact_email) return
      setActionLoading('send_nudge')
      try {
        const res = await fetch('/api/commitments/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: c.id, action: 'send_nudge' }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.draft) {
            onDraft({
              to: data.draft.to,
              subject: data.draft.subject,
              body: data.draft.body,
              fromEmail: data.fromEmail,
              tone: data.tone,
              commitmentId: c.id,
            })
          }
        }
      } catch { /* ignore */ }
      setActionLoading(null)
    }
  }

  return (
    <div className={cn('border rounded-xl p-4 transition-all hover:shadow-sm relative cursor-pointer', colorClass)} onClick={() => setExpanded(!expanded)}>
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 p-1.5 rounded-lg', {
          'bg-blue-100': c.type === 'i_promised',
          'bg-amber-100': c.type === 'they_promised',
          'bg-pink-100': c.type === 'family',
        })}>
          {c.type === 'i_promised' && <ArrowUpRight className="w-4 h-4 text-blue-600" />}
          {c.type === 'they_promised' && <ArrowDownLeft className="w-4 h-4 text-amber-600" />}
          {c.type === 'family' && <Heart className="w-4 h-4 text-pink-600" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {c.type !== 'family' && c.contacts?.id ? (
              <Link
                href={`/dashboard/contacts/${c.contacts.id}`}
                className="font-medium text-sm truncate text-text-primary hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {c.contacts.name || c.contact_name || c.contact_email}
              </Link>
            ) : (
              <span className="font-medium text-sm truncate">
                {c.type === 'family' ? c.family_member : (c.contacts?.name || c.contact_name || c.contact_email)}
              </span>
            )}
            {c.contacts?.company && (
              <span className="text-xs text-slate-500 truncate">@ {c.contacts.company}</span>
            )}
          </div>
          <p className="text-sm text-slate-800 mb-2 line-clamp-2 break-words">{c.title}</p>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <SourceIcon className="w-3 h-3" />
              {c.source_type === 'email' ? t('sourceEmail') :
               c.source_type === 'whatsapp' ? t('sourceWhatsapp') :
               c.source_type === 'voice' ? t('sourceVoice') : t('sourceManual')}
            </span>
            {c.deadline && (
              <span className={cn('flex items-center gap-1', {
                'text-red-600 font-medium': isOverdue,
                'text-orange-600 font-medium': isDueToday,
              })}>
                <Timer className="w-3 h-3" />
                {isOverdue ? t('daysOverdue', { n: String(Math.abs(days!)) }) :
                 isDueToday ? t('dueToday') :
                 `${days}d`}
              </span>
            )}
            {c.deadline_fuzzy && !c.deadline && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {c.deadline_fuzzy}
              </span>
            )}
          </div>

          {hasEscalationSuggestion(c.description) && (
            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-orange-100 border border-orange-300 text-orange-700 text-xs font-medium rounded-full">
              <AlertTriangle className="w-3 h-3" />
              needs escalation
            </span>
          )}

          {c.blocked_by && c.blocked_by.length > 0 && (
            <div className="mt-2 flex items-start gap-1.5 px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg">
              <Link2 className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
              <div className="text-xs text-red-700">
                <span className="font-medium">Blocked:</span>{' '}
                {c.blocked_by.map((b, i) => (
                  <span key={b.id}>
                    {i > 0 && ', '}
                    &ldquo;{b.title}&rdquo; ({b.days_overdue}d overdue)
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {c.type === 'i_promised' && c.contact_email && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAction('draft_reply') }}
              disabled={actionLoading === 'draft_reply'}
              className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors disabled:opacity-50"
              title="Draft Reply"
            >
              {actionLoading === 'draft_reply' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PenLine className="w-4 h-4" />
              )}
            </button>
          )}
          {c.type === 'i_promised' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAction('done') }}
              className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition-colors"
              title={t('markDone')}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          {c.type === 'they_promised' && c.contact_email && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAction('send_nudge') }}
              disabled={actionLoading === 'send_nudge'}
              className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors disabled:opacity-50"
              title={t('sendNudge')}
            >
              {actionLoading === 'send_nudge' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleAction('not_a_commitment') }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            title="Not a commitment"
          >
            <XCircle className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowActions(!showActions) }}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showActions && (
            <div className="absolute right-4 top-12 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
              {c.contact_email && (
                <button onClick={() => handleAction('draft_reply')} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                  <PenLine className="w-3.5 h-3.5" /> Draft Reply
                </button>
              )}
              {c.type === 'they_promised' && c.contact_email && (
                <button onClick={() => handleAction('send_nudge')} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                  <Send className="w-3.5 h-3.5" /> Send Nudge
                </button>
              )}
              <button onClick={() => handleAction('done')} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{t('markDone')}</button>
              <button onClick={() => handleAction('postpone')} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{t('postpone')}</button>
              <button onClick={() => handleAction('not_a_commitment')} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">Not a commitment</button>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-200 space-y-2" onClick={e => e.stopPropagation()}>
          {c.description && (
            <p className="text-xs text-slate-600">{c.description}</p>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            {c.contact_email && (
              <span className="px-2 py-0.5 bg-slate-100 rounded-md text-slate-600">@ {c.contact_email}</span>
            )}
            {c.deadline && (
              <span className="px-2 py-0.5 bg-slate-100 rounded-md text-slate-600">Deadline: {c.deadline}</span>
            )}
            {c.urgency_score != null && (
              <span className={cn('px-2 py-0.5 rounded-md', c.urgency_score > 7 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600')}>
                Urgency: {c.urgency_score}/10
              </span>
            )}
            {c.contacts?.importance === 'vip' && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md">VIP</span>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            {c.type === 'i_promised' && c.contact_email && (
              <button onClick={() => handleAction('draft_reply')} className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                Draft Reply
              </button>
            )}
            {c.type === 'they_promised' && c.contact_email && (
              <button onClick={() => handleAction('send_nudge')} className="px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100">
                Send Nudge
              </button>
            )}
            <button onClick={() => handleAction('done')} className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100">
              Mark Done
            </button>
            <button onClick={() => handleAction('postpone')} className="px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100">
              Postpone 7d
            </button>
            {c.deadline && (
              <button
                onClick={async () => {
                  const res = await fetch('/api/commitments/calendar-sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ commitment_id: c.id }),
                  })
                  if (res.ok) {
                    const data = await res.json()
                    alert(data.message || 'Time blocked on calendar')
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100"
              >
                Block Time
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Add Commitment Modal ─── */

function AddCommitmentForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n()
  const [type, setType] = useState<'i_promised' | 'they_promised' | 'family'>('i_promised')
  const [title, setTitle] = useState('')
  const [contactName, setContactName] = useState('')
  const [familyMember, setFamilyMember] = useState('')
  const [deadline, setDeadline] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    await fetch('/api/commitments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        title: title.trim(),
        contact_name: type !== 'family' ? contactName.trim() : undefined,
        family_member: type === 'family' ? familyMember.trim() : undefined,
        deadline: deadline || undefined,
        source_type: 'manual',
      }),
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4">{t('addCommitment')}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            {(['i_promised', 'they_promised', 'family'] as const).map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setType(tp)}
                className={cn('flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors', {
                  'bg-blue-50 border-blue-300 text-blue-700': type === tp && tp === 'i_promised',
                  'bg-amber-50 border-amber-300 text-amber-700': type === tp && tp === 'they_promised',
                  'bg-pink-50 border-pink-300 text-pink-700': type === tp && tp === 'family',
                  'bg-slate-50 border-slate-200 text-slate-500': type !== tp,
                })}
              >
                {tp === 'i_promised' ? t('iPromised') : tp === 'they_promised' ? t('theyPromised') : t('family')}
              </button>
            ))}
          </div>

          {type !== 'family' ? (
            <input
              type="text"
              placeholder={t('people')}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          ) : (
            <input
              type="text"
              placeholder={t('familyMemberPlaceholder')}
              value={familyMember}
              onChange={(e) => setFamilyMember(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          )}

          <input
            type="text"
            placeholder={t('addCommitment')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            autoFocus
          />

          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving || !title.trim()} className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {saving ? '...' : t('addCommitment')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

/* ─── Quick Stats (subtle, at the bottom) ─── */

function QuickStats({ stats }: { stats: Stats }) {
  return (
    <div className="flex items-center justify-center gap-6 py-4 text-xs text-text-tertiary">
      <div className="flex items-center gap-1.5">
        <div className="relative w-8 h-8">
          <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-200" />
            <circle
              cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2"
              className="text-emerald-500"
              strokeDasharray={`${((stats.compliance_rate ?? 0) / 100) * 88} 88`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-text-secondary">
            {stats.compliance_rate ?? 0}
          </span>
        </div>
        <span>Completion</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-text-secondary">{stats.needs_action + stats.waiting_on_them + stats.family_active}</span>
        <span>Active</span>
      </div>
      {stats.needs_action > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-text-secondary">{stats.needs_action}</span>
          <span>Need action</span>
        </div>
      )}
    </div>
  )
}

/* ─── Section Label ─── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">
      {children}
    </h2>
  )
}

/* ─── Main Page ─── */

export default function TodayBriefing() {
  const { t } = useI18n()
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [calendarEvents, setCalendarEvents] = useState<UnifiedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'i_promised' | 'they_promised' | 'family'>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showScanModal, setShowScanModal] = useState(false)
  const [showAllCommitments, setShowAllCommitments] = useState(false)

  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState('')
  const [draftModal, setDraftModal] = useState<DraftData | null>(null)
  const [contactList, setContactList] = useState<Array<{ id: string; email: string; name: string | null }>>([])
  const [coolVips, setCoolVips] = useState<StaleVip[]>([])


  const fetchData = useCallback(async () => {
    const todayISO = new Date().toISOString().slice(0, 10)
    const tomorrowISO = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

    const [cRes, sRes, calRes, ctRes, weaverRes] = await Promise.all([
      fetch('/api/commitments'),
      fetch('/api/commitments/stats'),
      fetch(`/api/calendar/unified?from=${todayISO}&to=${tomorrowISO}`).catch(() => null),
      fetch('/api/contacts?limit=500').catch(() => null),
      fetch('/api/agents/weaver').catch(() => null),
    ])
    if (cRes.ok) setCommitments(await cRes.json())
    if (sRes.ok) setStats(await sRes.json())
    if (calRes?.ok) {
      const calData = await calRes.json()
      setCalendarEvents(calData.events || [])
    }
    if (ctRes?.ok) {
      const ctData = await ctRes.json()
      const contacts = Array.isArray(ctData) ? ctData : (ctData.contacts || [])
      setContactList(contacts.map((c: any) => ({ id: c.id, email: c.email, name: c.name })))
    }
    if (weaverRes?.ok) {
      try {
        const weaverData = await weaverRes.json()
        const stale = (weaverData.contacts || [])
          .filter((c: any) => c.needs_attention === true)
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            company: c.company || null,
            days_since_contact: c.days_since_contact || 14,
          }))
        setCoolVips(stale)
      } catch { /* ignore parse errors */ }
    }
    setLoading(false)
  }, [])

  const handleScan = useCallback(async () => {
    setScanning(true)
    setScanMessage('Scanning your recent emails for commitments...')
    try {
      const res = await fetch('/api/commitments/scan', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setScanMessage(`Done! Found ${data.found ?? 0} new commitment${(data.found ?? 0) !== 1 ? 's' : ''}.`)
        await fetchData()
      } else {
        setScanMessage('Scan completed. Connect your Gmail in Settings to enable scanning.')
      }
    } catch {
      setScanMessage('Could not reach the scanner. Try again later.')
    }
    setTimeout(() => { setScanning(false); setScanMessage('') }, 3000)
  }, [fetchData])

  useEffect(() => { fetchData() }, [fetchData])

  // Today's schedule — only non-commitment, non-trip events for the timeline
  const todaySchedule = useMemo(() => {
    return calendarEvents.filter(e =>
      (e.layer === 'work' || e.layer === 'family') && isToday(e.start_time)
    )
  }, [calendarEvents])

  // Most important: top 3 overdue + due-today, sorted by urgency desc
  const mostImportant = useMemo(() => {
    return commitments
      .filter(c => {
        const d = daysUntil(c.deadline)
        return d !== null && d <= 0
      })
      .sort((a, b) => b.urgency_score - a.urgency_score)
      .slice(0, 3)
  }, [commitments])

  // Waiting on them: they_promised + waiting/active status
  const waitingOnThem = useMemo(() => {
    return commitments
      .filter(c => c.type === 'they_promised' && (c.status === 'active' || c.status === 'waiting'))
      .sort((a, b) => b.urgency_score - a.urgency_score)
      .slice(0, 3)
  }, [commitments])

  // Filtered commitment list
  const filtered = filter === 'all' ? commitments : commitments.filter(c => c.type === filter)
  const overdue = filtered.filter(c => c.deadline && daysUntil(c.deadline)! < 0)
  const dueToday = filtered.filter(c => c.deadline && daysUntil(c.deadline) === 0)
  const upcoming = filtered.filter(c => !c.deadline || daysUntil(c.deadline)! > 0)

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <TopBar title="Today" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">

        {/* ─── Greeting ─── */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
            {getGreeting()}, Tiger.
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScanModal(true)}
              className="flex items-center gap-2 px-3 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Discover</span>
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('addCommitment')}</span>
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* ─── MOST IMPORTANT ─── */}
            {mostImportant.length > 0 && (
              <section>
                <SectionLabel>Most Important</SectionLabel>
                <div className="space-y-3">
                  {mostImportant.map((c) => (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <MostImportantCard c={c} onUpdate={fetchData} onDraft={setDraftModal} />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* ─── TODAY'S SCHEDULE ─── */}
            {todaySchedule.length > 0 && (
              <section>
                <SectionLabel>Today&apos;s Schedule</SectionLabel>
                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 px-4">
                  {todaySchedule.map((event) => (
                    <ScheduleEvent key={event.id} event={event} contacts={contactList} />
                  ))}
                </div>
              </section>
            )}

            {/* ─── WAITING ON THEM ─── */}
            {waitingOnThem.length > 0 && (
              <section>
                <SectionLabel>Waiting On Them</SectionLabel>
                <div className="bg-white border border-slate-200 rounded-xl px-4 divide-y divide-slate-100">
                  {waitingOnThem.map((c) => (
                    <WaitingCard key={c.id} c={c} onDraft={setDraftModal} />
                  ))}
                </div>
              </section>
            )}

            {/* ─── RECONNECT ─── */}
            {coolVips.length > 0 && (
              <section>
                <SectionLabel>Reconnect</SectionLabel>
                {coolVips.map(contact => (
                  <div key={contact.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl mb-2">
                    <div>
                      <span className="text-sm font-medium">{contact.name}</span>
                      <span className="text-xs text-text-tertiary ml-2">{contact.company ? `${contact.company} · ` : ''}{contact.days_since_contact} days</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => alert('Coming soon')}
                        className="px-3 py-1.5 text-xs font-medium bg-white border border-amber-200 rounded-lg hover:bg-amber-50"
                      >
                        📝 Send Check-in
                      </button>
                      <button
                        onClick={() => alert('Coming soon')}
                        className="px-3 py-1.5 text-xs font-medium bg-white border border-amber-200 rounded-lg hover:bg-amber-50"
                      >
                        📅 Schedule
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* ─── SOPHIA SAYS ─── */}
            {stats && <SophiaSays stats={stats} commitments={commitments} />}

            {/* ─── SCANNING INDICATOR ─── */}
            {scanning && (
              <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                <p className="text-sm text-blue-700">{scanMessage}</p>
              </div>
            )}

            {/* ─── QUICK STATS ─── */}
            {stats && <QuickStats stats={stats} />}

            {/* ─── FULL COMMITMENT LIST (collapsed by default) ─── */}
            <section>
              <button
                onClick={() => setShowAllCommitments(!showAllCommitments)}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                {showAllCommitments ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Hide commitments
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    View all {commitments.length} commitments
                  </>
                )}
              </button>

              <AnimatePresence>
                {showAllCommitments && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-6 pt-2">
                      {/* Filter tabs */}
                      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto scrollbar-hide">
                        {([
                          { key: 'all', label: t('allCommitments') },
                          { key: 'i_promised', label: t('iPromised') },
                          { key: 'they_promised', label: t('theyPromised') },
                          { key: 'family', label: t('family') },
                        ] as const).map(({ key, label }) => (
                          <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={cn('flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap min-w-0', {
                              'bg-white text-slate-900 shadow-sm': filter === key,
                              'text-slate-500 hover:text-slate-700': filter !== key,
                            })}
                          >
                            {label}
                            {key === 'family' && stats && stats.family_active > 0 && (
                              <span className="ml-1.5 px-1.5 py-0.5 bg-pink-100 text-pink-600 rounded-full text-xs">{stats.family_active}</span>
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Commitment lists */}
                      {filtered.length === 0 && (
                        <div className="flex flex-col items-center py-12 px-4">
                          <div className="p-3 bg-slate-100 rounded-2xl mb-4">
                            <Target className="w-10 h-10 text-slate-400" />
                          </div>
                          <p className="text-base font-medium text-slate-700 mb-2">
                            {commitments.length === 0 ? 'Get started with Sophia' : t('noActiveCommitments')}
                          </p>
                          {commitments.length === 0 && (
                            <>
                              <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
                                Sophia tracks your promises &mdash; what you owe others, what others owe you, and what you promised your family.
                              </p>
                              <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
                                <button
                                  onClick={handleScan}
                                  disabled={scanning}
                                  className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                                >
                                  {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                  Connect Gmail &amp; scan
                                </button>
                                <button
                                  onClick={() => setShowAddForm(true)}
                                  className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 bg-white text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                                >
                                  <Plus className="w-4 h-4" />
                                  Add manually
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {overdue.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 px-1">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <h2 className="text-sm font-semibold text-red-600">{t('overdueItems')} ({overdue.length})</h2>
                          </div>
                          {overdue.map((c) => (
                            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                              <CommitmentCard c={c} t={t} onUpdate={fetchData} onDraft={setDraftModal} />
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {dueToday.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 px-1">
                            <Clock className="w-4 h-4 text-orange-500" />
                            <h2 className="text-sm font-semibold text-orange-600">{t('dueToday')} ({dueToday.length})</h2>
                          </div>
                          {dueToday.map((c) => (
                            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                              <CommitmentCard c={c} t={t} onUpdate={fetchData} onDraft={setDraftModal} />
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {upcoming.length > 0 && (
                        <div className="space-y-2">
                          {(overdue.length > 0 || dueToday.length > 0) && (
                            <h2 className="text-sm font-semibold text-slate-500 px-1">{t('allCommitments')} ({upcoming.length})</h2>
                          )}
                          {upcoming.map((c) => (
                            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                              <CommitmentCard c={c} t={t} onUpdate={fetchData} onDraft={setDraftModal} />
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {stats && stats.period_completed > 0 && (
                        <div className="text-center pt-4">
                          <Link href="/dashboard?view=done" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                            {stats.period_completed} {t('markDone').toLowerCase()} this week
                          </Link>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </>
        )}
      </div>

      {/* Modals */}
      {showAddForm && <AddCommitmentForm onClose={() => setShowAddForm(false)} onSaved={fetchData} />}

      {draftModal && (
        <DraftEmailModal
          draft={draftModal}
          onClose={() => setDraftModal(null)}
          onSent={fetchData}
        />
      )}

      {showScanModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 relative">
            <button
              onClick={() => { setShowScanModal(false); fetchData() }}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600"
            >
              <XCircle className="w-5 h-5" />
            </button>
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-slate-900">Discover Promises</h2>
              <p className="text-sm text-slate-500">Sophia is scanning your emails for commitments...</p>
            </div>
            <CommitmentDiscovery onComplete={() => {
              setTimeout(() => { setShowScanModal(false); fetchData() }, 2000)
            }} />
          </div>
        </div>
      )}
    </div>
  )
}
