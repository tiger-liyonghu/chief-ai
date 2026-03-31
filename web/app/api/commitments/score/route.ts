import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateUrgencyScores } from '@/lib/commitments/score'

/**
 * Urgency Scoring Algorithm for commitments.
 * Calculates urgency_score based on multiple signals.
 * Can be called on-demand or via cron.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await calculateUrgencyScores(supabase, user.id)
  return NextResponse.json(result)
}
