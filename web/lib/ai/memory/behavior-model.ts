/**
 * 🧠 Sophia's Brain — Behavior Model (Layer 3)
 *
 * Analyzes user's work patterns over time.
 * Runs weekly (called by scheduler or self-review).
 * Results injected into Sophia's prompt for personalized judgment.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface BehaviorProfile {
  response_time_avg_hours: number | null
  peak_hours: number[]
  commitment_delay_avg_days: number | null
  family_priority_score: number | null
  communication_style: {
    avg_email_length?: number
    language_ratio?: { cn: number; en: number }
    formality?: 'formal' | 'casual' | 'mixed'
  }
  energy_pattern: {
    busiest_day?: number // 0=Sun..6=Sat
    lowest_energy_day?: number
  }
  data_points: number
}

/**
 * Analyze user behavior and update the profile.
 * Should be called weekly by the scheduler.
 */
export async function analyzeBehavior(
  admin: SupabaseClient,
  userId: string,
): Promise<BehaviorProfile> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  // Fetch data for analysis
  const [commitments, emails, whatsappMsgs] = await Promise.all([
    admin
      .from('commitments')
      .select('deadline, completed_at, status, created_at')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo),
    admin
      .from('emails')
      .select('received_at, from_address, body_text')
      .eq('user_id', userId)
      .gte('received_at', thirtyDaysAgo)
      .limit(100),
    admin
      .from('whatsapp_messages')
      .select('received_at, direction, body')
      .eq('user_id', userId)
      .eq('direction', 'inbound') // user's messages
      .gte('received_at', thirtyDaysAgo)
      .limit(100),
  ])

  const allCommitments = commitments.data || []
  const allEmails = emails.data || []
  const allWaMsgs = whatsappMsgs.data || []

  // 1. Commitment delay pattern
  const completedWithDates = allCommitments.filter(c => c.status === 'done' && c.deadline && c.completed_at)
  let commitmentDelayAvg: number | null = null
  if (completedWithDates.length >= 3) {
    const delays = completedWithDates.map(c =>
      (new Date(c.completed_at).getTime() - new Date(c.deadline).getTime()) / 86400000
    )
    commitmentDelayAvg = delays.reduce((a, b) => a + b, 0) / delays.length
  }

  // 2. Peak activity hours
  const hourCounts = new Array(24).fill(0)
  for (const msg of allWaMsgs) {
    if (msg.received_at) {
      const hour = new Date(msg.received_at).getHours()
      hourCounts[hour]++
    }
  }
  for (const email of allEmails) {
    if (email.received_at) {
      const hour = new Date(email.received_at).getHours()
      hourCounts[hour]++
    }
  }
  // Top 4 peak hours
  const peakHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .filter(h => h.count > 0)
    .map(h => h.hour)
    .sort((a, b) => a - b)

  // 3. Language ratio (CN vs EN)
  let cnCount = 0
  let enCount = 0
  for (const msg of allWaMsgs) {
    if (!msg.body) continue
    const hasChinese = /[\u4e00-\u9fff]/.test(msg.body)
    if (hasChinese) cnCount++
    else enCount++
  }
  const total = cnCount + enCount
  const languageRatio = total > 0
    ? { cn: Math.round(cnCount / total * 100), en: Math.round(enCount / total * 100) }
    : { cn: 50, en: 50 }

  // 4. Energy pattern (busiest day of week)
  const dayCounts = new Array(7).fill(0)
  for (const msg of allWaMsgs) {
    if (msg.received_at) {
      const dow = new Date(msg.received_at).getDay()
      dayCounts[dow]++
    }
  }
  const busiestDay = dayCounts.indexOf(Math.max(...dayCounts))
  const lowestDay = dayCounts.indexOf(Math.min(...dayCounts.filter((_, i) => i >= 1 && i <= 5))) // weekdays only

  // 5. Family priority score (from historical choices)
  // If user has family commitments and they're mostly done on time → high family priority
  const familyCommitments = allCommitments.filter(c => c.status === 'done' && c.deadline)
  let familyPriority: number | null = null
  // Simple heuristic: ratio of on-time family vs on-time work
  // (More sophisticated analysis would require more data)

  const profile: BehaviorProfile = {
    response_time_avg_hours: null, // Would need email reply tracking
    peak_hours: peakHours,
    commitment_delay_avg_days: commitmentDelayAvg ? Math.round(commitmentDelayAvg * 10) / 10 : null,
    family_priority_score: familyPriority,
    communication_style: {
      language_ratio: languageRatio,
      formality: 'mixed',
    },
    energy_pattern: {
      busiest_day: busiestDay,
      lowest_energy_day: lowestDay,
    },
    data_points: allWaMsgs.length + allEmails.length + allCommitments.length,
  }

  // Upsert to DB
  await admin
    .from('user_behavior_profile')
    .upsert({
      user_id: userId,
      ...profile,
      communication_style: profile.communication_style,
      energy_pattern: profile.energy_pattern,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  return profile
}

/**
 * Get the stored behavior profile for a user.
 */
export async function getBehaviorProfile(
  admin: SupabaseClient,
  userId: string,
): Promise<BehaviorProfile | null> {
  const { data } = await admin
    .from('user_behavior_profile')
    .select('*')
    .eq('user_id', userId)
    .single()

  return data || null
}

/**
 * Format behavior profile for prompt injection.
 */
export function formatBehaviorForPrompt(profile: BehaviorProfile | null): string {
  if (!profile || profile.data_points < 10) return '' // Not enough data

  const parts: string[] = []

  if (profile.peak_hours.length > 0) {
    parts.push(`Peak hours: ${profile.peak_hours.map(h => `${h}:00`).join(', ')}`)
  }

  if (profile.commitment_delay_avg_days !== null) {
    if (profile.commitment_delay_avg_days > 1) {
      parts.push(`Tends to complete commitments ${profile.commitment_delay_avg_days} days late on average`)
    } else if (profile.commitment_delay_avg_days < -1) {
      parts.push(`Usually completes commitments ${Math.abs(profile.commitment_delay_avg_days)} days early`)
    }
  }

  if (profile.communication_style.language_ratio) {
    const { cn, en } = profile.communication_style.language_ratio
    if (cn > 70) parts.push('Primarily communicates in Chinese')
    else if (en > 70) parts.push('Primarily communicates in English')
    else parts.push('Bilingual communicator (CN/EN mix)')
  }

  if (parts.length === 0) return ''

  return `\n[BEHAVIOR_PROFILE: ${parts.join('. ')}]`
}
