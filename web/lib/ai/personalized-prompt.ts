import { createClient } from '@/lib/supabase/server'

/**
 * Personalized few-shot prompt builder.
 * Queries the user's commitment_feedback history and, if enough data exists,
 * builds a few-shot block with positive + negative examples to append to the
 * commitment extraction system prompt.
 *
 * Returns null if the user has fewer than 50 feedback records.
 */

interface FeedbackRow {
  feedback_type: string
  original_title: string | null
  original_type: string | null
  source_email_snippet: string | null
  llm_confidence: number | null
  llm_rejected_reason: string | null
}

// Lower threshold: start calibrating after just 5 feedbacks (was 50).
// Even a few confirmed/rejected examples significantly improve precision.
const MIN_FEEDBACK_THRESHOLD = 5

export async function getPersonalizedPrompt(userId: string): Promise<string | null> {
  const supabase = await createClient()

  // Count total feedback first to avoid loading unnecessary data
  const { count, error: countError } = await supabase
    .from('commitment_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (countError || !count || count < MIN_FEEDBACK_THRESHOLD) {
    return null
  }

  // Fetch positive examples: confirmed + highest confidence
  const { data: positives } = await supabase
    .from('commitment_feedback')
    .select('feedback_type, original_title, original_type, source_email_snippet, llm_confidence, llm_rejected_reason')
    .eq('user_id', userId)
    .eq('feedback_type', 'confirmed')
    .not('original_title', 'is', null)
    .order('llm_confidence', { ascending: false, nullsFirst: false })
    .limit(3)

  // Fetch negative examples: rejected
  const { data: negatives } = await supabase
    .from('commitment_feedback')
    .select('feedback_type, original_title, original_type, source_email_snippet, llm_confidence, llm_rejected_reason')
    .eq('user_id', userId)
    .eq('feedback_type', 'rejected')
    .not('original_title', 'is', null)
    .order('created_at', { ascending: false })
    .limit(3)

  const posExamples = (positives || []) as FeedbackRow[]
  const negExamples = (negatives || []) as FeedbackRow[]

  if (posExamples.length === 0 && negExamples.length === 0) {
    return null
  }

  // Build few-shot block
  const lines: string[] = [
    '',
    '═══ PERSONALIZED EXAMPLES (from this user\'s history) ═══',
    '',
  ]

  if (posExamples.length > 0) {
    lines.push('CORRECT extractions (user confirmed these):')
    for (const ex of posExamples) {
      lines.push(`  + "${ex.original_title}" (type: ${ex.original_type || 'unknown'}, confidence: ${ex.llm_confidence ?? '?'})`)
      if (ex.source_email_snippet) {
        lines.push(`    Context: "${ex.source_email_snippet.slice(0, 120)}"`)
      }
    }
    lines.push('')
  }

  if (negExamples.length > 0) {
    lines.push('FALSE POSITIVES (user rejected these - do NOT extract similar items):')
    for (const ex of negExamples) {
      lines.push(`  - "${ex.original_title}" (type: ${ex.original_type || 'unknown'}, confidence: ${ex.llm_confidence ?? '?'})`)
      if (ex.llm_rejected_reason) {
        lines.push(`    Reason: ${ex.llm_rejected_reason}`)
      }
      if (ex.source_email_snippet) {
        lines.push(`    Context: "${ex.source_email_snippet.slice(0, 120)}"`)
      }
    }
    lines.push('')
  }

  lines.push('Use these examples to calibrate your extraction for this user. Be especially careful to avoid patterns similar to the rejected examples.')

  return lines.join('\n')
}
