import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createUserAIClient } from '@/lib/ai/unified-client'
import {
  SINGAPORE_PLACES,
  getPlacesByAreaWithAdjacent,
  isPlaceOpenAt,
  determineMealType,
  getCategoriesForMealType,
  CATEGORY_ICONS,
  type Place,
} from '@/lib/data/singapore-places'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string
  title: string
  start_time: string
  end_time: string
  location?: string | null
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimeHHMM(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Singapore',
  })
}

function extractArea(location: string | null | undefined): string | null {
  if (!location) return null
  const loc = location.toLowerCase()

  const areaMap: Record<string, string> = {
    'raffles place': 'Raffles Place',
    'raffles': 'Raffles Place',
    'marina bay': 'Marina Bay',
    'mbs': 'Marina Bay',
    'marina bay sands': 'Marina Bay',
    'tanjong pagar': 'Tanjong Pagar',
    'orchard': 'Orchard',
    'bugis': 'Bugis',
    'arab street': 'Bugis',
    'kampong glam': 'Bugis',
    'tiong bahru': 'Tiong Bahru',
    'holland village': 'Holland Village',
    'holland v': 'Holland Village',
    'chinatown': 'Chinatown',
    'bishan': 'Bishan',
    'jurong east': 'Jurong East',
    'jurong': 'Jurong East',
    'clarke quay': 'Clarke Quay',
    'boat quay': 'Boat Quay',
    'city hall': 'City Hall',
    'sentosa': 'Sentosa',
    'harbourfront': 'HarbourFront',
    'vivocity': 'HarbourFront',
    'novena': 'Novena',
    'newton': 'Newton',
    'outram': 'Outram Park',
    'one north': 'One North',
    'one-north': 'One North',
    'buona vista': 'Buona Vista',
    'little india': 'Little India',
    'dhoby ghaut': 'Dhoby Ghaut',
    'lavender': 'Lavender',
    'telok ayer': 'Telok Ayer',
    'bayfront': 'Bayfront',
    'somerset': 'Somerset',
    'cbd': 'Raffles Place',
    'shenton way': 'Raffles Place',
    'robinson road': 'Raffles Place',
    'cecil street': 'Raffles Place',
    'anson road': 'Tanjong Pagar',
    'keong saik': 'Tanjong Pagar',
    'duxton': 'Tanjong Pagar',
    'dempsey': 'Dempsey Hill',
    'robertson quay': 'Robertson Quay',
  }

  for (const [keyword, area] of Object.entries(areaMap)) {
    if (loc.includes(keyword)) return area
  }
  return null
}

function getSuggestedAction(place: Place, mealType: string, durationMinutes: number): string {
  if (place.category === 'coworking') return 'work_session'
  if (place.category === 'attraction') return 'explore'
  if (place.category === 'shopping') return 'browse'
  if (place.category === 'bar') return 'drinks'
  if (place.category === 'cafe' && durationMinutes < 60) return 'quick_coffee'
  if (place.category === 'cafe') return 'coffee_and_work'
  if (mealType === 'lunch' || mealType === 'dinner') return 'dine'
  if (mealType === 'breakfast') return 'breakfast'
  return 'visit'
}

function scorePlace(
  place: Place,
  mealType: string,
  durationMinutes: number,
  businessMeal: boolean,
  preferredCategories: Place['category'][],
): number {
  let score = 0

  if (preferredCategories.includes(place.category)) score += 30
  score += (place.rating - 4.0) * 20

  if (businessMeal && place.businessMealSuitable) score += 25
  if (businessMeal && !place.businessMealSuitable) score -= 30

  if (durationMinutes < 45) {
    if (place.category === 'cafe' || place.category === 'hawker') score += 15
    if (place.category === 'restaurant_business') score -= 20
    if (place.walkMinutesFromMrt <= 3) score += 10
  } else if (durationMinutes >= 90) {
    if (place.category === 'attraction' || place.category === 'restaurant_business') score += 10
  }

  if (place.walkMinutesFromMrt <= 3) score += 10
  else if (place.walkMinutesFromMrt <= 5) score += 5
  else if (place.walkMinutesFromMrt > 10) score -= 10

  if (place.tags.includes('wifi') && (mealType === 'morning_break' || mealType === 'afternoon_break')) score += 5
  if (place.tags.includes('quiet') && businessMeal) score += 5
  if (place.tags.includes('michelin')) score += 5

  return score
}

// ─── AI Reason Generation ───────────────────────────────────────────────────

async function generateReasons(
  recommendations: Array<{ place: Place; mealType: string; walkMinutes: number; action: string }>,
  locale: string,
  aiClient?: OpenAI,
  aiModel?: string,
): Promise<string[]> {
  if (recommendations.length === 0) return []

  const langInstruction = locale === 'zh' ? '用中文回复' : locale === 'ms' ? 'Balas dalam Bahasa Melayu' : 'Reply in English'

  const placeSummaries = recommendations.map((r, i) =>
    `${i + 1}. ${r.place.name} (${r.place.category}, ${r.place.area}, ${r.walkMinutes} min walk) — ${r.place.description}, tags: ${r.place.tags.join(', ')}`
  ).join('\n')

  try {
    const client = aiClient || (await import('@/lib/ai/unified-client')).systemAIClient
    const model = aiModel || 'deepseek-chat'
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You generate short, personalized one-line recommendations for places in Singapore. Be specific about what makes each place good for the situation. ${langInstruction}. Return JSON: {"reasons": ["reason1", "reason2", ...]}`,
        },
        {
          role: 'user',
          content: `Generate a one-line recommendation for each place (max 60 chars each). Focus on what makes it good for the time slot:\n\n${placeSummaries}`,
        },
      ],
      temperature: 0.6,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Empty response')

    const parsed = JSON.parse(content)
    const reasons = parsed.reasons || parsed.recommendations || Object.values(parsed)
    if (Array.isArray(reasons) && reasons.length === recommendations.length) {
      return reasons.map(String)
    }
    return recommendations.map((r) => r.place.description)
  } catch {
    return recommendations.map((r) =>
      r.place.descriptionZh && locale === 'zh' ? r.place.descriptionZh : r.place.description
    )
  }
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { client: aiClient, model: aiModel } = await createUserAIClient(user.id)
  const searchParams = request.nextUrl.searchParams
  const dateParam = searchParams.get('date')
  const areaParam = searchParams.get('area')
  const gapMinutesParam = searchParams.get('gap_minutes')
  const mealTypeParam = searchParams.get('meal_type')
  const businessMealParam = searchParams.get('business_meal') === 'true' || searchParams.get('business') === 'true'
  const locale = searchParams.get('locale') || searchParams.get('lang') || 'en'

  // ─── Direct query: specific area + gap ──────────────────────────────────────
  if (areaParam && gapMinutesParam && mealTypeParam) {
    const duration = parseInt(gapMinutesParam, 10) || 60
    const mealType = mealTypeParam
    const preferredCategories = getCategoriesForMealType(mealType)
    const timeStr = mealType === 'breakfast' ? '08:00' :
      mealType === 'morning_break' ? '10:00' :
      mealType === 'lunch' ? '12:00' :
      mealType === 'afternoon_break' ? '15:00' :
      mealType === 'dinner' ? '19:00' : '22:00'

    const candidates = getPlacesByAreaWithAdjacent(areaParam)
      .filter(p => isPlaceOpenAt(p, timeStr))
      .map(p => ({ place: p, score: scorePlace(p, mealType, duration, businessMealParam, preferredCategories) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    const reasons = await generateReasons(
      candidates.map(c => ({
        place: c.place,
        mealType,
        walkMinutes: c.place.walkMinutesFromMrt,
        action: getSuggestedAction(c.place, mealType, duration),
      })),
      locale,
      aiClient,
      aiModel,
    )

    return NextResponse.json({
      recommendations: candidates.map((c, i) => ({
        place: c.place,
        reason: reasons[i] || c.place.description,
        walk_minutes: c.place.walkMinutesFromMrt,
        suggested_action: getSuggestedAction(c.place, mealType, duration),
      })),
    })
  }

  // ─── Full calendar gap analysis ───────────────────────────────────────────
  const targetDate = dateParam ? new Date(dateParam + 'T00:00:00+08:00') : new Date()
  const dayStart = new Date(targetDate)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(targetDate)
  dayEnd.setHours(23, 59, 59, 999)

  const { data: events, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', user.id)
    .gte('start_time', dayStart.toISOString())
    .lte('start_time', dayEnd.toISOString())
    .order('start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sortedEvents: CalendarEvent[] = events || []

  // Find gaps between events
  const gaps: Gap[] = []
  const MIN_GAP_MINUTES = 30

  if (sortedEvents.length === 0) {
    // No meetings: suggest based on current time
    const now = new Date()
    const timeStr = formatTimeHHMM(now)
    const mealType = determineMealType(timeStr)
    const preferredCategories = getCategoriesForMealType(mealType)

    // Pick popular areas
    const candidates = SINGAPORE_PLACES
      .filter(p => isPlaceOpenAt(p, timeStr))
      .map(p => ({ place: p, score: scorePlace(p, mealType, 120, businessMealParam, preferredCategories) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    const reasons = await generateReasons(
      candidates.map(c => ({
        place: c.place,
        mealType,
        walkMinutes: c.place.walkMinutesFromMrt,
        action: getSuggestedAction(c.place, mealType, 120),
      })),
      locale,
      aiClient,
      aiModel,
    )

    return NextResponse.json({
      gaps: [],
      chiefs_picks: candidates.map((c, i) => ({
        place: c.place,
        reason: reasons[i] || c.place.description,
        walk_minutes: c.place.walkMinutesFromMrt,
        suggested_action: getSuggestedAction(c.place, mealType, 120),
      })),
      meta: {
        date: targetDate.toISOString().split('T')[0],
        business_mode: businessMealParam,
        language: locale,
        total_gaps: 0,
      },
    })
  }

  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const endA = new Date(sortedEvents[i].end_time)
    const startB = new Date(sortedEvents[i + 1].start_time)
    const gapMinutes = Math.round((startB.getTime() - endA.getTime()) / 60000)

    if (gapMinutes < MIN_GAP_MINUTES) continue

    const gapStartStr = formatTimeHHMM(endA)
    const gapEndStr = formatTimeHHMM(startB)
    const mealType = determineMealType(gapStartStr)

    const areaAfter = extractArea(sortedEvents[i + 1].location)
    const areaBefore = extractArea(sortedEvents[i].location)
    const primaryArea = areaAfter || areaBefore || 'Raffles Place'

    const preferredCategories = getCategoriesForMealType(mealType)

    const candidates = getPlacesByAreaWithAdjacent(primaryArea)
      .filter(p => isPlaceOpenAt(p, gapStartStr))
      .map(p => ({ place: p, score: scorePlace(p, mealType, gapMinutes, businessMealParam, preferredCategories) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    const reasons = await generateReasons(
      candidates.map(c => ({
        place: c.place,
        mealType,
        walkMinutes: c.place.walkMinutesFromMrt,
        action: getSuggestedAction(c.place, mealType, gapMinutes),
      })),
      locale,
      aiClient,
      aiModel,
    )

    gaps.push({
      start: gapStartStr,
      end: gapEndStr,
      duration_minutes: gapMinutes,
      meal_type: mealType,
      before_meeting: {
        title: sortedEvents[i].title,
        location: sortedEvents[i].location || null,
      },
      after_meeting: {
        title: sortedEvents[i + 1].title,
        location: sortedEvents[i + 1].location || null,
      },
      recommendations: candidates.map((c, j) => ({
        place: c.place,
        reason: reasons[j] || c.place.description,
        walk_minutes: c.place.walkMinutesFromMrt,
        suggested_action: getSuggestedAction(c.place, mealType, gapMinutes),
      })),
    })
  }

  // Also check gap after last event for dinner/drinks
  const lastEvent = sortedEvents[sortedEvents.length - 1]
  const lastEnd = new Date(lastEvent.end_time)
  const endOfDay = new Date(lastEnd)
  endOfDay.setHours(22, 0, 0, 0)
  const afterGap = Math.round((endOfDay.getTime() - lastEnd.getTime()) / 60000)

  if (afterGap >= MIN_GAP_MINUTES && lastEnd.getHours() >= 17) {
    const gapStartStr = formatTimeHHMM(lastEnd)
    const mealType = determineMealType(gapStartStr)
    const primaryArea = extractArea(lastEvent.location) || 'Raffles Place'
    const preferredCategories = getCategoriesForMealType(mealType)

    const candidates = getPlacesByAreaWithAdjacent(primaryArea)
      .filter(p => isPlaceOpenAt(p, gapStartStr))
      .map(p => ({ place: p, score: scorePlace(p, mealType, afterGap, businessMealParam, preferredCategories) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    const reasons = await generateReasons(
      candidates.map(c => ({
        place: c.place,
        mealType,
        walkMinutes: c.place.walkMinutesFromMrt,
        action: getSuggestedAction(c.place, mealType, afterGap),
      })),
      locale,
      aiClient,
      aiModel,
    )

    gaps.push({
      start: gapStartStr,
      end: '22:00',
      duration_minutes: afterGap,
      meal_type: mealType,
      before_meeting: { title: lastEvent.title, location: lastEvent.location || null },
      after_meeting: null,
      recommendations: candidates.map((c, j) => ({
        place: c.place,
        reason: reasons[j] || c.place.description,
        walk_minutes: c.place.walkMinutesFromMrt,
        suggested_action: getSuggestedAction(c.place, mealType, afterGap),
      })),
    })
  }

  // Chief's Picks: top-rated places for current time
  const now = new Date()
  const currentTimeStr = formatTimeHHMM(now)
  const currentMealType = determineMealType(currentTimeStr)
  const currentCategories = getCategoriesForMealType(currentMealType)

  const chiefsPicks = SINGAPORE_PLACES
    .filter(p => isPlaceOpenAt(p, currentTimeStr) && p.rating >= 4.3)
    .map(p => ({ place: p, score: scorePlace(p, currentMealType, 120, businessMealParam, currentCategories) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(c => ({
      place: c.place,
      reason: c.place.descriptionZh && locale === 'zh' ? c.place.descriptionZh : c.place.description,
      walk_minutes: c.place.walkMinutesFromMrt,
      suggested_action: getSuggestedAction(c.place, currentMealType, 120),
    }))

  return NextResponse.json({
    gaps,
    chiefs_picks: chiefsPicks,
    meta: {
      date: targetDate.toISOString().split('T')[0],
      business_mode: businessMealParam,
      language: locale,
      total_gaps: gaps.length,
    },
  })
}
