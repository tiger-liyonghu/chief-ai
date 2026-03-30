'use client'

import { motion } from 'framer-motion'
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
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { BriefingCard } from '@/components/dashboard/BriefingCard'

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
  compliance_rate: number
  family_compliance_rate: number
  period_total: number
  period_completed: number
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

function urgencyColor(score: number, days: number | null): string {
  if (days !== null && days < 0) return 'text-red-600 bg-red-50 border-red-200'
  if (days !== null && days === 0) return 'text-orange-600 bg-orange-50 border-orange-200'
  if (score >= 5) return 'text-red-600 bg-red-50 border-red-200'
  if (score >= 3) return 'text-orange-600 bg-orange-50 border-orange-200'
  return 'text-slate-700 bg-white border-slate-200'
}

/* ─── Commitment Card ─── */

function CommitmentCard({ c, t, onUpdate }: { c: Commitment; t: ReturnType<typeof useI18n>['t']; onUpdate: () => void }) {
  const days = daysUntil(c.deadline)
  const isOverdue = days !== null && days < 0
  const isDueToday = days === 0
  const SourceIcon = sourceIcon(c.source_type)
  const colorClass = urgencyColor(c.urgency_score, days)
  const [showActions, setShowActions] = useState(false)

  const handleAction = async (action: string) => {
    setShowActions(false)
    if (action === 'done') {
      await fetch('/api/commitments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, status: 'done' }),
      })
      // Record confirmed feedback
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
      // Mark as cancelled + record rejected feedback
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
    }
  }

  return (
    <div className={cn('border rounded-xl p-4 transition-all hover:shadow-sm relative', colorClass)}>
      <div className="flex items-start gap-3">
        {/* Type indicator */}
        <div className={cn('mt-0.5 p-1.5 rounded-lg', {
          'bg-blue-100': c.type === 'i_promised',
          'bg-amber-100': c.type === 'they_promised',
          'bg-pink-100': c.type === 'family',
        })}>
          {c.type === 'i_promised' && <ArrowUpRight className="w-4 h-4 text-blue-600" />}
          {c.type === 'they_promised' && <ArrowDownLeft className="w-4 h-4 text-amber-600" />}
          {c.type === 'family' && <Heart className="w-4 h-4 text-pink-600" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">
              {c.type === 'family' ? c.family_member : (c.contacts?.name || c.contact_name || c.contact_email)}
            </span>
            {c.contacts?.company && (
              <span className="text-xs text-slate-500 truncate">@ {c.contacts.company}</span>
            )}
          </div>
          <p className="text-sm text-slate-800 mb-2 line-clamp-2 break-words">{c.title}</p>

          {/* Meta row */}
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

          {/* Blocking chain warning */}
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

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {c.type === 'i_promised' && (
            <button
              onClick={() => handleAction('done')}
              className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition-colors"
              title={t('markDone')}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          {c.type === 'they_promised' && (
            <button
              onClick={() => {/* TODO: nudge */}}
              className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
              title={t('sendNudge')}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleAction('not_a_commitment')}
            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            title="Not a commitment"
          >
            <XCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* Dropdown */}
          {showActions && (
            <div className="absolute right-4 top-12 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
              <button onClick={() => handleAction('done')} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{t('markDone')}</button>
              <button onClick={() => handleAction('postpone')} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{t('postpone')}</button>
              <button onClick={() => handleAction('not_a_commitment')} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">Not a commitment</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Stats Banner ─── */

function StatsBanner({ stats, t }: { stats: Stats | null; t: ReturnType<typeof useI18n>['t'] }) {
  if (!stats) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="text-2xl font-bold text-blue-700">{stats.needs_action}</div>
        <div className="text-xs text-blue-600 mt-1">{t('needsYourAction')}</div>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="text-2xl font-bold text-amber-700">{stats.waiting_on_them}</div>
        <div className="text-xs text-amber-600 mt-1">{t('waitingOnThem')}</div>
      </div>
      <div className="bg-pink-50 border border-pink-200 rounded-xl p-4">
        <div className="text-2xl font-bold text-pink-700">{stats.family_active}</div>
        <div className="text-xs text-pink-600 mt-1">{t('familyCommitments')}</div>
      </div>
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <div className="flex items-center gap-1">
          <div className="text-2xl font-bold text-emerald-700">{stats.compliance_rate}%</div>
          <TrendingUp className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-xs text-emerald-600 mt-1">{t('complianceRate')}</div>
      </div>
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
          {/* Type selector */}
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

          {/* Who */}
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
              placeholder="Emily, 老婆, 儿子..."
              value={familyMember}
              onChange={(e) => setFamilyMember(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          )}

          {/* What */}
          <input
            type="text"
            placeholder={t('addCommitment')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            autoFocus
          />

          {/* When */}
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

/* ─── Chief Insight ─── */

function ChiefInsight({ stats, commitments, t }: { stats: Stats | null; commitments: Commitment[]; t: ReturnType<typeof useI18n>['t'] }) {
  if (!stats) return null

  const message = (() => {
    const overdue = commitments.filter(c => c.deadline && daysUntil(c.deadline)! < 0)

    if (overdue.length > 0) {
      // Find the most overdue commitment
      const worst = overdue.reduce((a, b) => {
        const dA = Math.abs(daysUntil(a.deadline)!)
        const dB = Math.abs(daysUntil(b.deadline)!)
        return dA > dB ? a : b
      })
      const who = worst.type === 'family'
        ? worst.family_member
        : (worst.contacts?.name || worst.contact_name || worst.contact_email || 'someone')
      const daysLate = Math.abs(daysUntil(worst.deadline)!)
      const desc = worst.title.length > 40 ? worst.title.slice(0, 40) + '...' : worst.title
      return `You have ${overdue.length} overdue commitment${overdue.length > 1 ? 's' : ''}. The one for ${who} (${desc}) is most urgent \u2014 it\u2019s been ${daysLate} day${daysLate > 1 ? 's' : ''}.`
    }

    if (stats.due_today > 0) {
      return `${stats.due_today} commitment${stats.due_today > 1 ? 's' : ''} due today. Stay on top of them and keep your streak going.`
    }

    if (stats.compliance_rate >= 90) {
      return `All clear today! Your compliance rate is at ${stats.compliance_rate}% \u2014 excellent work.`
    }

    if (stats.needs_action + stats.waiting_on_them + stats.family_active === 0) {
      return 'No active commitments right now. Scan your emails or add one manually to get started.'
    }

    return `${stats.needs_action} thing${stats.needs_action !== 1 ? 's' : ''} need your action, ${stats.waiting_on_them} waiting on others. Compliance rate: ${stats.compliance_rate}%.`
  })()

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl">
      <Sparkles className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
      <p className="text-sm text-violet-800">{message}</p>
    </div>
  )
}

/* ─── Main Page ─── */

export default function CommitmentDashboard() {
  const { t } = useI18n()
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'i_promised' | 'they_promised' | 'family'>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState('')

  const fetchData = useCallback(async () => {
    const [cRes, sRes] = await Promise.all([
      fetch('/api/commitments'),
      fetch('/api/commitments/stats'),
    ])
    if (cRes.ok) setCommitments(await cRes.json())
    if (sRes.ok) setStats(await sRes.json())
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

  const filtered = filter === 'all' ? commitments : commitments.filter(c => c.type === filter)

  // Group: overdue first, then due today, then rest
  const overdue = filtered.filter(c => c.deadline && daysUntil(c.deadline)! < 0)
  const dueToday = filtered.filter(c => c.deadline && daysUntil(c.deadline) === 0)
  const upcoming = filtered.filter(c => !c.deadline || daysUntil(c.deadline)! > 0)

  return (
    <div className="min-h-screen bg-surface-primary">
      <TopBar title={t('commitmentDashboard')} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{t('commitmentDashboard')}</h1>
              <p className="text-sm text-slate-500">
                {stats ? `${stats.needs_action + stats.waiting_on_them + stats.family_active} active` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 bg-white text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="hidden sm:inline">Scan emails</span>
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

        {/* Morning Briefing */}
        <BriefingCard />

        {/* Stats */}
        {!loading && <StatsBanner stats={stats} t={t} />}

        {/* Scanning indicator */}
        {scanning && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
            <p className="text-sm text-blue-700">{scanMessage}</p>
          </div>
        )}

        {/* Chief insight */}
        {!loading && !scanning && commitments.length > 0 && (
          <ChiefInsight stats={stats} commitments={commitments} t={t} />
        )}

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

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Commitment lists */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 px-4">
            <div className="p-3 bg-slate-100 rounded-2xl mb-4">
              <Target className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-base font-medium text-slate-700 mb-2">
              {commitments.length === 0 ? 'Get started with Chief' : t('noActiveCommitments')}
            </p>
            {commitments.length === 0 && (
              <>
                <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
                  Chief tracks your promises &mdash; what you owe others, what others owe you, and what you promised your family.
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

        {!loading && overdue.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-semibold text-red-600">{t('overdueItems')} ({overdue.length})</h2>
            </div>
            {overdue.map((c) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <CommitmentCard c={c} t={t} onUpdate={fetchData} />
              </motion.div>
            ))}
          </div>
        )}

        {!loading && dueToday.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Clock className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-semibold text-orange-600">{t('dueToday')} ({dueToday.length})</h2>
            </div>
            {dueToday.map((c) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <CommitmentCard c={c} t={t} onUpdate={fetchData} />
              </motion.div>
            ))}
          </div>
        )}

        {!loading && upcoming.length > 0 && (
          <div className="space-y-2">
            {(overdue.length > 0 || dueToday.length > 0) && (
              <h2 className="text-sm font-semibold text-slate-500 px-1">{t('allCommitments')} ({upcoming.length})</h2>
            )}
            {upcoming.map((c) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <CommitmentCard c={c} t={t} onUpdate={fetchData} />
              </motion.div>
            ))}
          </div>
        )}

        {/* Completed link */}
        {!loading && stats && stats.period_completed > 0 && (
          <div className="text-center pt-4">
            <Link href="/dashboard?view=done" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
              {stats.period_completed} {t('markDone').toLowerCase()} this week
            </Link>
          </div>
        )}
      </div>

      {/* Add form modal */}
      {showAddForm && <AddCommitmentForm onClose={() => setShowAddForm(false)} onSaved={fetchData} />}
    </div>
  )
}
