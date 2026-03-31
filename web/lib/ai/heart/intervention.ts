/**
 * 🫀 Sophia's Heart — Proactive Intervention System
 *
 * Sophia doesn't just respond. She intervenes when she sees danger:
 * burnout, relationship cooling, family conflicts, late-night work.
 *
 * Principles:
 * - Low frequency, high value (max 1-2 per day)
 * - Never nag. Each intervention is a genuine signal.
 * - Record every intervention and track if user accepted/ignored/rejected.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export type InterventionType =
  | 'burnout_warning'      // 连续逾期率高 + 活跃承诺多
  | 'relationship_cooling'  // VIP 联系人温度下降
  | 'decision_anomaly'      // 和历史模式不符的决定
  | 'family_protection'     // 工作排进家庭时间
  | 'health_protection'     // 深夜工作
  | 'emotional_protection'  // 高压 + 重大决定

export interface InterventionCheck {
  type: InterventionType
  triggered: boolean
  message: string
  severity: 'info' | 'warning' | 'critical'
}

/**
 * Check all intervention conditions for a user.
 * Called by scheduler every 30 minutes.
 * Returns list of triggered interventions (usually 0-1).
 */
export async function checkInterventions(
  admin: SupabaseClient,
  userId: string,
): Promise<InterventionCheck[]> {
  const triggered: InterventionCheck[] = []
  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)

  // Rate limit: max 2 interventions per day
  const { count: todayCount } = await admin
    .from('sophia_interventions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', `${todayISO}T00:00:00`)

  if ((todayCount || 0) >= 2) return []

  // ── Check 1: Burnout Warning ──
  // Trigger: > 10 active commitments + completion rate < 60% (last 7 days)
  try {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()

    const [activeResult, recentResult] = await Promise.all([
      admin
        .from('commitments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['pending', 'in_progress', 'overdue']),
      admin
        .from('commitments')
        .select('status')
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo)
        .in('status', ['done', 'overdue']),
    ])

    const activeCount = activeResult.count || 0
    const recent = recentResult.data || []
    const done = recent.filter(c => c.status === 'done').length
    const overdue = recent.filter(c => c.status === 'overdue').length
    const rate = (done + overdue) > 0 ? done / (done + overdue) : 1

    if (activeCount > 10 && rate < 0.6) {
      triggered.push({
        type: 'burnout_warning',
        triggered: true,
        message: `你现在有 ${activeCount} 件事在跑，这周完成率只有 ${Math.round(rate * 100)}%。要不要推掉几个不紧急的？`,
        severity: 'warning',
      })
    }
  } catch { /* non-fatal */ }

  // ── Check 2: Relationship Cooling ──
  // Trigger: VIP contact with no interaction in 14+ days
  try {
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString()

    const { data: coldVips } = await admin
      .from('contacts')
      .select('name, email, last_contact_at')
      .eq('user_id', userId)
      .eq('importance', 'vip')
      .lt('last_contact_at', fourteenDaysAgo)
      .limit(1)

    if (coldVips && coldVips.length > 0) {
      const vip = coldVips[0]
      const days = Math.floor((now.getTime() - new Date(vip.last_contact_at).getTime()) / 86400000)
      triggered.push({
        type: 'relationship_cooling',
        triggered: true,
        message: `${vip.name} 已经 ${days} 天没联系了。要不要发个消息？`,
        severity: 'info',
      })
    }
  } catch { /* non-fatal */ }

  // ── Check 3: Health Protection ──
  // Trigger: user's local time is 1-5 AM
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .single()

    if (profile) {
      const localHour = new Date().toLocaleString('en-US', {
        timeZone: profile.timezone || 'Asia/Singapore',
        hour: 'numeric',
        hour12: false,
      })
      const hour = parseInt(localHour)
      if (hour >= 1 && hour <= 5) {
        // Check if user sent a message in the last 30 minutes
        const thirtyMinAgo = new Date(now.getTime() - 30 * 60000).toISOString()
        const { count } = await admin
          .from('whatsapp_messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('direction', 'inbound')
          .gte('received_at', thirtyMinAgo)

        if ((count || 0) > 0) {
          triggered.push({
            type: 'health_protection',
            triggered: true,
            message: `现在凌晨 ${hour} 点了。剩下的明天处理。`,
            severity: 'info',
          })
        }
      }
    }
  } catch { /* non-fatal */ }

  // ── Check 4: Family Protection ──
  // Trigger: work events scheduled during family hard constraints
  try {
    const todayDayOfWeek = now.getDay()

    const [familyEvents, workEvents] = await Promise.all([
      admin
        .from('family_calendar')
        .select('title, start_time, end_time, family_member')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('event_type', 'hard_constraint')
        .or(`recurrence.eq.none,recurrence_day.eq.${todayDayOfWeek}`)
        .limit(5),
      admin
        .from('calendar_events')
        .select('title, start_time, end_time')
        .eq('user_id', userId)
        .gte('start_time', `${todayISO}T00:00:00`)
        .lte('start_time', `${todayISO}T23:59:59`)
        .limit(10),
    ])

    if (familyEvents.data && workEvents.data) {
      for (const fe of familyEvents.data) {
        if (!fe.start_time) continue
        for (const we of workEvents.data) {
          const weStart = new Date(we.start_time).toTimeString().slice(0, 5)
          const weEnd = new Date(we.end_time).toTimeString().slice(0, 5)
          if (fe.start_time < weEnd && weStart < (fe.end_time || fe.start_time)) {
            triggered.push({
              type: 'family_protection',
              triggered: true,
              message: `今天「${we.title}」和「${fe.title}」(${fe.family_member || '家庭'}) 时间冲突。要不要调整？`,
              severity: 'warning',
            })
            break
          }
        }
        if (triggered.some(t => t.type === 'family_protection')) break
      }
    }
  } catch { /* non-fatal */ }

  // ── Check 5: Decision Anomaly ──
  // Trigger: user recently changed commitment status in unusual pattern
  // (e.g., cancelled 3+ commitments in one day, or approved large spend)
  try {
    const todayStart = `${todayISO}T00:00:00`
    const { count: cancelledToday } = await admin
      .from('commitments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'cancelled')
      .gte('updated_at', todayStart)

    if ((cancelledToday || 0) >= 3) {
      triggered.push({
        type: 'decision_anomaly',
        triggered: true,
        message: `今天取消了 ${cancelledToday} 个承诺，和平时不太一样。确定都不需要跟进了吗？`,
        severity: 'warning',
      })
    }
  } catch { /* non-fatal */ }

  // ── Check 6: Emotional Protection ──
  // Trigger: recent WhatsApp messages show stress signals + pending major actions
  try {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const { data: recentMsgs } = await admin
      .from('whatsapp_messages')
      .select('body')
      .eq('user_id', userId)
      .eq('direction', 'inbound')
      .gte('received_at', oneHourAgo)
      .limit(5)

    if (recentMsgs && recentMsgs.length > 0) {
      const stressSignals = recentMsgs.filter(m =>
        m.body && /完了|怎么办|头疼|累死|不行|崩溃|panic|stress/i.test(m.body)
      )
      if (stressSignals.length >= 2) {
        // Check if there are high-urgency commitments due today
        const { count: urgentToday } = await admin
          .from('commitments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .in('status', ['pending', 'overdue'])
          .lte('deadline', todayISO)

        if ((urgentToday || 0) > 0) {
          triggered.push({
            type: 'emotional_protection',
            triggered: true,
            message: `你最近一小时情绪似乎不太好。今天还有 ${urgentToday} 件紧急的事，但不急的可以推到明天。要不要我帮你重新排一下？`,
            severity: 'info',
          })
        }
      }
    }
  } catch { /* non-fatal */ }

  return triggered
}

/**
 * Record an intervention that was sent.
 */
export async function recordIntervention(
  admin: SupabaseClient,
  userId: string,
  intervention: InterventionCheck,
  channel: 'whatsapp' | 'dashboard' | 'briefing',
): Promise<void> {
  await admin.from('sophia_interventions').insert({
    user_id: userId,
    intervention_type: intervention.type,
    trigger_reason: intervention.severity,
    message_sent: intervention.message,
    channel,
    user_action: 'pending',
  })
}
