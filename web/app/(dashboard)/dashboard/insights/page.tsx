'use client'

import { motion } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import {
  TrendingUp,
  Target,
  Users,
  Plane,
  Heart,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
} from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

/* ─── Types ─── */

interface InsightsSnapshot {
  id: string
  period_type: string
  period_start: string
  period_end: string
  commitment_stats: {
    total: number
    completed: number
    overdue: number
    pending: number
    compliance_rate: number
    family_total: number
    family_completed: number
    family_compliance_rate: number
  }
  relationship_stats: {
    active_contacts: number
    total_contacts: number
    cold_vips: Array<{ name: string; company: string; days_since: number }>
  }
  travel_stats: {
    trips_count: number
    total_days: number
    total_expense: number
    cities: string[]
  }
  family_stats: {
    events_in_period: number
    conflicts_detected: number
    family_commitments_kept: number
    family_commitments_total: number
  }
  content: string | null
  created_at: string
}

/* ─── Stat Card ─── */

function StatCard({ icon: Icon, label, value, subtext, color }: {
  icon: typeof Target; label: string; value: string | number; subtext?: string; color: string
}) {
  return (
    <div className={cn('border rounded-xl p-4', color)}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium opacity-70">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtext && <div className="text-xs opacity-60 mt-1">{subtext}</div>}
    </div>
  )
}

/* ─── Main Page ─── */

export default function InsightsPage() {
  const { t } = useI18n()
  const [snapshots, setSnapshots] = useState<InsightsSnapshot[]>([])
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/insights?period=${period}`)
    if (res.ok) setSnapshots(await res.json())
    setLoading(false)
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  const handleGenerate = async () => {
    setGenerating(true)
    await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period }),
    })
    await fetchData()
    setGenerating(false)
  }

  const latest = snapshots[0]

  return (
    <div className="min-h-screen bg-surface-primary">
      <TopBar title={t('insightsTitle')} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{t('insightsTitle')}</h1>
              <p className="text-sm text-slate-500">{snapshots.length} reports</p>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', generating && 'animate-spin')} />
            {t('generateReport')}
          </button>
        </div>

        {/* Period tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {(['weekly', 'monthly'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn('py-2 px-4 rounded-lg text-sm font-medium transition-colors', {
                'bg-white text-slate-900 shadow-sm': period === p,
                'text-slate-500 hover:text-slate-700': period !== p,
              })}
            >
              {p === 'weekly' ? t('weeklyReport') : t('monthlyReport')}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        )}

        {/* Empty */}
        {!loading && !latest && (
          <div className="text-center py-16 text-slate-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('noInsightsYet')}</p>
          </div>
        )}

        {/* Latest snapshot */}
        {latest && (
          <>
            <div className="text-xs text-slate-400">
              {latest.period_start} → {latest.period_end}
            </div>

            {/* Commitment Health */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Target className="w-4 h-4" /> {t('commitmentHealth')}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  icon={CheckCircle2}
                  label={t('complianceRate')}
                  value={`${latest.commitment_stats.compliance_rate}%`}
                  color="bg-emerald-50 border-emerald-200 text-emerald-700"
                />
                <StatCard
                  icon={Target}
                  label="Total"
                  value={latest.commitment_stats.total}
                  subtext={`${latest.commitment_stats.completed} completed`}
                  color="bg-blue-50 border-blue-200 text-blue-700"
                />
                <StatCard
                  icon={AlertTriangle}
                  label={t('overdueItems')}
                  value={latest.commitment_stats.overdue}
                  color={latest.commitment_stats.overdue > 0
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-slate-50 border-slate-200 text-slate-700"}
                />
                <StatCard
                  icon={Heart}
                  label={t('familyCommitments')}
                  value={`${latest.commitment_stats.family_compliance_rate}%`}
                  subtext={`${latest.commitment_stats.family_completed}/${latest.commitment_stats.family_total}`}
                  color="bg-pink-50 border-pink-200 text-pink-700"
                />
              </div>
            </div>

            {/* Relationship Health */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4" /> {t('relationshipHealth')}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={Users}
                  label="Active contacts"
                  value={latest.relationship_stats.active_contacts}
                  subtext={`of ${latest.relationship_stats.total_contacts} total`}
                  color="bg-blue-50 border-blue-200 text-blue-700"
                />
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700">
                  <div className="text-xs font-medium opacity-70 mb-2">{t('coldVips')}</div>
                  {latest.relationship_stats.cold_vips.length === 0 ? (
                    <p className="text-sm">None — great job!</p>
                  ) : (
                    <div className="space-y-1">
                      {latest.relationship_stats.cold_vips.map((vip, i) => (
                        <p key={i} className="text-sm">
                          <span className="font-medium">{vip.name}</span>
                          {vip.company && <span className="opacity-60"> @ {vip.company}</span>}
                          <span className="opacity-60"> — {vip.days_since}d</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Travel Summary */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Plane className="w-4 h-4" /> {t('travelSummary')}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  icon={Plane}
                  label="Trips"
                  value={latest.travel_stats.trips_count}
                  subtext={`${latest.travel_stats.total_days} days`}
                  color="bg-sky-50 border-sky-200 text-sky-700"
                />
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-sky-700 col-span-2">
                  <div className="text-xs font-medium opacity-70 mb-1">Cities</div>
                  <div className="flex flex-wrap gap-1">
                    {latest.travel_stats.cities.length > 0
                      ? latest.travel_stats.cities.map((city, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white/60 rounded-full text-xs font-medium">{city}</span>
                        ))
                      : <span className="text-sm">No trips</span>
                    }
                  </div>
                  {latest.travel_stats.total_expense > 0 && (
                    <div className="mt-2 text-sm font-bold">SGD {latest.travel_stats.total_expense.toLocaleString()}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Family Time */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Heart className="w-4 h-4" /> {t('familyTime')}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={Heart}
                  label="Family events"
                  value={latest.family_stats.events_in_period}
                  color="bg-pink-50 border-pink-200 text-pink-700"
                />
                <StatCard
                  icon={AlertTriangle}
                  label="Conflicts detected"
                  value={latest.family_stats.conflicts_detected}
                  color={latest.family_stats.conflicts_detected > 0
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-green-50 border-green-200 text-green-700"}
                />
              </div>
            </div>

            {/* Report text */}
            {latest.content && (
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">{latest.content}</pre>
              </div>
            )}
          </>
        )}

        {/* Historical snapshots */}
        {snapshots.length > 1 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-500">Previous reports</h2>
            {snapshots.slice(1).map((snap) => (
              <div key={snap.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-700">{snap.period_start} → {snap.period_end}</span>
                  <span className="ml-3 text-xs text-slate-500">
                    {snap.commitment_stats.compliance_rate}% compliance
                  </span>
                </div>
                <div className="text-sm text-slate-400">
                  {snap.commitment_stats.total} commitments
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
