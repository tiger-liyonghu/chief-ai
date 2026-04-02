/**
 * Referral detection — identifies warm introductions and referral opportunities in emails.
 *
 * Manifesto: "客户邮件里提到'我朋友也需要' → Sophia 标记为转介绍机会"
 *
 * Uses keyword matching, no LLM needed.
 * Returns referral signals that can be stored as alerts or shown in Briefing.
 */

// Patterns that indicate a referral/introduction
const REFERRAL_PATTERNS_EN = [
  /\b(?:my (?:friend|colleague|partner|boss|client)|a friend of mine)\b.*\b(?:needs?|looking for|interested in|could use|wants?)\b/i,
  /\b(?:introduce|introducing|connect(?:ing)?)\s+you\s+(?:to|with)\b/i,
  /\b(?:meet|reach out to|contact)\s+(?:my|our)\b/i,
  /\brecommended?\s+(?:you|your)\b/i,
  /\breferred?\s+(?:by|from)\b/i,
  /\bput\s+you\s+in\s+touch\b/i,
  /\bshould\s+(?:talk|speak|meet|connect)\b/i,
  /\bI(?:'ve|'ll| have| will)\s+(?:cc|copied|looped\s+in|added)\b/i,
]

const REFERRAL_PATTERNS_ZH = [
  /(?:我朋友|我同事|我老板|我客户).*(?:需要|想要|在找|有兴趣)/,
  /(?:介绍|推荐).*(?:给你|认识)/,
  /(?:帮你|给你).*(?:引荐|介绍|对接)/,
  /(?:你们|你和).*(?:认识一下|聊聊|对接)/,
  /(?:转介绍|推荐人|引荐)/,
]

export interface ReferralSignal {
  emailId: string
  fromEmail: string
  fromName: string
  subject: string
  snippet: string      // the matching sentence
  referredName?: string // extracted name of the referred person if possible
  confidence: number
}

/**
 * Check if an email contains a referral signal.
 */
export function detectReferral(email: {
  id: string
  from_address: string
  from_name?: string
  subject: string
  body_text: string
}): ReferralSignal | null {
  const text = `${email.subject} ${email.body_text}`

  // Check English patterns
  for (const pattern of REFERRAL_PATTERNS_EN) {
    const match = text.match(pattern)
    if (match) {
      // Extract a snippet around the match
      const idx = text.indexOf(match[0])
      const start = Math.max(0, idx - 30)
      const end = Math.min(text.length, idx + match[0].length + 50)
      const snippet = text.slice(start, end).replace(/\n/g, ' ').trim()

      return {
        emailId: email.id,
        fromEmail: email.from_address,
        fromName: email.from_name || email.from_address,
        subject: email.subject,
        snippet,
        confidence: 0.8,
      }
    }
  }

  // Check Chinese patterns
  for (const pattern of REFERRAL_PATTERNS_ZH) {
    const match = text.match(pattern)
    if (match) {
      const idx = text.indexOf(match[0])
      const start = Math.max(0, idx - 20)
      const end = Math.min(text.length, idx + match[0].length + 40)
      const snippet = text.slice(start, end).replace(/\n/g, ' ').trim()

      return {
        emailId: email.id,
        fromEmail: email.from_address,
        fromName: email.from_name || email.from_address,
        subject: email.subject,
        snippet,
        confidence: 0.8,
      }
    }
  }

  return null
}
