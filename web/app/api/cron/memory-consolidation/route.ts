import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/cron/memory-consolidation
 * Daily maintenance of Sophia's episodic memory:
 * 1. Merge duplicate/similar memories (same day, same topic)
 * 2. Boost importance of repeated themes
 * 3. Expire old low-importance memories (> 90 days, importance < 4)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString()

  // Get all users
  const { data: users } = await admin
    .from('profiles')
    .select('id')
    .not('onboarding_completed_at', 'is', null)
    .limit(100)

  if (!users) return NextResponse.json({ processed: 0 })

  let totalExpired = 0
  let totalBoosted = 0

  for (const user of users) {
    try {
      // 1. Expire old low-importance memories
      const { data: expired } = await admin
        .from('sophia_memories')
        .delete()
        .eq('user_id', user.id)
        .lt('importance', 4)
        .lt('created_at', ninetyDaysAgo)
        .eq('access_count', 0) // Never accessed = safe to delete
        .select('id')
      totalExpired += expired?.length || 0

      // 2. Boost importance of frequently accessed memories
      const { data: frequentMemories } = await admin
        .from('sophia_memories')
        .select('id, importance, access_count')
        .eq('user_id', user.id)
        .gte('access_count', 3)
        .lt('importance', 9)
        .limit(10)

      for (const m of frequentMemories || []) {
        // Each 3 accesses → +1 importance (max 9)
        const boost = Math.min(Math.floor(m.access_count / 3), 9 - m.importance)
        if (boost > 0) {
          await admin
            .from('sophia_memories')
            .update({ importance: m.importance + boost })
            .eq('id', m.id)
          totalBoosted++
        }
      }
    } catch (err) {
      console.error(`[Memory Consolidation] Error for user ${user.id}:`, err)
    }
  }

  return NextResponse.json({
    processed: users.length,
    expired: totalExpired,
    boosted: totalBoosted,
  })
}
