'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sparkles, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

interface BriefingData {
  briefing: string
  generated_at: string
  cached: boolean
}

export function BriefingCard() {
  const { t } = useI18n()
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchBriefing = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(false)

    try {
      const url = refresh ? '/api/briefing?refresh=1' : '/api/briefing'
      const res = await fetch(url)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchBriefing() }, [fetchBriefing])

  const timeAgo = data?.generated_at
    ? formatTimeAgo(data.generated_at)
    : ''

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

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 border border-indigo-200 rounded-2xl p-5">
      {/* Header */}
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

      {/* Briefing content — rendered as structured text */}
      <div className="text-sm text-indigo-900 leading-relaxed whitespace-pre-line">
        {data.briefing}
      </div>
    </div>
  )
}

function formatTimeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
