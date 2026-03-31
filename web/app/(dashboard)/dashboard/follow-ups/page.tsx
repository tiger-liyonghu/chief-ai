'use client'

import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { ArrowDownLeft, Clock, AlertTriangle, CheckCircle2, Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Commitment {
  id: string
  title: string
  type: string
  contact_name: string | null
  contact_email: string | null
  deadline: string | null
  deadline_fuzzy: string | null
  status: string
  urgency_score: number
  created_at: string
}

export default function FollowUpsPage() {
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/commitments?type=they_promised&status=pending,in_progress,waiting,overdue')
      .then(r => r.json())
      .then(data => setCommitments(data.commitments || data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleNudge = async (id: string) => {
    await fetch(`/api/commitments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, last_nudge_at: new Date().toISOString() }),
    })
  }

  const handleMarkDone = async (id: string) => {
    await fetch(`/api/commitments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'done' }),
    })
    setCommitments(prev => prev.filter(c => c.id !== id))
  }

  const getDaysLabel = (deadline: string | null) => {
    if (!deadline) return null
    const days = Math.round((new Date(deadline).getTime() - Date.now()) / 86400000)
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: 'text-red-600 bg-red-50' }
    if (days === 0) return { text: 'Due today', color: 'text-orange-600 bg-orange-50' }
    if (days === 1) return { text: 'Tomorrow', color: 'text-amber-600 bg-amber-50' }
    return { text: `${days}d left`, color: 'text-slate-500 bg-slate-50' }
  }

  const overdue = commitments.filter(c => c.status === 'overdue')
  const active = commitments.filter(c => c.status !== 'overdue')

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar title="Follow-ups" />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-100 rounded-lg">
            <ArrowDownLeft className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Waiting On Others</h1>
            <p className="text-sm text-slate-500">Commitments others have made to you</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : commitments.length === 0 ? (
          <div className="text-center py-20">
            <ArrowDownLeft className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h2 className="text-lg font-medium text-slate-600">No pending follow-ups</h2>
            <p className="text-sm text-slate-400 mt-1">When others promise you something, Chief will track it here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {overdue.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Overdue ({overdue.length})
                </h2>
                <div className="space-y-2">
                  {overdue.map(c => (
                    <CommitmentRow key={c.id} c={c} getDaysLabel={getDaysLabel} onNudge={handleNudge} onDone={handleMarkDone} />
                  ))}
                </div>
              </div>
            )}

            {active.length > 0 && (
              <div>
                {overdue.length > 0 && (
                  <h2 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-1.5 mt-6">
                    <Clock className="w-4 h-4" /> Pending ({active.length})
                  </h2>
                )}
                <div className="space-y-2">
                  {active.map(c => (
                    <CommitmentRow key={c.id} c={c} getDaysLabel={getDaysLabel} onNudge={handleNudge} onDone={handleMarkDone} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CommitmentRow({ c, getDaysLabel, onNudge, onDone }: {
  c: Commitment
  getDaysLabel: (d: string | null) => { text: string; color: string } | null
  onNudge: (id: string) => void
  onDone: (id: string) => void
}) {
  const dl = getDaysLabel(c.deadline)

  return (
    <div className={cn(
      'bg-white border rounded-xl p-4 transition-all hover:shadow-sm',
      c.status === 'overdue' ? 'border-red-200' : 'border-slate-200'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{c.title}</p>
          {c.contact_name && (
            <p className="text-xs text-slate-500 mt-0.5">From: {c.contact_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dl && (
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', dl.color)}>
              {dl.text}
            </span>
          )}
          {c.deadline_fuzzy && !c.deadline && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-500">{c.deadline_fuzzy}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        {c.contact_email && (
          <button
            onClick={() => onNudge(c.id)}
            className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors flex items-center gap-1"
          >
            <Send className="w-3 h-3" /> Nudge
          </button>
        )}
        <button
          onClick={() => onDone(c.id)}
          className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1"
        >
          <CheckCircle2 className="w-3 h-3" /> Received
        </button>
      </div>
    </div>
  )
}
