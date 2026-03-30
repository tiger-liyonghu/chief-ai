'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  Mail,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Types ─── */

interface DiscoveredCommitment {
  id: string
  type: 'i_promised' | 'they_promised'
  title: string
  contact_name: string | null
  deadline: string | null
  deadline_fuzzy: string | null
  source_type: string
}

interface CommitmentDiscoveryProps {
  onComplete: (count: number) => void
}

/* ─── Helpers ─── */

function formatDeadline(deadline: string | null, fuzzy: string | null): string | null {
  if (!deadline && !fuzzy) return null
  if (fuzzy && !deadline) return fuzzy

  const d = new Date(deadline!)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / 86400000)

  if (diffDays < 0) return `${Math.abs(diffDays)}天前到期`
  if (diffDays === 0) return '今天到期'
  if (diffDays === 1) return '明天到期'

  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  if (diffDays <= 7) return `${weekday[d.getDay()]}到期`

  return `${diffDays}天后到期`
}

/* ─── Commitment Discovery Component ─── */

export function CommitmentDiscovery({ onComplete }: CommitmentDiscoveryProps) {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle')
  const [commitments, setCommitments] = useState<DiscoveredCommitment[]>([])
  const [progress, setProgress] = useState({ processed: 0, total: 0 })
  const [stats, setStats] = useState({ i_promised: 0, they_promised: 0 })
  const [duration, setDuration] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-scroll to latest commitment
  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    setStatus('scanning')
    startTimeRef.current = Date.now()

    // Live elapsed timer
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)

    const es = new EventSource('/api/commitments/scan-stream?hours=168')

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data)

        switch (event.type) {
          case 'status':
            setProgress((prev) => ({
              ...prev,
              total: event.total ?? prev.total,
            }))
            break

          case 'progress':
            setProgress((prev) => ({
              processed: event.processed ?? prev.processed,
              total: event.total ?? prev.total,
            }))
            break

          case 'commitment': {
            const c: DiscoveredCommitment = {
              id: event.id ?? crypto.randomUUID(),
              type: event.commitment_type ?? event.type_detail ?? 'i_promised',
              title: event.title ?? '',
              contact_name: event.contact_name ?? null,
              deadline: event.deadline ?? null,
              deadline_fuzzy: event.deadline_fuzzy ?? null,
              source_type: event.source_type ?? 'email',
            }
            setCommitments((prev) => [...prev, c])
            setStats((prev) => ({
              i_promised: prev.i_promised + (c.type === 'i_promised' ? 1 : 0),
              they_promised: prev.they_promised + (c.type === 'they_promised' ? 1 : 0),
            }))
            // Scroll after render
            setTimeout(scrollToBottom, 50)
            break
          }

          case 'done':
            setStatus('done')
            setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
            if (timerRef.current) clearInterval(timerRef.current)
            es.close()
            break
        }
      } catch {
        // Ignore malformed messages
      }
    }

    es.onerror = () => {
      es.close()
      if (timerRef.current) clearInterval(timerRef.current)
      // If we already got some commitments, treat as done
      setStatus((prev) => {
        if (prev === 'done') return prev
        setCommitments((cList) => {
          if (cList.length > 0) return cList
          setErrorMessage('无法连接到扫描服务，请检查网络后重试。')
          return cList
        })
        return 'done'
      })
    }

    return () => {
      es.close()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [scrollToBottom])

  const totalFound = stats.i_promised + stats.they_promised
  const progressPercent =
    progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div
              className={cn(
                'p-2.5 rounded-xl',
                status === 'done' ? 'bg-emerald-100' : 'bg-indigo-100'
              )}
            >
              {status === 'done' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <Search className="w-5 h-5 text-indigo-600 animate-pulse" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {status === 'done' ? '扫描完成！' : '正在扫描你的邮件...'}
              </h2>
              <p className="text-sm text-slate-500">
                {status === 'done'
                  ? `${duration}秒内发现 ${totalFound} 个承诺`
                  : `过去7天的邮件 · ${duration}秒`}
              </p>
            </div>
          </div>

          {/* ── Progress Bar ── */}
          {status === 'scanning' && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                  扫描中...
                </span>
                <span>
                  {progress.processed}/{progress.total > 0 ? progress.total : '—'} 封
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
                {progress.total > 0 ? (
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                ) : (
                  <div className="absolute inset-0 overflow-hidden rounded-full">
                    <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 animate-pulse" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Completed Progress Bar ── */}
          {status === 'done' && (
            <div className="mb-4">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 w-full transition-all duration-700" />
              </div>
            </div>
          )}

          {/* ── Stats Counters ── */}
          {totalFound > 0 && (
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                <ArrowUpRight className="w-4 h-4 text-blue-600" />
                <div>
                  <div className="text-lg font-bold text-blue-700 leading-tight">
                    {stats.i_promised}
                  </div>
                  <div className="text-xs text-blue-600">你承诺的</div>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                <ArrowDownLeft className="w-4 h-4 text-amber-600" />
                <div>
                  <div className="text-lg font-bold text-amber-700 leading-tight">
                    {stats.they_promised}
                  </div>
                  <div className="text-xs text-amber-600">等对方的</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Commitment List ── */}
        {commitments.length > 0 && (
          <div className="px-6 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                新发现
              </span>
              <span className="text-xs text-slate-400">({totalFound})</span>
            </div>
          </div>
        )}

        {commitments.length > 0 && (
          <div
            ref={listRef}
            className="px-6 pb-4 max-h-80 overflow-y-auto scroll-smooth"
            role="list"
            aria-label="发现的承诺"
          >
            <div className="space-y-2">
              {commitments.map((c, index) => (
                <CommitmentItem key={c.id} commitment={c} index={index} />
              ))}
            </div>
          </div>
        )}

        {/* ── Empty scanning state ── */}
        {status === 'scanning' && commitments.length === 0 && progress.processed > 0 && (
          <div className="px-6 pb-6">
            <div className="flex items-center justify-center py-8 text-slate-400">
              <div className="text-center">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">正在分析邮件内容...</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Error State ── */}
        {status === 'done' && errorMessage && totalFound === 0 && (
          <div className="px-6 pb-6">
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* ── Footer / CTA ── */}
        {status === 'done' && (
          <div className="px-6 pb-6">
            <button
              onClick={() => onComplete(totalFound)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              进入承诺仪表盘
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

    </div>
  )
}

/* ─── Individual Commitment Card ─── */

function CommitmentItem({
  commitment,
  index,
}: {
  commitment: DiscoveredCommitment
  index: number
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Stagger the entrance animation
    const timer = setTimeout(() => setVisible(true), Math.min(index * 60, 300))
    return () => clearTimeout(timer)
  }, [index])

  const isIPromised = commitment.type === 'i_promised'
  const deadlineLabel = formatDeadline(commitment.deadline, commitment.deadline_fuzzy)

  return (
    <div
      role="listitem"
      className={cn(
        'flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all duration-300 ease-out',
        isIPromised
          ? 'bg-blue-50/70 border-blue-200 hover:bg-blue-50'
          : 'bg-amber-50/70 border-amber-200 hover:bg-amber-50',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
    >
      {/* Type indicator */}
      <div
        className={cn(
          'p-1.5 rounded-lg shrink-0',
          isIPromised ? 'bg-blue-100' : 'bg-amber-100'
        )}
      >
        {isIPromised ? (
          <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
        ) : (
          <ArrowDownLeft className="w-3.5 h-3.5 text-amber-600" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{commitment.title}</p>
        {commitment.contact_name && (
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {isIPromised ? '给 ' : ''}
            {commitment.contact_name}
          </p>
        )}
      </div>

      {/* Deadline badge */}
      {deadlineLabel && (
        <span
          className={cn(
            'shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg',
            isIPromised ? 'text-blue-700 bg-blue-100' : 'text-amber-700 bg-amber-100'
          )}
        >
          <Clock className="w-3 h-3" />
          {deadlineLabel}
        </span>
      )}
    </div>
  )
}
