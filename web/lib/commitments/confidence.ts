/**
 * 4-Level Commitment Confidence Model + Per-Person Calibration
 *
 * Levels:
 *   confirmed (>0.9) — explicit, unambiguous commitment
 *   likely (0.7-0.9) — strong signal but some hedging
 *   tentative (0.4-0.7) — vague or culturally ambiguous
 *   unlikely (<0.4) — probably not a real commitment
 *
 * Per-person calibration:
 *   Uses historical fulfillment rate to adjust confidence.
 *   Someone who fulfills 90% of commitments → boost.
 *   Someone who fulfills 30% → discount.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export type ConfidenceLabel = 'confirmed' | 'likely' | 'tentative' | 'unlikely'

const THRESHOLDS = {
  confirmed: 0.9,
  likely: 0.7,
  tentative: 0.4,
}

export interface ConfidenceResult {
  label: ConfidenceLabel
  adjusted: number   // calibrated confidence
  raw: number        // original LLM confidence
  calibration?: {
    contact_fulfillment_rate: number
    history_count: number
  }
}

/**
 * Label and optionally calibrate confidence for a commitment.
 */
export async function labelConfidence(
  admin: SupabaseClient,
  userId: string,
  rawConfidence: number,
  contactEmail?: string | null,
): Promise<ConfidenceResult> {
  let adjusted = rawConfidence
  let calibration: ConfidenceResult['calibration'] = undefined

  // Per-person calibration: if we have enough history (5+ commitments),
  // adjust based on their actual fulfillment rate
  if (contactEmail) {
    const { data: history } = await admin
      .from('commitments')
      .select('status')
      .eq('user_id', userId)
      .eq('contact_email', contactEmail)
      .in('status', ['done', 'overdue', 'cancelled'])
      .limit(20)

    if (history && history.length >= 5) {
      const fulfilled = history.filter(c => c.status === 'done').length
      const fulfillRate = fulfilled / history.length

      // Adjustment: fulfillRate=0.3 → -0.12, fulfillRate=0.7 → 0, fulfillRate=0.9 → +0.06
      const adjustment = (fulfillRate - 0.7) * 0.3
      adjusted = Math.max(0, Math.min(1, rawConfidence + adjustment))

      calibration = {
        contact_fulfillment_rate: Math.round(fulfillRate * 100) / 100,
        history_count: history.length,
      }
    }
  }

  const label: ConfidenceLabel =
    adjusted >= THRESHOLDS.confirmed ? 'confirmed' :
    adjusted >= THRESHOLDS.likely ? 'likely' :
    adjusted >= THRESHOLDS.tentative ? 'tentative' : 'unlikely'

  return { label, adjusted, raw: rawConfidence, calibration }
}

/**
 * Batch label confidence for multiple commitments (avoids N+1 queries).
 */
export async function batchLabelConfidence(
  admin: SupabaseClient,
  userId: string,
  commitments: Array<{ confidence: number; contact_email?: string | null }>,
): Promise<ConfidenceResult[]> {
  // Collect unique emails for batch query
  const uniqueEmails = [...new Set(
    commitments.map(c => c.contact_email).filter(Boolean) as string[]
  )]

  // Batch fetch fulfillment history for all contacts
  const fulfillRates = new Map<string, { rate: number; count: number }>()
  if (uniqueEmails.length > 0) {
    const { data: allHistory } = await admin
      .from('commitments')
      .select('contact_email, status')
      .eq('user_id', userId)
      .in('contact_email', uniqueEmails)
      .in('status', ['done', 'overdue', 'cancelled'])

    // Group by contact email
    const grouped = new Map<string, string[]>()
    for (const h of allHistory || []) {
      const email = h.contact_email?.toLowerCase()
      if (!email) continue
      if (!grouped.has(email)) grouped.set(email, [])
      grouped.get(email)!.push(h.status)
    }

    for (const [email, statuses] of grouped) {
      if (statuses.length >= 5) {
        const fulfilled = statuses.filter(s => s === 'done').length
        fulfillRates.set(email, {
          rate: fulfilled / statuses.length,
          count: statuses.length,
        })
      }
    }
  }

  // Apply calibration
  return commitments.map(c => {
    let adjusted = c.confidence
    let calibration: ConfidenceResult['calibration'] = undefined

    if (c.contact_email) {
      const hist = fulfillRates.get(c.contact_email.toLowerCase())
      if (hist) {
        const adjustment = (hist.rate - 0.7) * 0.3
        adjusted = Math.max(0, Math.min(1, c.confidence + adjustment))
        calibration = {
          contact_fulfillment_rate: Math.round(hist.rate * 100) / 100,
          history_count: hist.count,
        }
      }
    }

    const label: ConfidenceLabel =
      adjusted >= THRESHOLDS.confirmed ? 'confirmed' :
      adjusted >= THRESHOLDS.likely ? 'likely' :
      adjusted >= THRESHOLDS.tentative ? 'tentative' : 'unlikely'

    return { label, adjusted, raw: c.confidence, calibration }
  })
}
