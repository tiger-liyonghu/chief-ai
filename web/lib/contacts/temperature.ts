/**
 * Unified relationship temperature algorithm.
 *
 * Uses exponential decay (half-life = 14 days) for smooth, predictable cooling.
 * One function serves: Weaver Agent, Context Engine, Wow page, Briefing, Contact detail.
 *
 * Temperature 0-100:
 *   hot (≥70)    — active relationship, recent interaction
 *   warm (40-70) — healthy, periodic contact
 *   cooling (20-40) — needs attention soon
 *   cold (<20)   — at risk of going dormant
 */

export type TemperatureLabel = 'hot' | 'warm' | 'cooling' | 'cold'

export interface TemperatureResult {
  score: number         // 0-100
  label: TemperatureLabel
  needsAttention: boolean
}

export interface TemperatureInput {
  lastInteractionAt: Date | null
  recentInteractionCount: number   // interactions in last 30 days
  activeCommitmentCount: number    // i_promised + waiting_on_them
  importance: 'vip' | 'high' | 'normal' | string
}

const DECAY_HALF_LIFE = 14 // days for recency score to halve

export function calculateTemperature(input: TemperatureInput): TemperatureResult {
  const {
    lastInteractionAt,
    recentInteractionCount,
    activeCommitmentCount,
    importance,
  } = input

  const daysSince = lastInteractionAt
    ? Math.max(0, (Date.now() - lastInteractionAt.getTime()) / 86400000)
    : 999

  // Recency: exponential decay from 40, halves every 14 days
  // Day 0: 40, Day 14: 20, Day 28: 10, Day 42: 5
  const recency = 40 * Math.pow(0.5, daysSince / DECAY_HALF_LIFE)

  // Interaction frequency: each recent interaction adds 3, cap at 15
  const frequency = Math.min(recentInteractionCount * 3, 15)

  // Active commitments: each adds 5 (active relationship signal)
  const commitment = activeCommitmentCount * 5

  // Base: 10 (everyone starts above zero even with no data)
  const base = 10

  // Importance multiplier: VIP contacts cool slower
  const multiplier = importance === 'vip' ? 1.3
    : importance === 'high' ? 1.15
    : 1.0

  const raw = (base + recency + frequency + commitment) * multiplier
  const score = Math.max(0, Math.min(100, Math.round(raw)))

  const label: TemperatureLabel = score >= 70 ? 'hot'
    : score >= 40 ? 'warm'
    : score >= 20 ? 'cooling'
    : 'cold'

  // Needs attention: VIP cooling or below, important cold
  const needsAttention =
    (importance === 'vip' && score < 50) ||
    (importance === 'high' && score < 30)

  return { score, label, needsAttention }
}

/**
 * Batch calculate temperature for multiple contacts.
 * More efficient than calling calculateTemperature in a loop
 * when interaction data is already available.
 */
export function calculateTemperatureBatch(
  contacts: Array<{ id: string } & TemperatureInput>
): Array<{ id: string } & TemperatureResult> {
  return contacts.map(c => ({
    id: c.id,
    ...calculateTemperature(c),
  }))
}
