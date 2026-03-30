import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/cron/precision-report
 * Weekly cron: generates a precision report across all users.
 * Computes confirmed, rejected, manual_add counts and precision rate.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Get all feedback from the past 7 days
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600000).toISOString()

  const { data: feedback, error } = await admin
    .from('commitment_feedback')
    .select('user_id, feedback_type')
    .gte('created_at', oneWeekAgo)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!feedback || feedback.length === 0) {
    return NextResponse.json({ period: 'weekly', total: 0, message: 'No feedback this week' })
  }

  // Global counts
  const global = { confirmed: 0, rejected: 0, manual_add: 0, modified: 0 }
  // Per-user counts
  const perUser: Record<string, { confirmed: number; rejected: number; manual_add: number; modified: number }> = {}

  for (const row of feedback) {
    const ft = row.feedback_type as keyof typeof global
    if (ft in global) global[ft]++

    if (!perUser[row.user_id]) {
      perUser[row.user_id] = { confirmed: 0, rejected: 0, manual_add: 0, modified: 0 }
    }
    if (ft in perUser[row.user_id]) perUser[row.user_id][ft]++
  }

  const totalDecisions = global.confirmed + global.rejected
  const precision = totalDecisions > 0
    ? Math.round((global.confirmed / totalDecisions) * 1000) / 10
    : null

  // Per-user precision breakdown
  const userBreakdown = Object.entries(perUser).map(([userId, counts]) => {
    const uTotal = counts.confirmed + counts.rejected
    return {
      user_id: userId,
      ...counts,
      precision: uTotal > 0 ? Math.round((counts.confirmed / uTotal) * 1000) / 10 : null,
    }
  })

  return NextResponse.json({
    period: 'weekly',
    since: oneWeekAgo,
    total_feedback: feedback.length,
    global: {
      ...global,
      precision,
      false_positive_rate: totalDecisions > 0
        ? Math.round((global.rejected / totalDecisions) * 1000) / 10
        : null,
    },
    users: userBreakdown,
  })
}
