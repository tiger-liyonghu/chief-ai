'use client'

import { motion } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import {
  Plane,
  Hotel,
  Users,
  UtensilsCrossed,
  Car,
  Coffee,
  Clock,
  MapPin,
  AlertTriangle,
  Heart,
  ArrowLeft,
  Plus,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Loader2,
  DollarSign,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

/* ─── Types ─── */

interface Trip {
  id: string
  title: string
  destination_city: string
  destination_country: string
  start_date: string
  end_date: string
  status: string
  family_conflicts: Array<{ title: string; date: string }>
  total_expense: number
  currency: string
  city_card: Record<string, string> | null
}

interface TimelineEvent {
  id: string
  event_time: string
  end_time: string | null
  type: string
  title: string
  details: string | null
  location: string | null
  contact_id: string | null
  status: string
  delay_minutes: number | null
  metadata: Record<string, unknown>
  contacts?: { id: string; name: string; company: string } | null
}

/* ─── Helpers ─── */

const typeIcon: Record<string, typeof Plane> = {
  flight: Plane,
  hotel_checkin: Hotel,
  hotel_checkout: Hotel,
  meeting: Users,
  meal: UtensilsCrossed,
  transport: Car,
  free_time: Coffee,
  reminder: Clock,
  deadline: AlertTriangle,
}

const typeColor: Record<string, string> = {
  flight: 'bg-sky-100 text-sky-700 border-sky-200',
  hotel_checkin: 'bg-purple-100 text-purple-700 border-purple-200',
  hotel_checkout: 'bg-purple-100 text-purple-700 border-purple-200',
  meeting: 'bg-blue-100 text-blue-700 border-blue-200',
  meal: 'bg-orange-100 text-orange-700 border-orange-200',
  transport: 'bg-slate-100 text-slate-700 border-slate-200',
  free_time: 'bg-green-100 text-green-700 border-green-200',
  reminder: 'bg-amber-100 text-amber-700 border-amber-200',
  deadline: 'bg-red-100 text-red-700 border-red-200',
}

function formatTime(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-SG', { weekday: 'short', month: 'short', day: 'numeric' })
}

/* ─── Timeline Event Card ─── */

function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const Icon = typeIcon[event.type] || Clock
  const color = typeColor[event.type] || 'bg-slate-100 text-slate-700 border-slate-200'

  return (
    <div className="flex gap-3 items-start">
      {/* Time column */}
      <div className="w-14 text-right shrink-0">
        <span className="text-sm font-mono font-medium text-slate-600">{formatTime(event.event_time)}</span>
      </div>

      {/* Dot + line */}
      <div className="flex flex-col items-center">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center border', color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="w-px flex-1 bg-slate-200 min-h-[24px]" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-slate-900">{event.title}</span>
          {event.delay_minutes && event.delay_minutes > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">
              +{event.delay_minutes}min delay
            </span>
          )}
          {event.status === 'completed' && (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          )}
        </div>
        {event.details && <p className="text-xs text-slate-500 mt-0.5">{event.details}</p>}
        {event.location && (
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
            <MapPin className="w-3 h-3" />{event.location}
          </p>
        )}
        {event.contacts && (
          <p className="text-xs text-blue-600 mt-0.5">
            {event.contacts.name} @ {event.contacts.company}
          </p>
        )}
      </div>
    </div>
  )
}

/* ─── City Card ─── */

function CityCard({ trip }: { trip: Trip }) {
  if (!trip.city_card) return null
  const card = trip.city_card as Record<string, string>

  return (
    <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 rounded-xl p-5">
      <h3 className="font-bold text-sky-800 mb-3">
        {trip.destination_city}, {trip.destination_country}
      </h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.entries(card).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2 text-sky-700">
            <span className="opacity-60">{key}:</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Main Page ─── */

export default function TripDetailPage() {
  const { t } = useI18n()
  const params = useParams()
  const tripId = params.id as string
  const [trip, setTrip] = useState<Trip | null>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState('')
  const [recsLoading, setRecsLoading] = useState(false)
  const [showRecs, setShowRecs] = useState(false)
  const [expenses, setExpenses] = useState<any[]>([])

  const fetchRecommendations = useCallback(async (city: string, country?: string) => {
    setRecsLoading(true)
    setRecommendations('')
    setShowRecs(true)
    try {
      const res = await fetch('/api/trips/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, country }),
      })
      if (!res.ok) throw new Error()
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setRecommendations(acc)
      }
    } catch {
      setRecommendations('Failed to load recommendations.')
    } finally {
      setRecsLoading(false)
    }
  }, [])

  const fetchData = useCallback(async () => {
    const [tripRes, timelineRes, expRes] = await Promise.all([
      fetch(`/api/trips?id=${tripId}`),
      fetch(`/api/trip-timeline?trip_id=${tripId}`),
      fetch(`/api/trip-expenses?trip_id=${tripId}`).catch(() => null),
    ])
    if (tripRes.ok) {
      const data = await tripRes.json()
      const t = Array.isArray(data) ? data[0] : data
      setTrip(t)
      // Also use expenses from enriched trip data
      if (t?.expenses) setExpenses(t.expenses)
    }
    if (timelineRes.ok) setTimeline(await timelineRes.json())
    if (expRes?.ok) {
      const expData = await expRes.json()
      if (Array.isArray(expData) && expData.length > 0) setExpenses(expData)
    }
    setLoading(false)
  }, [tripId])

  useEffect(() => { fetchData() }, [fetchData])

  // Group timeline by day
  const dayGroups: Record<string, TimelineEvent[]> = {}
  for (const event of timeline) {
    const day = event.event_time.split('T')[0]
    if (!dayGroups[day]) dayGroups[day] = []
    dayGroups[day].push(event)
  }

  return (
    <div className="min-h-screen bg-surface-primary">
      <TopBar title={t('tripTimeline')} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Back link */}
        <Link href="/dashboard/trips" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t('trips')}
        </Link>

        {/* Loading */}
        {loading && <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />}

        {trip && (
          <>
            {/* Trip header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Plane className="w-5 h-5 text-sky-600" />
                  <h1 className="text-xl font-bold text-slate-900">{trip.title || `${trip.destination_city} Trip`}</h1>
                </div>
                <p className="text-sm text-slate-500">
                  {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
                </p>
              </div>
              <div className={cn('px-3 py-1.5 rounded-lg text-xs font-medium', {
                'bg-blue-100 text-blue-700': trip.status === 'upcoming' || trip.status === 'planning',
                'bg-amber-100 text-amber-700': trip.status === 'pre_trip',
                'bg-green-100 text-green-700': trip.status === 'active',
                'bg-slate-100 text-slate-600': trip.status === 'completed' || trip.status === 'post_trip',
              })}>
                {trip.status}
              </div>
            </div>

            {/* Family conflicts */}
            {trip.family_conflicts && trip.family_conflicts.length > 0 && (
              <div className="bg-pink-50 border border-pink-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-pink-600" />
                  <span className="text-sm font-semibold text-pink-700">{t('familyConflictWarning')}</span>
                </div>
                {trip.family_conflicts.map((conflict, i) => (
                  <p key={i} className="text-sm text-pink-600 ml-6">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    {conflict.title} — {conflict.date}
                  </p>
                ))}
              </div>
            )}

            {/* City card */}
            <CityCard trip={trip} />

            {/* Expense breakdown */}
            {expenses.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Expenses
                  </h3>
                  <span className="font-bold text-slate-900">
                    {expenses[0]?.currency || trip.currency || 'SGD'}{' '}
                    {expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount || 0), 0).toLocaleString()}
                  </span>
                </div>
                {/* Group by category */}
                {(() => {
                  const byCategory: Record<string, { total: number; count: number }> = {}
                  for (const e of expenses) {
                    const cat = e.category || e.type || 'other'
                    if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 }
                    byCategory[cat].total += parseFloat(e.amount || 0)
                    byCategory[cat].count++
                  }
                  return Object.entries(byCategory).map(([cat, { total, count }]) => (
                    <div key={cat} className="flex items-center justify-between py-1.5 text-sm border-t border-slate-100 first:border-0">
                      <span className="text-slate-600 capitalize">{cat} <span className="text-slate-400">({count})</span></span>
                      <span className="font-medium text-slate-700">{total.toLocaleString()}</span>
                    </div>
                  ))
                })()}
              </div>
            )}
            {!expenses.length && trip.total_expense > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <span className="text-sm text-slate-600">Total expense</span>
                <span className="font-bold text-slate-900">{trip.currency || 'SGD'} {trip.total_expense.toLocaleString()}</span>
              </div>
            )}

            {/* Local recommendations */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-orange-800 flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4" />
                  Local Recommendations
                </h3>
                <button
                  onClick={() => fetchRecommendations(trip.destination_city, trip.destination_country)}
                  disabled={recsLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors disabled:opacity-50"
                >
                  {recsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {showRecs ? 'Refresh' : 'Get Recommendations'}
                </button>
              </div>
              {showRecs && (
                <div className="text-sm text-orange-900 leading-relaxed whitespace-pre-line">
                  {recommendations}
                  {recsLoading && <span className="inline-block w-1.5 h-4 bg-orange-400/60 animate-pulse ml-0.5 align-text-bottom rounded-sm" />}
                </div>
              )}
              {!showRecs && (
                <p className="text-xs text-orange-600">Click to get dining and experience recommendations for {trip.destination_city}</p>
              )}
            </div>

            {/* Timeline */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">{t('tripTimeline')}</h2>
              </div>

              {timeline.length === 0 && !loading && (
                <div className="text-center py-12 text-slate-400">
                  <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No timeline events yet</p>
                  <p className="text-xs mt-1">Chief will auto-generate the timeline from your flights and meetings</p>
                </div>
              )}

              {Object.entries(dayGroups).map(([day, events]) => (
                <div key={day}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs font-semibold text-slate-500 px-2">{formatDate(day)}</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <div className="space-y-0">
                    {events.map((event) => (
                      <motion.div key={event.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                        <TimelineEventCard event={event} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
