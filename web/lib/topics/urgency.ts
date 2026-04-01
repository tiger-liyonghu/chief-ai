/**
 * Topic Urgency Scoring
 *
 * 综合 Topic 下所有 Signal 的频率、语气、时效、VIP 权重。
 * 用于 Dashboard 排序 — 用户看到的是"最紧急的事项"，不是最新的邮件。
 *
 * Score: 0-100
 *   90-100: 🔴 危机 — 立即处理
 *   70-89:  🟠 紧急 — 今天处理
 *   40-69:  🟡 正常 — 近期处理
 *   0-39:   🟢 低优 — 可以等
 */

import { createAdminClient } from '@/lib/supabase/admin'

interface TopicForScoring {
  id: string
  user_id: string
  primary_actor_email: string | null
  signal_count: number
  last_signal_at: string | null
  first_signal_at: string | null
}

export async function calculateTopicUrgency(userId: string): Promise<{ updated: number }> {
  const admin = createAdminClient()

  // Fetch active topics
  const { data: topics } = await admin
    .from('topics')
    .select('id, user_id, primary_actor_email, signal_count, last_signal_at, first_signal_at')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (!topics || topics.length === 0) return { updated: 0 }

  // Fetch contact importance map
  const { data: contacts } = await admin
    .from('contacts')
    .select('email, importance')
    .eq('user_id', userId)

  const importanceMap = new Map<string, string>()
  for (const c of contacts || []) {
    if (c.email) importanceMap.set(c.email.toLowerCase(), c.importance || 'normal')
  }

  let updated = 0

  for (const topic of topics) {
    let score = 0

    // ── Factor 1: Commitment urgency (heaviest weight, 0-40) ──
    const { data: commitments } = await admin
      .from('commitments')
      .select('urgency_score, status, deadline')
      .eq('topic_id', topic.id)
      .in('status', ['pending', 'in_progress', 'overdue'])

    if (commitments && commitments.length > 0) {
      // Take max urgency from linked commitments (0-10 → 0-40)
      const maxUrgency = Math.max(...commitments.map(c => c.urgency_score || 0))
      score += maxUrgency * 4

      // Overdue count amplifier
      const overdueCount = commitments.filter(c => c.status === 'overdue').length
      score += Math.min(overdueCount * 5, 15)
    }

    // ── Factor 2: Signal frequency / escalation (0-20) ──
    // 多次信号 = 这件事在升温
    if (topic.signal_count >= 5) score += 20
    else if (topic.signal_count >= 3) score += 15
    else if (topic.signal_count >= 2) score += 10
    else score += 5

    // ── Factor 3: Recency (0-15) ──
    if (topic.last_signal_at) {
      const hoursSince = (Date.now() - new Date(topic.last_signal_at).getTime()) / 3600000
      if (hoursSince < 4) score += 15
      else if (hoursSince < 24) score += 10
      else if (hoursSince < 72) score += 5
      // >72h: no recency bonus
    }

    // ── Factor 4: VIP contact (0-15) ──
    if (topic.primary_actor_email) {
      const importance = importanceMap.get(topic.primary_actor_email.toLowerCase())
      if (importance === 'vip') score += 15
      else if (importance === 'high') score += 10
    }

    // ── Factor 5: Unreplied emails in topic (0-10) ──
    const { data: topicSignals } = await admin
      .from('topic_signals')
      .select('signal_id')
      .eq('topic_id', topic.id)
      .eq('signal_channel', 'email')

    if (topicSignals && topicSignals.length > 0) {
      const signalIds = topicSignals.map(ts => ts.signal_id)
      const { count: unrepliedCount } = await admin
        .from('emails')
        .select('id', { count: 'exact', head: true })
        .in('id', signalIds)
        .eq('is_reply_needed', true)

      score += Math.min((unrepliedCount || 0) * 5, 10)
    }

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score))

    // Update if changed
    await admin.from('topics').update({
      urgency_score: score,
      updated_at: new Date().toISOString(),
    }).eq('id', topic.id)

    updated++
  }

  // Mark stale topics (no signal in 14 days, no active commitments)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 3600000).toISOString()
  await admin
    .from('topics')
    .update({ status: 'stale' })
    .eq('user_id', userId)
    .eq('status', 'active')
    .lt('last_signal_at', fourteenDaysAgo)
    .eq('commitment_count', 0)

  return { updated }
}
