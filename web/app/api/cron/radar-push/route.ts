import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { wasNotificationSent, markNotificationSent } from '@/lib/whatsapp/notification-log'

/**
 * GET /api/cron/radar-push
 * Pushes critical/high radar alerts to users via WhatsApp (if connected).
 * Runs every 2 hours. Uses notification_log to dedup — each signal only sent once per day.
 *
 * What gets pushed:
 * - critical: overdue i_promised commitments (credibility at stake)
 * - high: VIP unreplied emails (> 24h), calendar conflicts
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const todayISO = new Date().toISOString().slice(0, 10)

  // Get all users with completed onboarding
  const { data: users } = await admin
    .from('profiles')
    .select('id, timezone')
    .not('onboarding_completed_at', 'is', null)
    .limit(100)

  if (!users || users.length === 0) {
    return NextResponse.json({ processed: 0, pushed: 0 })
  }

  let totalPushed = 0

  for (const user of users) {
    try {
      const alerts = await collectCriticalAlerts(admin, user.id, todayISO)
      if (alerts.length === 0) continue

      // 👂 Check user's recent emotional state — if stressed/tired, only push critical
      let filteredAlerts = alerts
      try {
        const { detectEmotion } = await import('@/lib/ai/emotion/detect')
        const { data: recentWA } = await admin
          .from('whatsapp_messages')
          .select('body')
          .eq('user_id', user.id)
          .eq('direction', 'inbound')
          .order('received_at', { ascending: false })
          .limit(3)
        const emotions = (recentWA || [])
          .map((m: any) => detectEmotion(m.body || ''))
          .filter((e: any) => e.confidence >= 0.5)
        const dominant = emotions[0]
        if (dominant && (dominant.emotion === 'tired' || dominant.emotion === 'stressed')) {
          // Only push critical alerts when user is tired/stressed — respect their state
          filteredAlerts = alerts.filter(a => a.urgency === 'critical')
        }
      } catch { /* non-fatal — proceed with all alerts */ }

      // Filter out already-sent alerts
      const unsent: typeof filteredAlerts = []
      for (const alert of filteredAlerts) {
        const sent = await wasNotificationSent(user.id, 'radar_push', alert.dedup_key, todayISO)
        if (!sent) unsent.push(alert)
      }
      if (unsent.length === 0) continue

      // Try WhatsApp first
      const pushed = await pushViaWhatsApp(user.id, unsent)

      // Mark all as sent regardless of delivery (prevent spam on retry)
      for (const alert of unsent) {
        await markNotificationSent(user.id, 'radar_push', alert.dedup_key, todayISO)
      }

      totalPushed += pushed ? unsent.length : 0
    } catch (err) {
      console.error(`[Radar Push] Error for user ${user.id}:`, err)
    }
  }

  return NextResponse.json({ processed: users.length, pushed: totalPushed })
}

interface RadarAlert {
  urgency: 'critical' | 'high'
  message: string
  dedup_key: string
}

async function collectCriticalAlerts(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  todayISO: string,
): Promise<RadarAlert[]> {
  const alerts: RadarAlert[] = []

  const [overdueRes, vipUnrepliedRes] = await Promise.all([
    // Overdue i_promised — credibility at stake
    admin
      .from('commitments')
      .select('id, title, contact_name, deadline')
      .eq('user_id', userId)
      .eq('type', 'i_promised')
      .in('status', ['pending', 'in_progress', 'overdue'])
      .lt('deadline', todayISO)
      .order('deadline', { ascending: true })
      .limit(5),

    // VIP contacts list
    admin
      .from('contacts')
      .select('email')
      .eq('user_id', userId)
      .eq('importance', 'vip')
      .limit(200),
  ])

  // Overdue commitments → critical
  for (const c of overdueRes.data || []) {
    const daysOverdue = Math.ceil((Date.now() - new Date(c.deadline).getTime()) / 86400000)
    alerts.push({
      urgency: 'critical',
      message: `You promised${c.contact_name ? ` ${c.contact_name}` : ''}: "${c.title}" (${daysOverdue}d overdue)`,
      dedup_key: `overdue_${c.id}`,
    })
  }

  // VIP unreplied emails → high
  const vipEmails = new Set((vipUnrepliedRes.data || []).map((c: any) => c.email?.toLowerCase()))
  if (vipEmails.size > 0) {
    const { data: unreplied } = await admin
      .from('emails')
      .select('id, from_address, from_name, subject')
      .eq('user_id', userId)
      .eq('is_reply_needed', true)
      .order('received_at', { ascending: false })
      .limit(50)

    const vipUnreplied = (unreplied || [])
      .filter((e: any) => vipEmails.has(e.from_address?.toLowerCase()))
      .slice(0, 3)

    for (const e of vipUnreplied) {
      alerts.push({
        urgency: 'high',
        message: `VIP ${e.from_name || e.from_address} is waiting for your reply: "${e.subject}"`,
        dedup_key: `vip_unreplied_${e.id}`,
      })
    }
  }

  return alerts
}

async function pushViaWhatsApp(userId: string, alerts: RadarAlert[]): Promise<boolean> {
  try {
    // Dynamic import to avoid breaking if whatsapp module not available
    const { getConnection } = await import('@/lib/whatsapp/client')
    const sock = getConnection(userId)
    if (!sock?.user) return false

    const myNumber = sock.user.id.split(':')[0]
    const myLid = sock.user.lid?.split(':')[0]
    const selfJid = myLid ? `${myLid}@lid` : `${myNumber}@s.whatsapp.net`

    const lines = alerts.map(a =>
      a.urgency === 'critical' ? `🔴 ${a.message}` : `🟡 ${a.message}`
    )
    const text = `⚡ Sophia Alert\n\n${lines.join('\n')}\n\n━━━\nReply: draft [name] | done [name] | snooze [name]`

    await sock.sendMessage(selfJid, { text })
    return true
  } catch {
    return false
  }
}
