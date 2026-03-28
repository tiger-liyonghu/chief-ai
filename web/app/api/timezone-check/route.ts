import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Domain-to-timezone mapping ──────────────────────────────────────────────

const COMPANY_TIMEZONES: Record<string, string> = {
  'google.com': 'US/Pacific',
  'meta.com': 'US/Pacific',
  'apple.com': 'US/Pacific',
  'microsoft.com': 'US/Pacific',
  'amazon.com': 'US/Pacific',
  'stripe.com': 'US/Pacific',
  'openai.com': 'US/Pacific',
  'anthropic.com': 'US/Pacific',
  'netflix.com': 'US/Pacific',
  'salesforce.com': 'US/Pacific',
  'uber.com': 'US/Pacific',
  'airbnb.com': 'US/Pacific',
  'linkedin.com': 'US/Pacific',
  'twitter.com': 'US/Pacific',
  'x.com': 'US/Pacific',
  'bloomberg.com': 'America/New_York',
  'jpmorgan.com': 'America/New_York',
  'goldmansachs.com': 'America/New_York',
  'grab.com': 'Asia/Singapore',
  'sea.com': 'Asia/Singapore',
  'shopee.sg': 'Asia/Singapore',
  'dbs.com': 'Asia/Singapore',
  'ocbc.com': 'Asia/Singapore',
  'uob.com.sg': 'Asia/Singapore',
  'govtech.gov.sg': 'Asia/Singapore',
  'bytedance.com': 'Asia/Shanghai',
  'tencent.com': 'Asia/Shanghai',
  'alibaba-inc.com': 'Asia/Shanghai',
  'baidu.com': 'Asia/Shanghai',
  'infosys.com': 'Asia/Kolkata',
  'tcs.com': 'Asia/Kolkata',
  'wipro.com': 'Asia/Kolkata',
  'flipkart.com': 'Asia/Kolkata',
}

const TLD_TIMEZONES: Record<string, string> = {
  'cn': 'Asia/Shanghai',
  'sg': 'Asia/Singapore',
  'in': 'Asia/Kolkata',
  'jp': 'Asia/Tokyo',
  'kr': 'Asia/Seoul',
  'au': 'Australia/Sydney',
  'nz': 'Pacific/Auckland',
  'uk': 'Europe/London',
  'de': 'Europe/Berlin',
  'fr': 'Europe/Paris',
  'nl': 'Europe/Amsterdam',
  'es': 'Europe/Madrid',
  'it': 'Europe/Rome',
  'ch': 'Europe/Zurich',
  'se': 'Europe/Stockholm',
  'no': 'Europe/Oslo',
  'dk': 'Europe/Copenhagen',
  'fi': 'Europe/Helsinki',
  'pl': 'Europe/Warsaw',
  'br': 'America/Sao_Paulo',
  'mx': 'America/Mexico_City',
  'ca': 'America/Toronto',
  'ae': 'Asia/Dubai',
  'il': 'Asia/Jerusalem',
  'hk': 'Asia/Hong_Kong',
  'tw': 'Asia/Taipei',
  'th': 'Asia/Bangkok',
  'my': 'Asia/Kuala_Lumpur',
  'id': 'Asia/Jakarta',
  'ph': 'Asia/Manila',
  'vn': 'Asia/Ho_Chi_Minh',
}

function inferTimezoneFromEmail(email: string): string | null {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null

  // Check known company domains first
  if (COMPANY_TIMEZONES[domain]) return COMPANY_TIMEZONES[domain]

  // Check country-code TLD (last segment, or second-to-last for co.uk style)
  const parts = domain.split('.')
  const tld = parts[parts.length - 1]

  // Handle two-part TLDs like .co.uk, .com.sg, .co.in
  if (parts.length >= 3) {
    const secondLevel = parts[parts.length - 1]
    // If .com.xx or .co.xx, the country is the last part
    if (['com', 'co', 'org', 'net', 'edu', 'gov', 'ac'].includes(parts[parts.length - 2])) {
      if (TLD_TIMEZONES[secondLevel]) return TLD_TIMEZONES[secondLevel]
    }
  }

  if (TLD_TIMEZONES[tld]) return TLD_TIMEZONES[tld]

  // .com / .org / .io with no country hint → default US/Pacific
  if (['com', 'org', 'io', 'net', 'dev', 'ai'].includes(tld)) {
    return 'US/Pacific'
  }

  return null
}

function isBusinessHours(hour: number, dayOfWeek: number): boolean {
  // Mon=1 .. Fri=5, business hours 9-18
  return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour < 18
}

function getNextBusinessHourUTC(timezone: string): string {
  // Find next 9 AM in the contact's timezone
  const now = new Date()

  for (let offsetDays = 0; offsetDays <= 7; offsetDays++) {
    const candidate = new Date(now.getTime() + offsetDays * 86400000)
    // Set to 9 AM in target timezone
    const target9am = new Date(
      candidate.toLocaleDateString('en-CA', { timeZone: timezone }) + 'T09:00:00'
    )
    // Convert to UTC by finding the offset
    const utcStr = target9am.toLocaleString('en-US', { timeZone: 'UTC' })
    const tzStr = target9am.toLocaleString('en-US', { timeZone: timezone })
    const diff = new Date(utcStr).getTime() - new Date(tzStr).getTime()
    const utcTime = new Date(target9am.getTime() + diff)

    // Must be in the future and a weekday
    const dayInTz = new Date(utcTime.toLocaleString('en-US', { timeZone: timezone }))
    const dow = dayInTz.getDay() // 0=Sun, 6=Sat
    if (utcTime > now && dow >= 1 && dow <= 5) {
      return utcTime.toISOString().replace(/\.\d+Z$/, 'Z')
    }
  }

  // Fallback: tomorrow 9 AM UTC
  const tomorrow = new Date(now.getTime() + 86400000)
  tomorrow.setUTCHours(9, 0, 0, 0)
  return tomorrow.toISOString().replace(/\.\d+Z$/, 'Z')
}

function formatLocalTime(timezone: string): { localTime: string; hour: number; dayOfWeek: number; cityName: string } {
  const now = new Date()
  const localTime = now.toLocaleString('sv-SE', { timeZone: timezone }).replace(' ', 'T')
  const parts = now.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'short' })
  const hour = parseInt(now.toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }), 10)
  const dayOfWeek = now.getDay() // 0=Sun
  // Recalculate day of week in target timezone
  const tzDow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.split(',')[0])

  // Extract city name from timezone
  const cityName = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone

  return { localTime, hour, dayOfWeek: tzDow >= 0 ? tzDow : dayOfWeek, cityName }
}

function buildSuggestion(hour: number, dayOfWeek: number, cityName: string, isBizHours: boolean): string {
  const period = hour < 6 ? 'early morning' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : hour < 22 ? 'evening' : 'late night'
  const timeStr = `${hour}:${String(new Date().getMinutes()).padStart(2, '0')}`
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12

  if (isBizHours) {
    return `It's ${h12}:${String(new Date().getMinutes()).padStart(2, '0')} ${ampm} in ${cityName} (${period}). Good time to send.`
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

  if (isWeekend) {
    return `It's ${dayNames[dayOfWeek]} ${h12}:${String(new Date().getMinutes()).padStart(2, '0')} ${ampm} in ${cityName}. Consider scheduling for Monday 9:00 AM their time.`
  }

  return `It's ${h12}:${String(new Date().getMinutes()).padStart(2, '0')} ${ampm} in ${cityName} (${period}). Consider scheduling for 9:00 AM their time.`
}

// ─── GET /api/timezone-check?email=xxx@yyy.com ───────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = request.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 })
  }

  // 1. Try to get timezone from contacts table
  let timezone: string | null = null

  const { data: contact } = await supabase
    .from('contacts')
    .select('timezone')
    .eq('user_id', user.id)
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (contact?.timezone) {
    timezone = contact.timezone
  }

  // 2. Infer from email domain if no stored timezone
  if (!timezone) {
    timezone = inferTimezoneFromEmail(email)
  }

  // 3. Final fallback
  if (!timezone) {
    timezone = 'UTC'
  }

  // 4. Calculate local time and business hours
  const { localTime, hour, dayOfWeek, cityName } = formatLocalTime(timezone)
  const isBizHours = isBusinessHours(hour, dayOfWeek)
  const suggestion = buildSuggestion(hour, dayOfWeek, cityName, isBizHours)

  // 5. Calculate suggested send time if not business hours
  const suggestedSendTimeUtc = isBizHours ? null : getNextBusinessHourUTC(timezone)

  return NextResponse.json({
    contact_email: email,
    contact_timezone: timezone,
    contact_local_time: localTime,
    is_business_hours: isBizHours,
    suggestion,
    ...(suggestedSendTimeUtc && { suggested_send_time_utc: suggestedSendTimeUtc }),
  })
}
