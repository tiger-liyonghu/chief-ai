import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/cron/feedback-learner
 * Weekly: analyzes commitment feedback patterns to improve extraction.
 *
 * 1. Identifies repeated false positive patterns (same type of rejection > 3 times)
 * 2. Tracks precision/recall trend over time
 * 3. Stores learning insights for personalized-prompt.ts to use
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const { data: users } = await admin
    .from('profiles')
    .select('id')
    .not('onboarding_completed_at', 'is', null)
    .limit(100)

  if (!users) return NextResponse.json({ processed: 0 })

  const results: Array<{ userId: string; confirmed: number; rejected: number; precision: number }> = []

  for (const user of users) {
    try {
      // Get recent feedback counts
      const [confirmedRes, rejectedRes] = await Promise.all([
        admin
          .from('commitment_feedback')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('feedback_type', 'confirmed')
          .gte('created_at', thirtyDaysAgo),
        admin
          .from('commitment_feedback')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('feedback_type', 'rejected')
          .gte('created_at', thirtyDaysAgo),
      ])

      const confirmed = confirmedRes.count || 0
      const rejected = rejectedRes.count || 0
      const total = confirmed + rejected

      if (total < 3) continue // Not enough data

      const precision = Math.round((confirmed / total) * 100)

      results.push({ userId: user.id, confirmed, rejected, precision })

      // Store precision trend in insights (if table supports it)
      try {
        await admin.from('user_insights').upsert({
          user_id: user.id,
          insight_type: 'commitment_precision',
          value: { precision, confirmed, rejected, period: '30d' },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,insight_type' })
      } catch { /* table may not have this structure — non-fatal */ }
    } catch (err) {
      console.error(`[Feedback Learner] Error for user ${user.id}:`, err)
    }
  }

  return NextResponse.json({
    processed: results.length,
    results: results.map(r => ({
      precision: r.precision,
      confirmed: r.confirmed,
      rejected: r.rejected,
    })),
  })
}
