/**
 * Commitment Pre-filter and Post-filter
 * Zero-cost rule layers that run before/after LLM extraction.
 *
 * Pre-filter: skip emails that can't contain commitments (saves LLM calls)
 * Post-filter: catch false positives the LLM missed (improves precision)
 */

// ─── Pre-filter: Should this email be sent to LLM? ───

export interface EmailForFilter {
  from_address: string
  from_name?: string
  subject?: string
  snippet?: string
  to_address?: string
  is_outbound?: boolean
}

export interface PreFilterResult {
  skip: boolean
  reason: string
}

const SYSTEM_SENDERS = [
  'noreply', 'no-reply', 'donotreply', 'do-not-reply',
  'mailer-daemon', 'postmaster',
  'notifications@', 'notification@', 'alert@', 'alerts@',
  'billing@', 'invoice@', 'receipt@',
  'calendar-notification', 'calendar@google',
  'feedback@', 'survey@', 'support@',
]

const NEWSLETTER_PATTERNS = [
  'newsletter', 'digest', 'weekly update', 'monthly update',
  'unsubscribe', 'marketing', 'promo', 'campaign',
  'mailchimp', 'sendgrid', 'hubspot', 'substack',
]

const AUTO_REPLY_PATTERNS = [
  'out of office', 'out-of-office', 'auto-reply', 'auto reply',
  'automatic reply', 'away from', 'on vacation', 'on leave',
  '自动回复', '不在办公室', '休假中',
]

const CALENDAR_PATTERNS = [
  'accepted:', 'declined:', 'tentative:',
  'invitation:', 'updated invitation:',
  '.ics', 'calendar event',
]

export function shouldSkipEmail(email: EmailForFilter, userEmail?: string): PreFilterResult {
  const from = (email.from_address || '').toLowerCase()
  const subject = (email.subject || '').toLowerCase()
  const snippet = (email.snippet || '').trim()

  // 1. System senders
  if (SYSTEM_SENDERS.some(s => from.includes(s))) {
    return { skip: true, reason: 'system_sender' }
  }

  // 2. Newsletter / marketing
  if (NEWSLETTER_PATTERNS.some(p => from.includes(p) || subject.includes(p))) {
    return { skip: true, reason: 'newsletter' }
  }

  // 3. Auto-reply
  if (AUTO_REPLY_PATTERNS.some(p => subject.includes(p) || snippet.toLowerCase().includes(p))) {
    return { skip: true, reason: 'auto_reply' }
  }

  // 4. Calendar system messages
  if (CALENDAR_PATTERNS.some(p => subject.includes(p) || from.includes('calendar'))) {
    return { skip: true, reason: 'calendar_system' }
  }

  // 5. User only in CC, not in TO (for inbound emails)
  if (!email.is_outbound && userEmail && email.to_address) {
    const toList = email.to_address.toLowerCase()
    if (!toList.includes(userEmail.toLowerCase())) {
      return { skip: true, reason: 'cc_only' }
    }
  }

  // 6. Content too short to contain a commitment
  if (snippet.length < 20) {
    return { skip: true, reason: 'too_short' }
  }

  // 7. Common automated notifications
  const automatedSubjects = [
    'your order', 'order confirmation', 'shipping', 'delivery',
    'password reset', 'verify your', 'confirm your',
    'security alert', 'login attempt', 'two-factor',
  ]
  if (automatedSubjects.some(p => subject.includes(p))) {
    return { skip: true, reason: 'automated_notification' }
  }

  return { skip: false, reason: '' }
}


// ─── Post-filter: Validate LLM extraction results ───

export interface ExtractedCommitment {
  type: string
  title: string
  confidence: number
  due_date?: string | null
  due_reason?: string | null
}

export interface PostFilterResult {
  passed: ExtractedCommitment[]
  filtered: Array<ExtractedCommitment & { filtered_reason: string }>
}

const CONDITIONAL_PATTERN = /\b(probably|might|maybe|perhaps|could possibly|if .{3,30} then|depends on|not sure|not certain|contingent)\b/i
const CONDITIONAL_PATTERN_ZH = /(可能|也许|大概|如果.{2,15}的话|看情况|不确定|待定)/

const ATTENDANCE_PATTERN = /^(attend|be there|join|show up|come to|go to|participate in)/i
const ATTENDANCE_PATTERN_ZH = /^(参加|出席|去|到场)/

const PLEASANTRY_TITLES = [
  'respond when return', 'get back to you',
  'catch up', 'stay in touch', 'keep in touch',
  'circle back', 'touch base',
]

export function postFilterCommitments(
  commitments: ExtractedCommitment[],
  existingTitles: string[] = []
): PostFilterResult {
  const passed: ExtractedCommitment[] = []
  const filtered: Array<ExtractedCommitment & { filtered_reason: string }> = []

  for (const c of commitments) {
    // 1. Confidence threshold (should be handled by LLM, but double-check)
    if (c.confidence < 0.7) {
      filtered.push({ ...c, filtered_reason: 'low_confidence' })
      continue
    }

    // 2. Conditional language
    if (CONDITIONAL_PATTERN.test(c.title) || CONDITIONAL_PATTERN_ZH.test(c.title)) {
      filtered.push({ ...c, filtered_reason: 'conditional_language' })
      continue
    }

    // 3. Simple attendance confirmation
    const titleWords = c.title.split(/\s+/)
    if ((ATTENDANCE_PATTERN.test(c.title) || ATTENDANCE_PATTERN_ZH.test(c.title)) && titleWords.length < 6) {
      filtered.push({ ...c, filtered_reason: 'attendance_confirmation' })
      continue
    }

    // 4. Pleasantry-like titles
    if (PLEASANTRY_TITLES.some(p => c.title.toLowerCase().includes(p))) {
      filtered.push({ ...c, filtered_reason: 'pleasantry' })
      continue
    }

    // 5. Title too short (likely noise)
    const titleContent = c.title.replace(/\s/g, '')
    if (titleContent.length < 6) {
      filtered.push({ ...c, filtered_reason: 'title_too_short' })
      continue
    }

    // 6. Dedup against existing active commitments
    const isDupe = existingTitles.some(existing =>
      jaccardSimilarity(existing.toLowerCase(), c.title.toLowerCase()) > 0.7
    )
    if (isDupe) {
      filtered.push({ ...c, filtered_reason: 'duplicate' })
      continue
    }

    passed.push(c)
  }

  // 7. Per-email limit: if too many passed, keep top by confidence
  if (passed.length > 4) {
    passed.sort((a, b) => b.confidence - a.confidence)
    const dropped = passed.splice(3)
    for (const d of dropped) {
      filtered.push({ ...d, filtered_reason: 'per_email_limit' })
    }
  }

  return { passed, filtered }
}


// ─── Utility: Jaccard similarity on word sets ───

function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 1))
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 1))
  if (wordsA.size === 0 && wordsB.size === 0) return 1
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)))
  const union = new Set([...wordsA, ...wordsB])
  return intersection.size / union.size
}
