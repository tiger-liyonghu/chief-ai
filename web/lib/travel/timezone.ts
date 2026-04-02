/**
 * Timezone-aware contact time recommendation.
 *
 * Manifesto: "你在东京，客户在新加坡 → Sophia 帮你算好最佳联系时间"
 *
 * Finds overlapping work hours between two timezones.
 */

// City → IANA timezone mapping (APAC focused)
const CITY_TIMEZONE: Record<string, string> = {
  'Singapore': 'Asia/Singapore',
  'Kuala Lumpur': 'Asia/Kuala_Lumpur',
  'Jakarta': 'Asia/Jakarta',
  'Bangkok': 'Asia/Bangkok',
  'Tokyo': 'Asia/Tokyo',
  'Hong Kong': 'Asia/Hong_Kong',
  'Shanghai': 'Asia/Shanghai',
  'Beijing': 'Asia/Shanghai',
  'Shenzhen': 'Asia/Shanghai',
  'Taipei': 'Asia/Taipei',
  'Seoul': 'Asia/Seoul',
  'Mumbai': 'Asia/Kolkata',
  'New Delhi': 'Asia/Kolkata',
  'Bangalore': 'Asia/Kolkata',
  'Sydney': 'Australia/Sydney',
  'Melbourne': 'Australia/Melbourne',
  'Dubai': 'Asia/Dubai',
  'London': 'Europe/London',
  'New York': 'America/New_York',
  'San Francisco': 'America/Los_Angeles',
}

export interface TimeWindow {
  yourTime: string   // "09:00-11:00"
  theirTime: string  // "10:00-12:00"
  overlapHours: number
  recommendation: string
}

/**
 * Get the best contact window between two cities.
 * Returns overlapping work hours (9am-6pm) in both timezones.
 */
export function getBestContactWindow(
  yourCity: string,
  theirCity: string,
): TimeWindow | null {
  const yourTz = CITY_TIMEZONE[yourCity]
  const theirTz = CITY_TIMEZONE[theirCity]

  if (!yourTz || !theirTz) return null

  // Calculate UTC offset for each timezone (approximate, ignoring DST edge cases)
  const yourOffset = getUtcOffsetHours(yourTz)
  const theirOffset = getUtcOffsetHours(theirTz)
  const diff = theirOffset - yourOffset

  // Work hours: 9-18 in each timezone
  // Find overlap
  const yourWorkStart = 9
  const yourWorkEnd = 18
  const theirWorkStartInYourTime = 9 - diff
  const theirWorkEndInYourTime = 18 - diff

  const overlapStart = Math.max(yourWorkStart, theirWorkStartInYourTime)
  const overlapEnd = Math.min(yourWorkEnd, theirWorkEndInYourTime)

  if (overlapStart >= overlapEnd) {
    // No overlap — suggest early morning or late evening
    const bestHourYours = diff > 0
      ? Math.max(yourWorkStart, theirWorkStartInYourTime)  // they're ahead
      : Math.min(yourWorkEnd, theirWorkEndInYourTime)       // they're behind

    return {
      yourTime: `${formatHour(bestHourYours)}`,
      theirTime: `${formatHour(bestHourYours + diff)}`,
      overlapHours: 0,
      recommendation: `No overlapping work hours. Best time: ${formatHour(bestHourYours)} your time (${formatHour(bestHourYours + diff)} their time).`,
    }
  }

  return {
    yourTime: `${formatHour(overlapStart)}-${formatHour(overlapEnd)}`,
    theirTime: `${formatHour(overlapStart + diff)}-${formatHour(overlapEnd + diff)}`,
    overlapHours: overlapEnd - overlapStart,
    recommendation: `Best window: ${formatHour(overlapStart)}-${formatHour(overlapEnd)} your time (${formatHour(overlapStart + diff)}-${formatHour(overlapEnd + diff)} in ${theirCity}). ${overlapEnd - overlapStart}h overlap.`,
  }
}

/**
 * Get timezone offset for a city name. Returns null if unknown.
 */
export function getCityTimezone(city: string): string | null {
  return CITY_TIMEZONE[city] || null
}

// ─── Helpers ───

function getUtcOffsetHours(tz: string): number {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'shortOffset',
  })
  const parts = formatter.formatToParts(now)
  const offsetPart = parts.find(p => p.type === 'timeZoneName')
  if (!offsetPart) return 0

  // Parse "GMT+8", "GMT-5", "GMT+5:30"
  const match = offsetPart.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!match) return 0

  const sign = match[1] === '+' ? 1 : -1
  const hours = parseInt(match[2], 10)
  const minutes = match[3] ? parseInt(match[3], 10) / 60 : 0
  return sign * (hours + minutes)
}

function formatHour(h: number): string {
  const normalized = ((h % 24) + 24) % 24
  const hh = Math.floor(normalized)
  const mm = Math.round((normalized - hh) * 60)
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
}
