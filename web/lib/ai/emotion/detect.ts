/**
 * 👂 Sophia's Ears — Emotion Detection Engine
 *
 * Detects user emotional state from message text.
 * Two layers: rule-based (zero cost) → LLM fallback (only when uncertain).
 * Result injected into Sophia's prompt to adjust tone.
 */

export type EmotionState = 'calm' | 'stressed' | 'anxious' | 'tired' | 'angry' | 'happy' | 'panicked'

export interface EmotionResult {
  emotion: EmotionState
  confidence: number // 0-1
  signals: string[]  // what triggered the detection
}

// ─── Rule-Based Detection (zero LLM cost) ───

const PATTERNS: Array<{ emotion: EmotionState; patterns: RegExp[]; weight: number }> = [
  {
    emotion: 'panicked',
    patterns: [
      /完了/,
      /怎么办/,
      /救命/,
      /崩溃/,
      /不行了/,
      /喘不上气/,
      /cancel|取消/i,
      /can't breathe|panic/i,
    ],
    weight: 0.9,
  },
  {
    emotion: 'tired',
    patterns: [
      /好累/,
      /累死/,
      /疲/,
      /头疼/,
      /烦死/,
      /不想动/,
      /tired|exhausted|burnout/i,
    ],
    weight: 0.85,
  },
  {
    emotion: 'angry',
    patterns: [
      /气死/,
      /什么玩意/,
      /离谱/,
      /忍不了/,
      /太过分/,
      /furious|ridiculous|unacceptable/i,
    ],
    weight: 0.8,
  },
  {
    emotion: 'anxious',
    patterns: [
      /紧急/,
      /赶紧/,
      /来不及/,
      /急/,
      /马上/,
      /urgent|asap|hurry|rush/i,
    ],
    weight: 0.75,
  },
  {
    emotion: 'stressed',
    patterns: [
      /压力/,
      /忙不过来/,
      /太多了/,
      /接不住/,
      /overwhelm|too much|swamped/i,
    ],
    weight: 0.7,
  },
  {
    emotion: 'happy',
    patterns: [
      /太好了/,
      /搞定/,
      /成了/,
      /开心/,
      /不错/,
      /great|awesome|amazing|perfect|done/i,
    ],
    weight: 0.7,
  },
]

// Message structure signals
function detectStructuralSignals(message: string): { emotion: EmotionState; confidence: number; signal: string } | null {
  // Multiple exclamation marks → urgent/emotional
  if ((message.match(/[!！]{2,}/g) || []).length > 0) {
    return { emotion: 'anxious', confidence: 0.6, signal: 'multiple exclamation marks' }
  }

  // Very short message (< 5 chars) with no question mark → terse, could be stressed
  if (message.length < 5 && !message.includes('?') && !message.includes('？')) {
    return { emotion: 'stressed', confidence: 0.4, signal: 'very short terse message' }
  }

  // ALL CAPS → angry or urgent
  if (message.length > 5 && message === message.toUpperCase() && /[A-Z]{3,}/.test(message)) {
    return { emotion: 'angry', confidence: 0.6, signal: 'all caps' }
  }

  return null
}

// Late night signal
function detectTimeSignal(hour?: number): { emotion: EmotionState; confidence: number; signal: string } | null {
  if (hour === undefined) return null
  if (hour >= 1 && hour <= 5) {
    return { emotion: 'tired', confidence: 0.5, signal: `messaging at ${hour}:00 AM` }
  }
  return null
}

/**
 * Detect emotion from message text.
 * @param message - User's message
 * @param localHour - User's local hour (0-23), for time-based signals
 * @returns EmotionResult with detected emotion, confidence, and signals
 */
export function detectEmotion(message: string, localHour?: number): EmotionResult {
  const signals: string[] = []
  let bestEmotion: EmotionState = 'calm'
  let bestConfidence = 0

  // 1. Pattern matching
  for (const { emotion, patterns, weight } of PATTERNS) {
    const matchedPatterns = patterns.filter(p => p.test(message))
    if (matchedPatterns.length > 0) {
      const confidence = Math.min(weight + (matchedPatterns.length - 1) * 0.05, 0.95)
      if (confidence > bestConfidence) {
        bestEmotion = emotion
        bestConfidence = confidence
        signals.length = 0
        signals.push(...matchedPatterns.map(p => `matched: ${p.source}`))
      }
    }
  }

  // 2. Structural signals
  const structural = detectStructuralSignals(message)
  if (structural && structural.confidence > bestConfidence) {
    bestEmotion = structural.emotion
    bestConfidence = structural.confidence
    signals.push(structural.signal)
  }

  // 3. Time signals (additive, not replacing)
  const timeSignal = detectTimeSignal(localHour)
  if (timeSignal) {
    signals.push(timeSignal.signal)
    // If already stressed/anxious + late night → boost to tired
    if (bestEmotion === 'stressed' || bestEmotion === 'anxious') {
      bestEmotion = 'tired'
      bestConfidence = Math.max(bestConfidence, timeSignal.confidence)
    } else if (bestConfidence < timeSignal.confidence) {
      bestEmotion = timeSignal.emotion
      bestConfidence = timeSignal.confidence
    }
  }

  return {
    emotion: bestEmotion,
    confidence: bestConfidence,
    signals,
  }
}

/**
 * Format emotion context for injection into Sophia's system prompt.
 * Returns empty string if user is calm (no adjustment needed).
 */
export function formatEmotionContext(result: EmotionResult): string {
  if (result.emotion === 'calm' || result.confidence < 0.4) return ''

  const adjustments: Record<EmotionState, string> = {
    calm: '',
    panicked: 'User is panicking. Lead with reassurance ("先缓一下"). Give ONE concrete next step. Do NOT list multiple options. Be the calm voice.',
    tired: 'User is exhausted. Say "剩下的不急" first. Only mention the 1 most urgent thing. Defer everything else. Do not add more work.',
    angry: 'User is frustrated. Acknowledge the feeling briefly. Then focus on solving the problem. Do not be overly sympathetic.',
    anxious: 'User feels time pressure. Be concise and direct. Lead with action, not analysis. Give exact steps.',
    stressed: 'User is under pressure. Help prioritize. Say which things can wait. Reduce cognitive load.',
    happy: 'User is in a good mood. Match the energy lightly. Still be concise.',
  }

  return `\n[EMOTIONAL_CONTEXT: user appears ${result.emotion} (confidence: ${result.confidence.toFixed(1)}). ${adjustments[result.emotion]}]`
}
