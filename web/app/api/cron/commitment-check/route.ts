import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/cron/commitment-check
 * Vercel Cron: runs every 6 hours.
 * Scans all users' overdue commitments and creates alerts.
 *
 * Escalation strategy:
 * - 1 day overdue → gentle reminder in alerts
 * - 3 days overdue → flag as urgent
 * - 7+ days overdue → critical, suggest action
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)

  // Find all overdue active commitments across all users
  const { data: overdueItems, error } = await admin
    .from('follow_ups')
    .select('id, user_id, type, contact_email, contact_name, subject, due_date, last_nudge_at')
    .eq('status', 'active')
    .lt('due_date', todayISO)
    .order('due_date', { ascending: true })
    .limit(100)

  if (error || !overdueItems || overdueItems.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let processed = 0

  for (const item of overdueItems) {
    const daysOverdue = Math.ceil((now.getTime() - new Date(item.due_date).getTime()) / 86400000)

    // Determine escalation level
    let escalation: 'gentle' | 'urgent' | 'critical' = 'gentle'
    if (daysOverdue >= 7) escalation = 'critical'
    else if (daysOverdue >= 3) escalation = 'urgent'

    // Check if we already nudged recently (don't spam)
    if (item.last_nudge_at) {
      const hoursSinceNudge = (now.getTime() - new Date(item.last_nudge_at).getTime()) / 3600000
      // Gentle: nudge every 48h, Urgent: every 24h, Critical: every 12h
      const nudgeInterval = escalation === 'critical' ? 12 : escalation === 'urgent' ? 24 : 48
      if (hoursSinceNudge < nudgeInterval) continue
    }

    // Update last_nudge_at
    await admin.from('follow_ups').update({
      last_nudge_at: now.toISOString(),
    }).eq('id', item.id)

    processed++
  }

  return NextResponse.json({
    processed,
    total_overdue: overdueItems.length,
    breakdown: {
      gentle: overdueItems.filter(i => {
        const d = Math.ceil((now.getTime() - new Date(i.due_date).getTime()) / 86400000)
        return d < 3
      }).length,
      urgent: overdueItems.filter(i => {
        const d = Math.ceil((now.getTime() - new Date(i.due_date).getTime()) / 86400000)
        return d >= 3 && d < 7
      }).length,
      critical: overdueItems.filter(i => {
        const d = Math.ceil((now.getTime() - new Date(i.due_date).getTime()) / 86400000)
        return d >= 7
      }).length,
    },
  })
}
