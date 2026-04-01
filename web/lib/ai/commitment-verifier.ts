/**
 * Tier 2 — Commitment Direction Verifier
 *
 * Uses DeepSeek Reasoner to verify and correct the direction
 * (i_promised vs waiting_on_them) of commitments extracted by Tier 1 (Chat).
 *
 * Root cause: 72% of Tier 1 FN are direction mismatches — the model extracts
 * the right content but assigns the wrong type. Reasoner's chain-of-thought
 * handles this much better.
 *
 * Cost: Only called on Tier 1 outputs (~2-5 items per email batch), not raw emails.
 */

import OpenAI from 'openai'

export interface ExtractedCommitment {
  type: 'i_promised' | 'waiting_on_them'
  title: string
  due_date?: string | null
  due_reason?: string | null
  confidence: number
}

export interface VerifyInput {
  commitment: ExtractedCommitment
  email_context: {
    from: string
    to: string
    subject: string
    body: string
    direction: 'inbound' | 'outbound'
  }
}

export interface VerifyResult {
  original_type: 'i_promised' | 'waiting_on_them'
  verified_type: 'i_promised' | 'waiting_on_them'
  corrected: boolean
  confidence: number
  reasoning: string
}

const VERIFIER_SYSTEM = `You verify the direction of a commitment extracted from an email.

Given an email and a commitment extracted from it, determine:
Is this commitment "i_promised" (user's obligation) or "waiting_on_them" (someone else's obligation)?

Think step by step:

1. WHO is the email FROM and TO?
2. Is this an INBOUND email (user received it) or OUTBOUND email (user sent it)?
3. WHO made the commitment or request in the email text?
4. Apply direction rules:
   - OUTBOUND (user sent): user's promise → i_promised, user asks recipient → waiting_on_them
   - INBOUND (user received): sender promises user → waiting_on_them, sender asks user to do something → i_promised

Return JSON only:
{
  "verified_type": "i_promised" | "waiting_on_them",
  "confidence": 0.0-1.0,
  "reasoning": "one sentence explanation"
}`

/**
 * Verify a batch of commitments using DeepSeek Reasoner.
 * Returns the same commitments with corrected direction.
 */
export async function verifyCommitmentDirections(
  client: OpenAI,
  commitments: ExtractedCommitment[],
  emailContext: {
    from: string
    to: string
    subject: string
    body: string
    direction: 'inbound' | 'outbound'
  },
): Promise<ExtractedCommitment[]> {
  if (commitments.length === 0) return []

  // Build a single prompt with all commitments to verify (saves API calls)
  const items = commitments.map((c, i) =>
    `Commitment ${i + 1}: [${c.type}] "${c.title}" (confidence: ${c.confidence})`
  ).join('\n')

  const userMessage = `Email context:
From: ${emailContext.from}
To: ${emailContext.to}
Subject: ${emailContext.subject}
Direction: ${emailContext.direction === 'outbound' ? 'OUTBOUND (user sent this)' : 'INBOUND (user received this)'}
Body (first 500 chars): ${emailContext.body.slice(0, 500)}

Commitments to verify:
${items}

For EACH commitment, verify the direction. Return JSON:
{
  "results": [
    {
      "index": 1,
      "verified_type": "i_promised" | "waiting_on_them",
      "confidence": 0.0-1.0,
      "reasoning": "one sentence"
    }
  ]
}`

  try {
    const res = await client.chat.completions.create({
      model: 'deepseek-reasoner',
      messages: [
        { role: 'system', content: VERIFIER_SYSTEM },
        { role: 'user', content: userMessage },
      ],
    })

    const content = res.choices[0]?.message?.content || '{}'
    // Extract JSON from potential markdown code blocks
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return commitments

    const parsed = JSON.parse(jsonMatch[0])
    const results = parsed.results || []

    return commitments.map((c, i) => {
      const verification = results.find((r: any) => r.index === i + 1)
      if (!verification) return c

      return {
        ...c,
        type: verification.verified_type || c.type,
        confidence: Math.min(c.confidence, verification.confidence || c.confidence),
      }
    })
  } catch (err: any) {
    console.error(`[Tier2 Verifier Error]: ${err.message}`)
    // Fallback: return original commitments unchanged
    return commitments
  }
}

/**
 * Check if Tier 2 verification should be triggered.
 * Returns true if any trigger condition is met.
 */
export function shouldTriggerTier2(
  commitments: ExtractedCommitment[],
  email: {
    body: string
    subject: string
    to_addresses?: string[]
    from_name?: string
  },
  isVip: boolean = false,
): boolean {
  // Trigger 1: Zero extraction anomaly — long email but no commitments
  if (commitments.length === 0 && email.body.length > 200) {
    return true
  }

  // Trigger 2: Structural complexity — meeting minutes or multi-party
  const complexKeywords = /minutes|action items|纪要|跟进事项|follow.?up|待办|todo|决议/i
  if (complexKeywords.test(email.subject) || complexKeywords.test(email.body.slice(0, 300))) {
    return true
  }
  if (email.to_addresses && email.to_addresses.length > 3) {
    return true
  }

  // Trigger 3: Low confidence cluster — all commitments below threshold
  if (commitments.length > 0 && commitments.every(c => c.confidence < 0.75)) {
    return true
  }

  // Trigger 4: High stakes — VIP sender or critical keywords
  if (isVip) return true
  const highStakes = /contract|deadline|legal|overdue|合同|逾期|违约|deadline|urgent|紧急/i
  if (highStakes.test(email.subject)) {
    return true
  }

  return false
}
