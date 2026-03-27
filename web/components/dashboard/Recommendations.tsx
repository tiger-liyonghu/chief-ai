'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  MapPin,
  Star,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Briefcase,
  Footprints,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Place {
  id: string
  name: string
  category: 'hawker' | 'cafe' | 'restaurant_casual' | 'restaurant_business' | 'bar' | 'attraction' | 'shopping' | 'coworking'
  area: string
  cuisine?: string
  priceRange: '$' | '$$' | '$$$' | '$$$$'
  rating: number
  businessMealSuitable: boolean
  description: string
  descriptionZh?: string
  walkMinutesFromMrt: number
  nearestMrt: string
  googleMapsUrl: string
  openHours: { open: string; close: string }
  tags: string[]
}

interface PlaceRecommendation {
  place: Place
  reason: string
  walk_minutes: number
  suggested_action: string
}

interface Gap {
  start: string
  end: string
  duration_minutes: number
  meal_type: string
  before_meeting: { title: string; location: string | null } | null
  after_meeting: { title: string; location: string | null } | null
  recommendations: PlaceRecommendation[]
}

interface RecommendationsData {
  gaps: Gap[]
  chiefs_picks: PlaceRecommendation[]
  meta: {
    date: string
    business_mode: boolean
    language: string
    total_gaps: number
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  hawker: '\uD83C\uDF5C',
  cafe: '\u2615',
  restaurant_casual: '\uD83C\uDF5D',
  restaurant_business: '\uD83C\uDF7D\uFE0F',
  bar: '\uD83C\uDF7A',
  attraction: '\uD83C\uDFDB\uFE0F',
  shopping: '\uD83D\uDED2',
  coworking: '\uD83D\uDCBB',
}

const MEAL_TYPE_LABELS: Record<string, { en: string; zh: string; ms: string }> = {
  breakfast: { en: 'Breakfast', zh: '早餐', ms: 'Sarapan' },
  morning_break: { en: 'Morning Break', zh: '上午休息', ms: 'Rehat Pagi' },
  lunch: { en: 'Lunch', zh: '午餐', ms: 'Makan Tengah Hari' },
  afternoon_break: { en: 'Afternoon Break', zh: '下午休息', ms: 'Rehat Petang' },
  dinner: { en: 'Dinner', zh: '晚餐', ms: 'Makan Malam' },
  late_night: { en: 'Late Night', zh: '夜宵', ms: 'Lewat Malam' },
}

const TAG_COLORS: Record<string, string> = {
  quiet: 'bg-blue-50 text-blue-600',
  wifi: 'bg-green-50 text-green-600',
  outdoor: 'bg-amber-50 text-amber-600',
  view: 'bg-purple-50 text-purple-600',
  halal: 'bg-emerald-50 text-emerald-700',
  'halal-friendly': 'bg-emerald-50 text-emerald-700',
  michelin: 'bg-red-50 text-red-600',
  heritage: 'bg-orange-50 text-orange-600',
  instagram: 'bg-pink-50 text-pink-600',
  'late-night': 'bg-indigo-50 text-indigo-600',
  'live-music': 'bg-violet-50 text-violet-600',
  coffee: 'bg-amber-50 text-amber-700',
  'fine-dining': 'bg-yellow-50 text-yellow-700',
}

// ─── Animation variants ─────────────────────────────────────────────────────

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

// ─── Place Card ─────────────────────────────────────────────────────────────

function PlaceCard({ rec, locale }: { rec: PlaceRecommendation; locale: string }) {
  const { t } = useI18n()
  const place = rec.place
  const icon = CATEGORY_ICONS[place.category] || '\uD83D\uDCCD'
  const displayTags = place.tags.slice(0, 3)

  return (
    <motion.div
      variants={fadeUp}
      className="flex-shrink-0 w-[260px] sm:w-[280px] bg-white rounded-xl border border-border p-3.5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
    >
      {/* Header: icon + name + price */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0" role="img" aria-label={place.category}>
            {icon}
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-text-primary truncate leading-tight">
              {place.name}
            </h4>
            <span className="text-[10px] text-text-tertiary">{place.area}</span>
          </div>
        </div>
        <span className="text-xs font-medium text-text-secondary shrink-0">
          {place.priceRange}
        </span>
      </div>

      {/* Rating + Walk time */}
      <div className="flex items-center gap-3 mb-2 text-xs">
        <span className="flex items-center gap-0.5">
          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
          <span className="text-text-primary font-medium">{place.rating.toFixed(1)}</span>
        </span>
        <span className="flex items-center gap-0.5 text-text-tertiary">
          <Footprints className="w-3 h-3" />
          {t('recWalkMin' as any, { n: rec.walk_minutes })}
        </span>
        {place.businessMealSuitable && (
          <span className="flex items-center gap-0.5 text-text-tertiary">
            <Briefcase className="w-3 h-3" />
            <span className="text-[10px]">{t('recBusinessMeal' as any)}</span>
          </span>
        )}
      </div>

      {/* AI Reason */}
      <p className="text-xs text-text-secondary mb-2.5 line-clamp-2 leading-relaxed">
        {rec.reason}
      </p>

      {/* Tags */}
      {displayTags.length > 0 && (
        <div className="flex items-center gap-1 mb-2.5 flex-wrap">
          {displayTags.map(tag => (
            <span
              key={tag}
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                TAG_COLORS[tag] || 'bg-surface-secondary text-text-tertiary',
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Open Maps button */}
      <a
        href={place.googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-surface-secondary hover:bg-primary/10 text-text-secondary hover:text-primary rounded-lg text-xs font-medium transition-all duration-200"
        aria-label={`${t('recOpenMaps' as any)} - ${place.name}`}
      >
        <MapPin className="w-3 h-3" />
        {t('recOpenMaps' as any)}
        <ExternalLink className="w-3 h-3 opacity-50" />
      </a>
    </motion.div>
  )
}

// ─── Gap Section ────────────────────────────────────────────────────────────

function GapSection({
  gap,
  locale,
  defaultExpanded,
}: {
  gap: Gap
  locale: string
  defaultExpanded: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { t } = useI18n()

  const mealLabel = MEAL_TYPE_LABELS[gap.meal_type]
  const mealText = mealLabel
    ? (locale === 'zh' ? mealLabel.zh : locale === 'ms' ? mealLabel.ms : mealLabel.en)
    : gap.meal_type

  const contextParts: string[] = []
  if (gap.before_meeting) contextParts.push(gap.before_meeting.title)
  if (gap.after_meeting) contextParts.push(gap.after_meeting.title)

  return (
    <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-border overflow-hidden">
      {/* Gap header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-surface-secondary/50 transition-colors text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-text-primary">
                {gap.start} - {gap.end}
              </span>
              <span className="text-xs bg-surface-secondary text-text-tertiary px-1.5 py-0.5 rounded-full">
                {t('recFreeTime' as any, { n: gap.duration_minutes })}
              </span>
              <span className="text-xs text-primary font-medium">{mealText}</span>
            </div>
            {contextParts.length > 0 && (
              <p className="text-xs text-text-tertiary mt-0.5 truncate">
                {contextParts.length === 2
                  ? `${contextParts[0]} → ${contextParts[1]}`
                  : contextParts[0]
                }
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 ml-2">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-text-tertiary" />
            : <ChevronRight className="w-4 h-4 text-text-tertiary" />
          }
        </div>
      </button>

      {/* Place cards in horizontal scroll */}
      <AnimatePresence initial={false}>
        {expanded && gap.recommendations.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                {gap.recommendations.map((rec) => (
                  <PlaceCard key={rec.place.id} rec={rec} locale={locale} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Recommendations() {
  const [data, setData] = useState<RecommendationsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [businessMode, setBusinessMode] = useState(false)
  const { t, locale } = useI18n()

  const fetchRecommendations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (businessMode) params.set('business', 'true')
      params.set('lang', locale)

      const res = await fetch(`/api/recommendations?${params.toString()}`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      setData(await res.json())
    } catch (err: any) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [businessMode, locale])

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  // ─── Loading skeleton ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-text-primary">{t('recTodaysPicks' as any)}</h3>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex-shrink-0 w-[260px] animate-pulse space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-surface-secondary" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3.5 bg-surface-secondary rounded w-3/4" />
                    <div className="h-2.5 bg-surface-secondary rounded w-1/2" />
                  </div>
                </div>
                <div className="h-3 bg-surface-secondary rounded w-full" />
                <div className="h-3 bg-surface-secondary rounded w-2/3" />
                <div className="h-7 bg-surface-secondary rounded-lg w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── Error state ────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-text-primary">{t('recTodaysPicks' as any)}</h3>
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 text-sm text-danger">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={fetchRecommendations}
              className="text-text-tertiary hover:text-text-secondary transition-colors"
              aria-label="Retry"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const hasGaps = data.gaps.length > 0 && data.gaps.some(g => g.recommendations.length > 0)
  const hasChiefsPicks = data.chiefs_picks && data.chiefs_picks.length > 0

  if (!hasGaps && !hasChiefsPicks) return null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text-primary">{t('recTodaysPicks' as any)}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBusinessMode(!businessMode)}
            className={cn(
              'text-xs px-2.5 py-1 rounded-full border transition-all duration-200 flex items-center gap-1',
              businessMode
                ? 'bg-text-primary text-white border-text-primary'
                : 'bg-white text-text-secondary border-border hover:border-text-tertiary'
            )}
            aria-pressed={businessMode}
          >
            <Briefcase className="w-3 h-3" />
            {t('recBusinessMeal' as any)}
          </button>
          <button
            onClick={fetchRecommendations}
            className="text-text-tertiary hover:text-text-secondary transition-colors p-1"
            aria-label="Refresh recommendations"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Gap sections */}
      {hasGaps && (
        <motion.div
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          {data.gaps
            .filter(g => g.recommendations.length > 0)
            .map((gap, i) => (
              <GapSection
                key={`${gap.start}-${gap.end}`}
                gap={gap}
                locale={locale}
                defaultExpanded={i === 0}
              />
            ))}
        </motion.div>
      )}

      {/* Chief's Picks */}
      {hasChiefsPicks && (
        <div className={cn(hasGaps && 'mt-2')}>
          {!hasGaps && (
            <p className="text-xs text-text-tertiary mb-3">
              {locale === 'zh' ? '今天没有会议间隙，以下是热门推荐' : 'No meeting gaps today. Here are popular picks:'}
            </p>
          )}
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {data.chiefs_picks.map((rec) => (
              <PlaceCard key={rec.place.id} rec={rec} locale={locale} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
