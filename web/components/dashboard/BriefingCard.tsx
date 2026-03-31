'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  RefreshCw,
  Loader2,
  AlertCircle,
  Calendar,
  Zap,
  Compass,
  Clock,
  MoreHorizontal,
  PenLine,
  CheckCircle2,
  Send,
  XCircle,
  AlertTriangle,
  Mail,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

/* ─── Types ─── */

interface BriefingScore {
  meetings: number
  actions_pending: number
  overdue: number
  compliance_rate: number
  trend: 'improving' | 'stable' | 'declining'
}

interface BriefingData {
  briefing: string
  generated_at: string
  cached: boolean
  score?: BriefingScore | null
}

interface TodayItem {
  time: string
  title: string
  context: string
  hasConflict: boolean
}

interface ActionItem {
  color: 'red' | 'yellow' | 'green'
  person: string
  title: string
  deadline: string
  note: string
  raw: string
}

interface ParsedBriefing {
  today: TodayItem[]
  action: ActionItem[]
  horizon: string
}

/* ─── Draft Email Modal (self-contained) ─── */

interface DraftData {
  to: string
  subject: string
  body: string
  fromEmail?: string | null
  tone?: string
  actionItemPerson: string
  actionItemTitle: string
}

function BriefingDraftModal({ draft, onClose, onSent }: { draft: DraftData; onClose: () => void; onSent: () => void }) {
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
            <Mail className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold">
              {sent ? 'Email Sent' : `Draft to ${draft.actionItemPerson}`}
            </h3>
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
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
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
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}

/* ─── Parsing ─── */

function parseTodayItem(line: string): TodayItem {
  const hasConflict = line.includes('⚠️') || line.includes('⚠')
  // Clean markers
  let cleaned = line.replace(/^[-•]\s*/, '').replace(/⚠️?\s*/g, '').trim()

  // Try to extract [time] [title] — [context]
  const dashMatch = cleaned.match(/^(\d{1,2}[:.]\d{2}\s*(?:AM|PM|am|pm)?(?:\s*[-–]\s*\d{1,2}[:.]\d{2}\s*(?:AM|PM|am|pm)?)?)\s+(.+?)(?:\s*[—–-]\s*(.+))?$/)
  if (dashMatch) {
    return {
      time: dashMatch[1].trim(),
      title: dashMatch[2].trim(),
      context: dashMatch[3]?.trim() || '',
      hasConflict,
    }
  }

  // Try bracket format: [time] [rest]
  const bracketMatch = cleaned.match(/^\[([^\]]+)\]\s*(.+?)(?:\s*[—–-]\s*(.+))?$/)
  if (bracketMatch) {
    return {
      time: bracketMatch[1].trim(),
      title: bracketMatch[2].trim(),
      context: bracketMatch[3]?.trim() || '',
      hasConflict,
    }
  }

  // Fallback: first word-like chunk as time
  const simpleMatch = cleaned.match(/^(\S+(?:\s*(?:AM|PM|am|pm))?)\s+(.+?)(?:\s*[—–-]\s*(.+))?$/)
  if (simpleMatch) {
    return {
      time: simpleMatch[1].trim(),
      title: simpleMatch[2].trim(),
      context: simpleMatch[3]?.trim() || '',
      hasConflict,
    }
  }

  return { time: '', title: cleaned, context: '', hasConflict }
}

function parseActionItem(line: string): ActionItem {
  let cleaned = line.replace(/^[-•]\s*/, '').trim()

  // Detect color
  let color: ActionItem['color'] = 'yellow'
  if (cleaned.startsWith('🔴')) { color = 'red'; cleaned = cleaned.replace('🔴', '').trim() }
  else if (cleaned.startsWith('🟡')) { color = 'yellow'; cleaned = cleaned.replace('🟡', '').trim() }
  else if (cleaned.startsWith('🟢')) { color = 'green'; cleaned = cleaned.replace('🟢', '').trim() }

  // Try: [person] [thing] — [deadline], [note]
  const dashMatch = cleaned.match(/^(.+?)\s+(.+?)(?:\s*[—–-]\s*(.+))?$/)
  if (dashMatch) {
    const person = dashMatch[1].trim()
    const title = dashMatch[2].trim()
    const afterDash = dashMatch[3]?.trim() || ''
    // Split deadline and note by comma
    const commaIdx = afterDash.indexOf(',')
    const deadline = commaIdx >= 0 ? afterDash.slice(0, commaIdx).trim() : afterDash
    const note = commaIdx >= 0 ? afterDash.slice(commaIdx + 1).trim() : ''
    return { color, person, title, deadline, note, raw: cleaned }
  }

  // Fallback: first word as person, rest as title
  const words = cleaned.split(/\s+/)
  return {
    color,
    person: words[0] || '',
    title: words.slice(1).join(' '),
    deadline: '',
    note: '',
    raw: cleaned,
  }
}

function parseBriefing(text: string): ParsedBriefing | null {
  // Check if text follows 3-3-3 format: must have at least one of TODAY/ACTION/HORIZON headers
  if (!text.match(/^(TODAY|ACTION|HORIZON)/m)) {
    return null
  }

  const sections: ParsedBriefing = { today: [], action: [], horizon: '' }
  const lines = text.split('\n')
  let currentSection = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed === 'TODAY' || trimmed.startsWith('TODAY')) {
      currentSection = 'today'
      continue
    }
    if (trimmed === 'ACTION' || trimmed.startsWith('ACTION')) {
      currentSection = 'action'
      continue
    }
    if (trimmed === 'HORIZON' || trimmed.startsWith('HORIZON')) {
      currentSection = 'horizon'
      continue
    }
    // Footer separator
    if (trimmed.startsWith('━') || trimmed.startsWith('---')) {
      currentSection = 'footer'
      continue
    }

    if (currentSection === 'today') {
      sections.today.push(parseTodayItem(trimmed))
    } else if (currentSection === 'action') {
      sections.action.push(parseActionItem(trimmed))
    } else if (currentSection === 'horizon') {
      sections.horizon += (sections.horizon ? ' ' : '') + trimmed
    }
  }

  return sections
}

/* ─── Score Badge ─── */

function ScoreBadge({ score }: { score: BriefingScore }) {
  const rate = score.compliance_rate
  const colorClass = rate >= 90
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : rate >= 70
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-red-100 text-red-700 border-red-200'

  const TrendIcon = score.trend === 'improving'
    ? TrendingUp
    : score.trend === 'declining'
      ? TrendingDown
      : ArrowRight

  const trendColor = score.trend === 'improving'
    ? 'text-emerald-600'
    : score.trend === 'declining'
      ? 'text-red-500'
      : 'text-slate-400'

  return (
    <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border', colorClass)}>
      <span>{Math.round(rate)}%</span>
      <TrendIcon className={cn('w-3 h-3', trendColor)} />
    </div>
  )
}

/* ─── Action Item Dropdown ─── */

function ActionDropdown({ onPostpone, onDone }: { onPostpone: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 transition-colors"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 min-w-[100px]"
          >
            <button
              onClick={() => { setOpen(false); onPostpone() }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {t('postponeBriefing')}
            </button>
            <button
              onClick={() => { setOpen(false); onDone() }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {t('markDoneBriefing')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Main Component ─── */

export function BriefingCard() {
  const { t } = useI18n()
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [draftModal, setDraftModal] = useState<DraftData | null>(null)
  const [draftLoading, setDraftLoading] = useState<string | null>(null)

  const fetchBriefing = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(false)

    try {
      const url = refresh ? '/api/briefing?refresh=1' : '/api/briefing'
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json)
    } catch {
      // Build a data-only fallback briefing from raw APIs
      try {
        const [commRes, calRes] = await Promise.allSettled([
          fetch('/api/commitments?status=pending,in_progress,waiting,overdue').then(r => r.json()),
          fetch('/api/calendar').then(r => r.json()),
        ])
        const comms = commRes.status === 'fulfilled' ? (commRes.value.commitments || commRes.value || []) : []
        const events = calRes.status === 'fulfilled' ? (calRes.value.events || calRes.value || []) : []

        const overdue = comms.filter((c: any) => c.status === 'overdue')
        const dueToday = comms.filter((c: any) => c.deadline === new Date().toISOString().split('T')[0])
        const iPromised = comms.filter((c: any) => c.type === 'i_promised')

        const todayLines = events.slice(0, 3).map((e: any) =>
          `${e.start_time || ''} — ${e.title || e.summary || 'Meeting'}`
        ).join('\n') || 'No meetings today'

        const actionLines = [
          ...overdue.slice(0, 2).map((c: any) => `🔴 ${c.contact_name || 'Someone'}: ${c.title} (overdue)`),
          ...dueToday.slice(0, 1).map((c: any) => `🟡 ${c.contact_name || 'Someone'}: ${c.title} (due today)`),
          ...iPromised.filter((c: any) => c.status !== 'overdue' && c.deadline !== new Date().toISOString().split('T')[0]).slice(0, 1).map((c: any) => `🟢 ${c.contact_name || 'Someone'}: ${c.title}`),
        ].join('\n') || 'No urgent actions'

        const fallbackBriefing = `## TODAY\n${todayLines}\n\n## ACTION\n${actionLines}\n\n## HORIZON\nChief is syncing your data for a full briefing.`

        setData({
          briefing: fallbackBriefing,
          generated_at: new Date().toISOString(),
          cached: false,
          score: {
            meetings: events.length,
            actions_pending: iPromised.length,
            overdue: overdue.length,
            compliance_rate: comms.length > 0 ? Math.round(((comms.length - overdue.length) / comms.length) * 100) : 100,
            trend: 'stable' as const,
          },
        })
      } catch {
        setError(true)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchBriefing() }, [fetchBriefing])

  const timeAgo = data?.generated_at ? formatTimeAgo(data.generated_at) : ''

  /* ─── Draft action handler ─── */
  const handleDraft = async (item: ActionItem) => {
    setDraftLoading(item.raw)
    try {
      const res = await fetch('/api/briefing/draft-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person: item.person,
          title: item.title,
          deadline: item.deadline,
          note: item.note,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.draft) {
          setDraftModal({
            to: data.draft.to || '',
            subject: data.draft.subject || `Re: ${item.title}`,
            body: data.draft.body || '',
            fromEmail: data.fromEmail,
            actionItemPerson: item.person,
            actionItemTitle: item.title,
          })
        }
      }
    } catch { /* ignore */ }
    setDraftLoading(null)
  }

  /* ─── Greeting ─── */
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 border border-indigo-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
          <span className="text-sm font-medium text-indigo-700">{t('briefingLoading')}</span>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-indigo-100 rounded-full w-full animate-pulse" />
          <div className="h-3 bg-indigo-100 rounded-full w-4/5 animate-pulse" />
          <div className="h-3 bg-indigo-100 rounded-full w-3/5 animate-pulse" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700">{t('briefingError')}</span>
          </div>
          <button
            onClick={() => fetchBriefing(true)}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            {t('briefingRefresh')}
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const parsed = parseBriefing(data.briefing)

  // Fallback: if not parseable as 3-3-3, render as plain text
  if (!parsed) {
    return (
      <div className="bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 border border-indigo-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 rounded-lg">
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <h3 className="text-sm font-semibold text-indigo-900">{t('dailyBriefing')}</h3>
          </div>
          <div className="flex items-center gap-2">
            {timeAgo && (
              <span className="text-xs text-indigo-400">
                {t('briefingCached', { time: timeAgo })}
              </span>
            )}
            <button
              onClick={() => fetchBriefing(true)}
              disabled={refreshing}
              className={cn(
                'p-1.5 rounded-lg text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 transition-colors',
                refreshing && 'animate-spin'
              )}
              title={t('briefingRefresh')}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="text-sm text-indigo-900 leading-relaxed whitespace-pre-line">
          {data.briefing}
        </div>
      </div>
    )
  }

  /* ─── Structured 3-3-3 Render ─── */
  return (
    <>
      <div className="bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 border border-indigo-200 rounded-2xl overflow-hidden">
        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-indigo-100 rounded-lg">
                <Sparkles className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-indigo-900">{getGreeting()}</h3>
                <p className="text-xs text-indigo-400">{todayFormatted}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {data.score && <ScoreBadge score={data.score} />}
              <button
                onClick={() => fetchBriefing(true)}
                disabled={refreshing}
                className={cn(
                  'p-1.5 rounded-lg text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 transition-colors',
                  refreshing && 'animate-spin'
                )}
                title={t('briefingRefresh')}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── TODAY Section ── */}
        {parsed.today.length > 0 && (
          <div className="px-5 pb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Today</span>
            </div>
            <div className="space-y-1.5">
              {parsed.today.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2.5 px-3 py-2 rounded-lg text-sm',
                    item.hasConflict
                      ? 'bg-amber-50 border border-amber-200'
                      : 'bg-white/60 border border-indigo-100'
                  )}
                >
                  <span className={cn(
                    'text-xs font-mono font-medium mt-0.5 shrink-0 min-w-[52px]',
                    item.hasConflict ? 'text-amber-600' : 'text-indigo-500'
                  )}>
                    {item.time}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-indigo-900 font-medium">{item.title}</span>
                    {item.context && (
                      <span className="text-indigo-400 text-xs ml-1.5">{item.context}</span>
                    )}
                    {item.hasConflict && (
                      <span className="inline-flex items-center gap-0.5 text-amber-600 text-xs ml-1.5 font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        conflict
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ACTION Section ── */}
        {parsed.action.length > 0 && (
          <div className="px-5 pb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Action</span>
            </div>
            <div className="space-y-1.5">
              {parsed.action.map((item, i) => {
                const dotColor = item.color === 'red'
                  ? 'bg-red-500'
                  : item.color === 'yellow'
                    ? 'bg-amber-400'
                    : 'bg-emerald-500'

                const rowBg = item.color === 'red'
                  ? 'bg-red-50/60 border-red-100'
                  : item.color === 'yellow'
                    ? 'bg-amber-50/40 border-amber-100'
                    : 'bg-emerald-50/40 border-emerald-100'

                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm',
                      rowBg
                    )}
                  >
                    {/* Color dot */}
                    <div className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-slate-800">{item.person}</span>
                      <span className="text-slate-600 ml-1">{item.title}</span>
                      {item.deadline && (
                        <span className="text-slate-400 text-xs ml-1.5">
                          <Clock className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                          {item.deadline}
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {item.color === 'green' ? (
                        <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 font-medium px-2 py-0.5 rounded-full bg-emerald-100">
                          <CheckCircle2 className="w-3 h-3" />
                          Done
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleDraft(item)}
                            disabled={draftLoading === item.raw}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                          >
                            {draftLoading === item.raw ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <PenLine className="w-3 h-3" />
                            )}
                            Draft
                          </button>
                          <ActionDropdown
                            onPostpone={async () => {
                              try {
                                const res = await fetch(`/api/commitments?contact_name=${encodeURIComponent(item.person)}&status=pending,in_progress,waiting,overdue&limit=1`)
                                const comms = await res.json()
                                const c = Array.isArray(comms) ? comms[0] : comms?.commitments?.[0]
                                if (c?.id) {
                                  const newDeadline = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
                                  await fetch('/api/commitments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, deadline: newDeadline, status: 'pending' }) })
                                }
                              } catch {}
                            }}
                            onDone={async () => {
                              try {
                                const res = await fetch(`/api/commitments?contact_name=${encodeURIComponent(item.person)}&status=pending,in_progress,waiting,overdue&limit=1`)
                                const comms = await res.json()
                                const c = Array.isArray(comms) ? comms[0] : comms?.commitments?.[0]
                                if (c?.id) {
                                  await fetch('/api/commitments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, status: 'done' }) })
                                }
                              } catch {}
                            }}
                          />
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── HORIZON Section ── */}
        {parsed.horizon && (
          <div className="px-5 pb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Horizon</span>
            </div>
            <p className="text-xs text-indigo-700/70 leading-relaxed pl-5">
              {parsed.horizon}
            </p>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="px-5 py-2.5 bg-indigo-100/30 border-t border-indigo-100 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-indigo-400">
            {data.score && (
              <>
                <span>{data.score.meetings} meetings</span>
                <span className="text-indigo-200">|</span>
                <span>{data.score.actions_pending} pending</span>
                {data.score.overdue > 0 && (
                  <>
                    <span className="text-indigo-200">|</span>
                    <span className="text-red-400">{data.score.overdue} overdue</span>
                  </>
                )}
              </>
            )}
          </div>
          <span className="text-xs text-indigo-400">
            {timeAgo ? t('briefingCached', { time: timeAgo }) : ''}
          </span>
        </div>
      </div>

      {/* Draft email modal */}
      {draftModal && (
        <BriefingDraftModal
          draft={draftModal}
          onClose={() => setDraftModal(null)}
          onSent={() => {
            setDraftModal(null)
            fetchBriefing(true)
          }}
        />
      )}
    </>
  )
}

/* ─── Helpers ─── */

function formatTimeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
