'use client'

import { motion } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import {
  CheckCircle,
  Clock,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  ListTodo,
  AlertTriangle,
  Check,
  Send,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'
import { SkeletonCard } from '@/components/ui/Skeleton'

/**
 * Unified Commitments page — replaces Tasks + Follow-ups.
 *
 * Manifesto: "客户不丢 — 你答应客户的每一件事，Sophia 都记着。"
 *
 * Three tabs:
 * - I Promised (i_promised) — things I need to do
 * - Waiting On (they_promised) — things others need to do for me
 * - All — everything, sorted by urgency
 */

type Tab = 'i_promised' | 'waiting_on_them' | 'all'
type StatusFilter = 'active' | 'overdue' | 'completed' | 'all'

interface Commitment {
  id: string
  type: 'i_promised' | 'they_promised'
  title: string
  contact_name: string | null
  contact_email: string | null
  deadline: string | null
  status: string
  urgency_score: number
  context: string | null
  confidence_label: string | null
  created_at: string
}

export default function CommitmentsPage() {
  const { t } = useI18n()
  // Default to 'all' tab + 'all' status so new users see everything immediately
  // Prevents the "empty page" confusion when all commitments are overdue (not "active")
  const [tab, setTab] = useState<Tab>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, overdue: 0, completed: 0, active: 0 })

  const fetchCommitments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (tab !== 'all') params.set('type', tab === 'i_promised' ? 'i_promised' : 'they_promised')
      if (statusFilter !== 'all') {
        if (statusFilter === 'active') params.set('status', 'pending,in_progress')
        else if (statusFilter === 'overdue') params.set('status', 'overdue')
        else if (statusFilter === 'completed') params.set('status', 'done,completed')
      }

      const res = await fetch(`/api/commitments?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCommitments(data.commitments || data || [])
      }

      // Fetch stats
      const statsRes = await fetch('/api/commitments/stats')
      if (statsRes.ok) {
        const s = await statsRes.json()
        setStats({
          total: s.total || 0,
          overdue: s.overdue || 0,
          completed: s.completed || 0,
          active: s.active || 0,
        })
      }
    } catch (err) {
      console.error('Failed to fetch commitments:', err)
    }
    setLoading(false)
  }, [tab, statusFilter])

  useEffect(() => { fetchCommitments() }, [fetchCommitments])

  const handleMarkDone = async (id: string) => {
    await fetch('/api/commitments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'done' }),
    })
    fetchCommitments()
  }

  const handleNudge = async (id: string) => {
    await fetch('/api/commitments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, last_nudge_at: new Date().toISOString() }),
    })
    // Could trigger Closer Agent here for draft generation
  }

  const tabs: Array<{ key: Tab; label: string; icon: any }> = [
    { key: 'i_promised', label: 'I Promised', icon: ArrowUpRight },
    { key: 'waiting_on_them', label: 'Waiting On', icon: ArrowDownLeft },
    { key: 'all', label: 'All', icon: ListTodo },
  ]

  return (
    <>
      <TopBar title="Commitments" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 sm:p-6 max-w-4xl mx-auto"
      >
        {/* Stats bar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-slate-900">{stats.active}</div>
            <div className="text-xs text-slate-500">Active</div>
          </div>
          <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <div className="text-xs text-red-500">Overdue</div>
          </div>
          <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-xs text-emerald-500">Done</div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 mb-4">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all',
                tab === key
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2 mb-4">
          {(['active', 'overdue', 'completed', 'all'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                statusFilter === f
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              )}
            >
              {f === 'active' ? 'Active' : f === 'overdue' ? 'Overdue' : f === 'completed' ? 'Done' : 'All'}
            </button>
          ))}
        </div>

        {/* Commitment list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : commitments.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No commitments here. Nothing to worry about.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {commitments.map(c => {
              const isOverdue = c.status === 'overdue' || (c.deadline && new Date(c.deadline) < new Date() && c.status !== 'done' && c.status !== 'completed')
              const isIPromised = c.type === 'i_promised'
              const daysLeft = c.deadline
                ? Math.ceil((new Date(c.deadline).getTime() - Date.now()) / 86400000)
                : null

              return (
                <div
                  key={c.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border transition-all',
                    isOverdue
                      ? 'bg-red-50 border-red-200'
                      : isIPromised
                        ? 'bg-blue-50/50 border-blue-200'
                        : 'bg-amber-50/50 border-amber-200',
                  )}
                >
                  {/* Type indicator */}
                  <div className={cn(
                    'p-1.5 rounded-lg shrink-0',
                    isIPromised ? 'bg-blue-100' : 'bg-amber-100'
                  )}>
                    {isIPromised
                      ? <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                      : <ArrowDownLeft className="w-3.5 h-3.5 text-amber-600" />
                    }
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.contact_name && (
                        <span className="text-xs text-slate-500">{c.contact_name}</span>
                      )}
                      {c.context === 'family' && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-pink-100 text-pink-700 rounded-full">Family</span>
                      )}
                      {c.confidence_label === 'tentative' && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full">Tentative</span>
                      )}
                    </div>
                  </div>

                  {/* Deadline */}
                  {daysLeft !== null && (
                    <span className={cn(
                      'text-xs font-medium px-2 py-1 rounded-lg shrink-0 flex items-center gap-1',
                      isOverdue ? 'bg-red-100 text-red-700' :
                      daysLeft <= 1 ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    )}>
                      <Clock className="w-3 h-3" />
                      {isOverdue ? `${Math.abs(daysLeft)}d overdue` :
                       daysLeft === 0 ? 'Today' :
                       daysLeft === 1 ? 'Tomorrow' :
                       `${daysLeft}d`}
                    </span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!isIPromised && c.status !== 'done' && c.status !== 'completed' && (
                      <button
                        onClick={() => handleNudge(c.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        title="Send nudge"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {c.status !== 'done' && c.status !== 'completed' && (
                      <button
                        onClick={() => handleMarkDone(c.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-emerald-100 hover:text-emerald-600"
                        title="Mark done"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>
    </>
  )
}
