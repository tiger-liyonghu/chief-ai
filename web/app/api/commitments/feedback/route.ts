import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/commitments/feedback
 * Record user feedback on a commitment (confirmed, rejected, manual_add, modified).
 *
 * GET /api/commitments/feedback
 * Return feedback stats for the authenticated user.
 */

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const { feedback_type, commitment_id, original_title, original_type, modified_title, source_email_snippet, source_type, llm_confidence, llm_rejected_reason } = body

  if (!feedback_type || !['confirmed', 'rejected', 'manual_add', 'modified'].includes(feedback_type)) {
    return NextResponse.json({ error: 'Invalid feedback_type' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('commitment_feedback')
    .insert({
      user_id: user.id,
      commitment_id: commitment_id || null,
      feedback_type,
      original_title: original_title || null,
      original_type: original_type || null,
      modified_title: modified_title || null,
      source_email_snippet: source_email_snippet || null,
      source_type: source_type || null,
      llm_confidence: llm_confidence ?? null,
      llm_rejected_reason: llm_rejected_reason || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Count by feedback_type
  const { data: rows, error } = await supabase
    .from('commitment_feedback')
    .select('feedback_type')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const counts = { confirmed: 0, rejected: 0, manual_add: 0, modified: 0 }
  for (const row of rows || []) {
    const ft = row.feedback_type as keyof typeof counts
    if (ft in counts) counts[ft]++
  }

  const total = counts.confirmed + counts.rejected
  const precision = total > 0 ? Math.round((counts.confirmed / total) * 1000) / 10 : null
  const false_positive_rate = total > 0 ? Math.round((counts.rejected / total) * 1000) / 10 : null

  return NextResponse.json({
    total_feedback: (rows || []).length,
    ...counts,
    precision,
    false_positive_rate,
  })
}
