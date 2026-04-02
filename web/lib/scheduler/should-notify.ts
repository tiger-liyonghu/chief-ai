/**
 * Notification judgment layer.
 *
 * Implements manifesto rule #3: "不该烦的时候不烦。沉默是美德。"
 *
 * Three checks:
 * 1. Time — don't disturb during sleep hours
 * 2. Meeting — don't interrupt during ongoing meetings
 * 3. Frequency — don't spam the same category
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { wasNotificationSent } from '@/lib/whatsapp/notification-log'

type DbClient = ReturnType<typeof createAdminClient>

export type Urgency = 'critical' | 'high' | 'medium' | 'low'

export interface NotifyDecision {
  allowed: boolean
  reason?: string // why it was blocked (for logging)
}

// Category daily limits — manifesto says "一天最多 1-2 条干预"
const DAILY_LIMITS: Record<string, number> = {
  relationship_cooling: 3,
  commitment_overdue: 5,
  calendar_conflict: 3,
  family_conflict: 2,
  trip_briefing: 2,
  general: 10,
}

/**
 * Should we notify the user right now?
 *
 * @param db — Supabase admin client
 * @param userId — user to notify
 * @param urgency — how urgent is this
 * @param category — type of notification (for frequency limiting)
 */
export async function shouldNotify(
  db: DbClient,
  userId: string,
  urgency: Urgency,
  category: string,
): Promise<NotifyDecision> {
  // 1. Time check — sleep hours in user's timezone
  const hour = await getUserLocalHour(db, userId)
  if ((hour < 7 || hour > 22) && urgency !== 'critical') {
    return { allowed: false, reason: `sleep_hours (${hour}:00)` }
  }

  // 2. Meeting check — is user in a meeting right now?
  if (urgency !== 'critical') {
    const inMeeting = await isUserInMeeting(db, userId)
    if (inMeeting) {
      return { allowed: false, reason: 'in_meeting' }
    }
  }

  // 3. Frequency check — daily limit per category
  const limit = DAILY_LIMITS[category] || DAILY_LIMITS.general
  const todayISO = new Date().toISOString().slice(0, 10)
  const todayCount = await getTodayNotifyCount(db, userId, category, todayISO)
  if (todayCount >= limit) {
    return { allowed: false, reason: `frequency_limit (${todayCount}/${limit} ${category})` }
  }

  // Low urgency only gets through during work hours with no meeting
  if (urgency === 'low' && (hour < 9 || hour > 18)) {
    return { allowed: false, reason: 'low_urgency_outside_work_hours' }
  }

  return { allowed: true }
}

// ─── Helpers ───

async function getUserLocalHour(db: DbClient, userId: string): Promise<number> {
  const { data } = await db
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .single()

  const tz = data?.timezone || 'Asia/Singapore'

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    })
    return parseInt(formatter.format(new Date()), 10)
  } catch {
    return new Date().getUTCHours() + 8 // fallback SGT
  }
}

async function isUserInMeeting(db: DbClient, userId: string): Promise<boolean> {
  const now = new Date().toISOString()

  const { data } = await db
    .from('calendar_events')
    .select('id')
    .eq('user_id', userId)
    .lte('start_time', now)
    .gte('end_time', now)
    .limit(1)

  return !!data && data.length > 0
}

async function getTodayNotifyCount(
  db: DbClient,
  userId: string,
  category: string,
  todayISO: string,
): Promise<number> {
  const { data } = await db
    .from('notification_log')
    .select('id')
    .eq('user_id', userId)
    .eq('notification_type', category)
    .eq('sent_date', todayISO)

  return data?.length || 0
}
