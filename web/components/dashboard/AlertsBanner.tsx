'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, AlertCircle, Info, X, ChevronDown, ChevronUp, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Alert {
  id: string
  type: string
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string
  created_at: string
  refs?: string[]
}

interface AlertResult {
  alerts: Alert[]
  summary: { high: number; medium: number; low: number; total: number }
}

const DISMISSED_KEY = 'chief_dismissed_alerts'

function getDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as { ids: string[]; ts: number }
    // Expire after 24 hours
    if (Date.now() - parsed.ts > 24 * 3_600_000) {
      localStorage.removeItem(DISMISSED_KEY)
      return new Set()
    }
    return new Set(parsed.ids)
  } catch {
    return new Set()
  }
}

function saveDismissedIds(ids: Set<string>) {
  localStorage.setItem(
    DISMISSED_KEY,
    JSON.stringify({ ids: Array.from(ids), ts: Date.now() }),
  )
}

const severityConfig = {
  high: {
    icon: AlertTriangle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconColor: 'text-red-500',
    titleColor: 'text-red-800',
    detailColor: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
  },
  medium: {
    icon: AlertCircle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-500',
    titleColor: 'text-amber-800',
    detailColor: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  },
  low: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconColor: 'text-blue-500',
    titleColor: 'text-blue-800',
    detailColor: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
  },
}

function AlertCard({
  alert,
  onDismiss,
}: {
  alert: Alert
  onDismiss: (id: string) => void
}) {
  const cfg = severityConfig[alert.severity]
  const Icon = cfg.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex items-start gap-3 p-3.5 rounded-xl border transition-colors',
        cfg.bg,
        cfg.border,
      )}
    >
      <div className={cn('mt-0.5 shrink-0', cfg.iconColor)}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold leading-tight', cfg.titleColor)}>
          {alert.title}
        </p>
        <p className={cn('text-xs mt-0.5 leading-relaxed', cfg.detailColor)}>
          {alert.detail}
        </p>
      </div>
      <button
        onClick={() => onDismiss(alert.id)}
        className={cn(
          'shrink-0 p-1 rounded-lg transition-colors hover:bg-black/5',
          cfg.iconColor,
        )}
        aria-label="Dismiss alert"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  )
}

export function AlertsBanner() {
  const [data, setData] = useState<AlertResult | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setDismissed(getDismissedIds())
  }, [])

  useEffect(() => {
    let cancelled = false
    async function fetchAlerts() {
      try {
        const res = await fetch('/api/alerts')
        if (res.ok && !cancelled) {
          const result: AlertResult = await res.json()
          setData(result)
        }
      } catch {
        // silently fail — banner just won't show
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAlerts()
    return () => { cancelled = true }
  }, [])

  const handleDismiss = useCallback(
    (id: string) => {
      setDismissed((prev) => {
        const next = new Set(prev)
        next.add(id)
        saveDismissedIds(next)
        return next
      })
    },
    [],
  )

  if (loading || !data) return null

  const visible = data.alerts.filter((a) => !dismissed.has(a.id))
  if (visible.length === 0) return null

  const COLLAPSED_LIMIT = 3
  const showToggle = visible.length > COLLAPSED_LIMIT
  const displayed = expanded ? visible : visible.slice(0, COLLAPSED_LIMIT)
  const hiddenCount = visible.length - COLLAPSED_LIMIT

  // Summary counts for visible alerts only
  const highCount = visible.filter((a) => a.severity === 'high').length
  const mediumCount = visible.filter((a) => a.severity === 'medium').length
  const lowCount = visible.filter((a) => a.severity === 'low').length

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-text-tertiary" />
        <span className="text-sm font-semibold text-text-primary">
          Alerts
        </span>
        <div className="flex items-center gap-1.5 ml-1">
          {highCount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
              {highCount} high
            </span>
          )}
          {mediumCount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {mediumCount} medium
            </span>
          )}
          {lowCount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {lowCount} low
            </span>
          )}
        </div>
      </div>

      {/* Alert cards */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {displayed.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onDismiss={handleDismiss}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Show more / less toggle */}
      {showToggle && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-text-tertiary hover:text-text-secondary transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Show {hiddenCount} more alert{hiddenCount > 1 ? 's' : ''}
            </>
          )}
        </button>
      )}
    </motion.div>
  )
}
