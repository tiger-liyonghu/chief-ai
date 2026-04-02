/**
 * Policy/insurance signal detection from emails.
 *
 * Detects: policy renewals, new policy confirmations, premium notices.
 * Returns structured data that can be upserted into the policies table.
 */

const POLICY_PATTERNS = [
  // Renewal notices
  { pattern: /(?:policy|保单|保险).*(?:renew|renewal|续保|到期|expire|expir)/i, type: 'renewal' as const },
  { pattern: /(?:renew|renewal|续保).*(?:policy|保单|保险)/i, type: 'renewal' as const },
  { pattern: /(?:premium|保费).*(?:due|到期|payment|缴费)/i, type: 'premium_due' as const },

  // New policy
  { pattern: /(?:policy|保单).*(?:number|号码|issued|生效|effective)/i, type: 'new_policy' as const },
  { pattern: /(?:certificate|证书).*(?:insurance|保险)/i, type: 'new_policy' as const },

  // Product types
  { pattern: /(?:medical|医疗|health)\s*(?:insurance|保险|plan|计划)/i, type: 'product_mention' as const },
  { pattern: /(?:life|人寿|寿险)\s*(?:insurance|保险)/i, type: 'product_mention' as const },
  { pattern: /(?:critical\s*illness|重疾|CI)\s*(?:insurance|保险|plan|cover)/i, type: 'product_mention' as const },
  { pattern: /(?:term\s*life|定期寿险)/i, type: 'product_mention' as const },
]

// Date extraction patterns
const DATE_PATTERNS = [
  /(?:expir|到期|due|renew).*?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  /(?:expir|到期|due|renew).*?(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i,
  /(?:expir|到期|due|renew).*?(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})/i,
]

// Product type detection
const PRODUCT_TYPE_MAP: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /medical|医疗|health/i, type: 'medical' },
  { pattern: /life|人寿|寿险/i, type: 'life' },
  { pattern: /critical\s*illness|重疾|CI\b/i, type: 'critical_illness' },
  { pattern: /accident|意外/i, type: 'accident' },
  { pattern: /investment|投资|储蓄/i, type: 'investment' },
  { pattern: /property|房屋|火险/i, type: 'property' },
  { pattern: /motor|车险|auto/i, type: 'motor' },
]

// Policy number extraction
const POLICY_NUMBER_PATTERNS = [
  /(?:policy\s*(?:no|number|#)|保单号)\s*[:\.]?\s*([A-Z0-9\-]{5,20})/i,
]

export interface PolicySignal {
  emailId: string
  signalType: 'renewal' | 'premium_due' | 'new_policy' | 'product_mention'
  productType: string | null
  policyNumber: string | null
  expiryDate: string | null
  fromEmail: string
  fromName: string
  snippet: string
}

export function detectPolicySignal(email: {
  id: string
  from_address: string
  from_name?: string
  subject: string
  body_text: string
}): PolicySignal | null {
  const text = `${email.subject} ${email.body_text}`

  // Check patterns
  let matchedType: PolicySignal['signalType'] | null = null
  let snippet = ''

  for (const { pattern, type } of POLICY_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      matchedType = type
      const idx = text.indexOf(match[0])
      const start = Math.max(0, idx - 30)
      const end = Math.min(text.length, idx + match[0].length + 50)
      snippet = text.slice(start, end).replace(/\n/g, ' ').trim()
      break
    }
  }

  if (!matchedType) return null

  // Extract product type
  let productType: string | null = null
  for (const { pattern, type } of PRODUCT_TYPE_MAP) {
    if (pattern.test(text)) {
      productType = type
      break
    }
  }

  // Extract policy number
  let policyNumber: string | null = null
  for (const pattern of POLICY_NUMBER_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      policyNumber = match[1]
      break
    }
  }

  // Extract expiry date
  let expiryDate: string | null = null
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      try {
        const parsed = new Date(match[1])
        if (!isNaN(parsed.getTime())) {
          expiryDate = parsed.toISOString().slice(0, 10)
        }
      } catch { /* ignore parse errors */ }
      break
    }
  }

  return {
    emailId: email.id,
    signalType: matchedType,
    productType,
    policyNumber,
    expiryDate,
    fromEmail: email.from_address,
    fromName: email.from_name || email.from_address,
    snippet,
  }
}
