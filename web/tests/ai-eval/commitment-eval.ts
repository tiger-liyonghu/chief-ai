/**
 * AI Accuracy Evaluation: Commitment Extraction
 *
 * Tests the LLM-based commitment extraction against 30 labeled emails.
 * Uses REAL LLM calls (DeepSeek) — not mocks.
 *
 * Run: npx tsx tests/ai-eval/commitment-eval.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

// Load .env.local manually (no dotenv dependency)
try {
  const envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      process.env[key] = val
    }
  }
} catch { /* .env.local not found, rely on environment */ }
import { resolve, dirname } from 'path'
import OpenAI from 'openai'

// ---------------------------------------------------------------------------
// Load environment
// ---------------------------------------------------------------------------
const envPath = resolve(__dirname, '../../.env.local')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx)
    const val = trimmed.slice(eqIdx + 1)
    if (!process.env[key]) process.env[key] = val
  }
} catch {
  // .env.local not found, rely on existing env vars
}

const API_KEY = process.env.DEEPSEEK_API_KEY
if (!API_KEY) {
  console.error('ERROR: DEEPSEEK_API_KEY not found. Set it in .env.local or environment.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// AI client — mirrors unified-client.ts systemAIClient
// ---------------------------------------------------------------------------
const client = new OpenAI({
  apiKey: API_KEY,
  baseURL: 'https://api.deepseek.com',
})

const MODEL = 'deepseek-chat'
const TEMPERATURE = 0.2 // matches commitment_scan task profile
const MAX_TOKENS = 300

// ---------------------------------------------------------------------------
// System prompt — imported from production (single source of truth)
// ---------------------------------------------------------------------------
import { COMMITMENT_EXTRACTION_SYSTEM } from '../../lib/ai/prompts/commitment-extraction'
const SYSTEM_PROMPT = COMMITMENT_EXTRACTION_SYSTEM

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CommitmentType = 'i_promised' | 'waiting_on_them'

interface ExpectedCommitment {
  type: CommitmentType
  titlePattern: string // substring or regex pattern to match against extracted title
  hasDueDate: boolean
}

interface TestEmail {
  id: number
  category: 'positive' | 'negative' | 'edge_case'
  description: string
  to: string
  subject: string
  body: string
  date: string
  expected: ExpectedCommitment[]
}

interface ExtractedCommitment {
  type: string
  title: string
  due_date: string | null
  due_reason?: string
  confidence: number
}

interface LLMResponse {
  commitments: ExtractedCommitment[]
  summary: string
}

// ---------------------------------------------------------------------------
// Ground truth dataset — 30 labeled emails
// ---------------------------------------------------------------------------
const TEST_EMAILS: TestEmail[] = [
  // =========================================================================
  // POSITIVE: 15 emails that SHOULD produce commitments
  // =========================================================================
  {
    id: 1,
    category: 'positive',
    description: 'Simple I-will-send promise',
    to: 'david@company.com',
    subject: 'Re: Pitch Deck',
    body: `Hi David,

Thanks for the meeting today. I'll send over the updated pitch deck by end of day Friday.

Best,
Tiger`,
    date: '2026-03-25',
    expected: [
      { type: 'i_promised', titlePattern: 'pitch deck', hasDueDate: true },
    ],
  },
  {
    id: 2,
    category: 'positive',
    description: 'Request for information',
    to: 'sarah@vendor.com',
    subject: 'Pricing proposal',
    body: `Hi Sarah,

Could you send me the updated pricing proposal by next Monday? We need to finalize the budget.

Thanks,
Tiger`,
    date: '2026-03-24',
    expected: [
      { type: 'waiting_on_them', titlePattern: 'pricing proposal', hasDueDate: true },
    ],
  },
  {
    id: 3,
    category: 'positive',
    description: 'Multiple commitments in one email',
    to: 'team@company.com',
    subject: 'Action items from standup',
    body: `Hi team,

Following up on today's standup:

1. I will prepare the quarterly report and share it by Wednesday.
2. Please send me your individual KPI updates by tomorrow.
3. I'll set up the new Slack channel for the project today.

Cheers,
Tiger`,
    date: '2026-03-26',
    expected: [
      { type: 'i_promised', titlePattern: 'quarterly report', hasDueDate: true },
      { type: 'waiting_on_them', titlePattern: 'KPI', hasDueDate: true },
      { type: 'i_promised', titlePattern: 'slack channel', hasDueDate: true },
    ],
  },
  {
    id: 4,
    category: 'positive',
    description: 'Chinese language commitment',
    to: 'wang@partner.cn',
    subject: 'Re: 合同确认',
    body: `王总好，

收到，我这边今天下午把合同修改稿发给你，麻烦你让法务审一下。

Tiger`,
    date: '2026-03-27',
    expected: [
      { type: 'i_promised', titlePattern: '合同|contract|修订|revision', hasDueDate: true },
      { type: 'waiting_on_them', titlePattern: '法务|legal|审核|review', hasDueDate: false },
    ],
  },
  {
    id: 5,
    category: 'positive',
    description: 'Follow-up request with soft deadline',
    to: 'mike@client.com',
    subject: 'Re: Project timeline',
    body: `Mike,

Thanks for sharing the requirements. Let me review them and get back to you with a detailed proposal early next week. In the meantime, can you confirm the budget range so I can scope appropriately?

Best,
Tiger`,
    date: '2026-03-25',
    expected: [
      { type: 'i_promised', titlePattern: 'proposal', hasDueDate: true },
      { type: 'waiting_on_them', titlePattern: 'budget', hasDueDate: false },
    ],
  },
  {
    id: 6,
    category: 'positive',
    description: 'Will-do acknowledgment',
    to: 'lisa@company.com',
    subject: 'Re: Onboarding materials',
    body: `Lisa,

Sure, will do. I'll prepare the onboarding doc and have it ready before the new hire starts on April 1st.

Tiger`,
    date: '2026-03-28',
    expected: [
      { type: 'i_promised', titlePattern: 'onboarding', hasDueDate: true },
    ],
  },
  {
    id: 7,
    category: 'positive',
    description: 'Request for a meeting',
    to: 'alex@investor.com',
    subject: 'Intro call',
    body: `Hi Alex,

I'd love to connect. Could you let me know your availability next week for a 30-minute call? I can send a calendar invite once confirmed.

Looking forward,
Tiger`,
    date: '2026-03-24',
    expected: [
      { type: 'waiting_on_them', titlePattern: 'availability', hasDueDate: true },
    ],
  },
  {
    id: 8,
    category: 'positive',
    description: 'Promise to introduce someone',
    to: 'james@friend.com',
    subject: 'Introduction',
    body: `James,

Great chatting yesterday. As promised, I'll introduce you to Sarah from the analytics team. Let me loop her in tomorrow.

Cheers,
Tiger`,
    date: '2026-03-26',
    expected: [
      { type: 'i_promised', titlePattern: 'introduce|loop', hasDueDate: true },
    ],
  },
  {
    id: 9,
    category: 'positive',
    description: 'Data request with deadline',
    to: 'analytics@company.com',
    subject: 'Monthly data pull',
    body: `Hi Analytics Team,

Please pull the March user engagement data and share the dashboard with me by April 2nd. I need it for the board deck.

Thanks,
Tiger`,
    date: '2026-03-28',
    expected: [
      { type: 'waiting_on_them', titlePattern: 'data|dashboard', hasDueDate: true },
    ],
  },
  {
    id: 10,
    category: 'positive',
    description: 'I will fix a bug',
    to: 'eng@company.com',
    subject: 'Re: Login bug',
    body: `Got it, I'll look into the login redirect bug this afternoon and push a fix before EOD.

Tiger`,
    date: '2026-03-27',
    expected: [
      { type: 'i_promised', titlePattern: 'login|bug|fix', hasDueDate: true },
    ],
  },
  {
    id: 11,
    category: 'positive',
    description: 'Mixed Chinese-English promise',
    to: 'chen@team.com',
    subject: 'Re: 周报',
    body: `Chen,

好的我来写Q1 summary，你那边麻烦帮忙把customer feedback整理一下发给我。

Tiger`,
    date: '2026-03-29',
    expected: [
      { type: 'i_promised', titlePattern: 'Q1 summary|summary', hasDueDate: false },
      { type: 'waiting_on_them', titlePattern: 'feedback|customer', hasDueDate: false },
    ],
  },
  {
    id: 12,
    category: 'positive',
    description: 'Scheduling commitment',
    to: 'hr@company.com',
    subject: 'Re: Performance reviews',
    body: `Thanks for the reminder. I will complete all my direct reports' performance reviews by end of this week. Can you share the review template?

Tiger`,
    date: '2026-03-24',
    expected: [
      { type: 'i_promised', titlePattern: 'performance review', hasDueDate: true },
      { type: 'waiting_on_them', titlePattern: 'review template|template', hasDueDate: false },
    ],
  },
  {
    id: 13,
    category: 'positive',
    description: 'Promise to pay / financial commitment',
    to: 'accounts@vendor.com',
    subject: 'Re: Invoice #4521',
    body: `Hi,

I'll process the payment for invoice #4521 by end of this month. Please confirm the wire transfer details.

Regards,
Tiger`,
    date: '2026-03-25',
    expected: [
      { type: 'i_promised', titlePattern: 'payment|invoice', hasDueDate: true },
      { type: 'waiting_on_them', titlePattern: 'wire|transfer|details', hasDueDate: false },
    ],
  },
  {
    id: 14,
    category: 'positive',
    description: 'Promise to share document',
    to: 'partner@external.com',
    subject: 'NDA',
    body: `Hi there,

I can have our legal team draft the NDA by Thursday. Will send it over for your review.

Tiger`,
    date: '2026-03-26',
    expected: [
      { type: 'i_promised', titlePattern: 'NDA|draft', hasDueDate: true },
    ],
  },
  {
    id: 15,
    category: 'positive',
    description: 'Request with "looking forward to"',
    to: 'design@agency.com',
    subject: 'Brand refresh',
    body: `Hi Design Team,

We're excited to kick off the brand refresh. Looking forward to receiving the initial mood boards by next Friday. I'll send over our brand guidelines document tomorrow.

Tiger`,
    date: '2026-03-25',
    expected: [
      { type: 'waiting_on_them', titlePattern: 'mood board', hasDueDate: true },
      { type: 'i_promised', titlePattern: 'brand guidelines', hasDueDate: true },
    ],
  },

  // =========================================================================
  // NEGATIVE: 10 emails that should NOT produce commitments
  // =========================================================================
  {
    id: 16,
    category: 'negative',
    description: 'Simple thank you',
    to: 'colleague@company.com',
    subject: 'Re: Report',
    body: `Thanks for sending this over. Looks great!

Tiger`,
    date: '2026-03-25',
    expected: [],
  },
  {
    id: 17,
    category: 'negative',
    description: 'FYI forward',
    to: 'team@company.com',
    subject: 'FYI: Industry report',
    body: `Hi team,

FYI, sharing this industry report from McKinsey. Interesting read on the SG market trends.

Tiger`,
    date: '2026-03-24',
    expected: [],
  },
  {
    id: 18,
    category: 'negative',
    description: 'Newsletter-style update',
    to: 'subscribers@list.com',
    subject: 'Weekly Update: March 24',
    body: `Hi everyone,

Here's this week's update:
- Feature X launched to 100% of users
- Revenue grew 12% MoM
- We hired 2 new engineers

Have a great week!
Tiger`,
    date: '2026-03-24',
    expected: [],
  },
  {
    id: 19,
    category: 'negative',
    description: 'Short acknowledgment',
    to: 'boss@company.com',
    subject: 'Re: Meeting notes',
    body: `Got it, makes sense. Thanks!`,
    date: '2026-03-26',
    expected: [],
  },
  {
    id: 20,
    category: 'negative',
    description: 'Congratulations message',
    to: 'friend@company.com',
    subject: 'Congrats!',
    body: `Hey John,

Congrats on the promotion! Well deserved. Let's grab coffee sometime to celebrate.

Tiger`,
    date: '2026-03-25',
    expected: [],
  },
  {
    id: 21,
    category: 'negative',
    description: 'Out of office auto-reply',
    to: 'contact@external.com',
    subject: 'OOO: March 26-28',
    body: `Hi,

I'm currently out of the office with limited access to email. I'll respond to your message when I return on March 29.

For urgent matters, please contact lisa@company.com.

Tiger`,
    date: '2026-03-26',
    expected: [],
  },
  {
    id: 22,
    category: 'negative',
    description: 'Simple forwarded article',
    to: 'colleague@company.com',
    subject: 'Fwd: Great article on AI trends',
    body: `Saw this and thought of you. Worth a read!

---------- Forwarded message ---------
AI is transforming insurance...`,
    date: '2026-03-27',
    expected: [],
  },
  {
    id: 23,
    category: 'negative',
    description: 'Acceptance without action',
    to: 'organizer@event.com',
    subject: 'Re: Event invitation',
    body: `Thanks for the invite! I'll be there.

Tiger`,
    date: '2026-03-25',
    expected: [],
  },
  {
    id: 24,
    category: 'negative',
    description: 'Opinion sharing, no action',
    to: 'team@company.com',
    subject: 'Re: Feature proposal',
    body: `I think this is a solid approach. The user flow looks clean and the technical architecture makes sense. No concerns from my side.

Tiger`,
    date: '2026-03-26',
    expected: [],
  },
  {
    id: 25,
    category: 'negative',
    description: 'Chinese small talk',
    to: 'friend@personal.com',
    subject: 'Re: 周末',
    body: `哈哈好的，那我们到时候再说吧。最近太忙了。

Tiger`,
    date: '2026-03-28',
    expected: [],
  },

  // =========================================================================
  // EDGE CASES: 5 tricky emails
  // =========================================================================
  {
    id: 26,
    category: 'edge_case',
    description: 'Conditional promise — should NOT be a commitment',
    to: 'partner@external.com',
    subject: 'Re: Collaboration',
    body: `Hi,

If we get the funding approved, I would be happy to sponsor the event. Let's revisit once we hear back from the board.

Tiger`,
    date: '2026-03-25',
    expected: [], // conditional — not a firm commitment
  },
  {
    id: 27,
    category: 'edge_case',
    description: 'Pleasantry that sounds like a commitment',
    to: 'old-colleague@elsewhere.com',
    subject: 'Long time!',
    body: `Hey!

Great to hear from you! We should definitely catch up soon. Let me know when you're free!

Tiger`,
    date: '2026-03-24',
    expected: [], // "we should catch up" is social pleasantry, not a real commitment
  },
  {
    id: 28,
    category: 'edge_case',
    description: 'Past tense — already done, not a new commitment',
    to: 'admin@company.com',
    subject: 'Re: Expense report',
    body: `Hi,

I already submitted the expense report yesterday. I've also attached the receipts. Let me know if anything is missing.

Tiger`,
    date: '2026-03-27',
    expected: [], // past tense — already done, no new commitment
  },
  {
    id: 29,
    category: 'edge_case',
    description: 'Suggestion vs commitment — ambiguous',
    to: 'team@company.com',
    subject: 'Re: Sprint planning',
    body: `I can take on the API refactoring task if no one else has bandwidth. Let me know what you think.

Tiger`,
    date: '2026-03-26',
    expected: [], // "I can take on" is an offer, not a firm commitment
  },
  {
    id: 30,
    category: 'edge_case',
    description: 'Commitment embedded in a long email with noise',
    to: 'client@bigco.com',
    subject: 'Re: Q1 Review',
    body: `Hi Rachel,

Thanks for the detailed feedback on the Q1 deliverables. The team has been working hard and I appreciate the acknowledgment.

Regarding the data discrepancy you flagged — good catch. I'll investigate and send you a corrected version of the report by Monday.

On the topic of Q2 planning, I think we're broadly aligned. The market is shifting and we need to stay nimble. Lots of interesting trends in the region.

Best,
Tiger`,
    date: '2026-03-28',
    expected: [
      { type: 'i_promised', titlePattern: 'report|corrected|investigate', hasDueDate: true },
    ],
  },
]

// ---------------------------------------------------------------------------
// LLM call — mirrors production code
// ---------------------------------------------------------------------------
async function extractCommitments(email: TestEmail): Promise<LLMResponse> {
  const userMessage = `Channel: email
To: ${email.to}
Subject: ${email.subject}
Date: ${email.date}

${email.body.slice(0, 3000)}`

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
    })

    const raw = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(raw) as LLMResponse

    // Filter by confidence >= 0.5, matching production behavior
    parsed.commitments = (parsed.commitments || []).filter(
      (c) => c.confidence >= 0.5
    )

    return parsed
  } catch (err: any) {
    console.error(`  [API ERROR for email #${email.id}]: ${err.message}`)
    return { commitments: [], summary: 'API call failed' }
  }
}

// ---------------------------------------------------------------------------
// Matching logic
// ---------------------------------------------------------------------------
function titleMatches(extracted: string, pattern: string): boolean {
  const lower = extracted.toLowerCase()
  // Pattern can contain | for OR matching
  const parts = pattern.toLowerCase().split('|')
  return parts.some((p) => lower.includes(p.trim()))
}

interface MatchResult {
  emailId: number
  category: string
  description: string
  expectedCount: number
  extractedCount: number
  truePositives: number
  falsePositives: number
  falseNegatives: number
  details: string[]
}

function evaluateEmail(
  email: TestEmail,
  response: LLMResponse
): MatchResult {
  const extracted = response.commitments
  const expected = email.expected
  const details: string[] = []

  // Track which expected commitments were matched
  const matchedExpected = new Set<number>()
  const matchedExtracted = new Set<number>()

  // Greedy matching: for each expected, find best matching extracted
  for (let ei = 0; ei < expected.length; ei++) {
    const exp = expected[ei]
    for (let xi = 0; xi < extracted.length; xi++) {
      if (matchedExtracted.has(xi)) continue
      const ext = extracted[xi]

      const typeMatch = ext.type === exp.type
      const titleMatch = titleMatches(ext.title, exp.titlePattern)

      if (typeMatch && titleMatch) {
        matchedExpected.add(ei)
        matchedExtracted.add(xi)
        break
      }
    }
  }

  const truePositives = matchedExpected.size
  const falseNegatives = expected.length - truePositives
  const falsePositives = extracted.length - matchedExtracted.size

  // Log failures
  for (let ei = 0; ei < expected.length; ei++) {
    if (!matchedExpected.has(ei)) {
      details.push(
        `  FN: Expected ${expected[ei].type} "${expected[ei].titlePattern}", got nothing`
      )
    }
  }
  for (let xi = 0; xi < extracted.length; xi++) {
    if (!matchedExtracted.has(xi)) {
      details.push(
        `  FP: Unexpected ${extracted[xi].type} "${extracted[xi].title}" (conf=${extracted[xi].confidence})`
      )
    }
  }

  return {
    emailId: email.id,
    category: email.category,
    description: email.description,
    expectedCount: expected.length,
    extractedCount: extracted.length,
    truePositives,
    falsePositives,
    falseNegatives,
    details,
  }
}

// ---------------------------------------------------------------------------
// Main evaluation loop
// ---------------------------------------------------------------------------
async function runEval() {
  console.log('Commitment Extraction Evaluation')
  console.log('================================')
  console.log(`Model: ${MODEL} | Temperature: ${TEMPERATURE}`)
  console.log(`Emails: ${TEST_EMAILS.length}`)
  console.log('')

  const results: MatchResult[] = []
  const rawResponses: Record<number, LLMResponse> = {}

  // Per-type accumulators
  const perType: Record<CommitmentType, { tp: number; fp: number; fn: number }> = {
    i_promised: { tp: 0, fp: 0, fn: 0 },
    waiting_on_them: { tp: 0, fp: 0, fn: 0 },
  }

  // Process sequentially to avoid rate limits
  for (const email of TEST_EMAILS) {
    process.stdout.write(`  Testing email #${email.id} (${email.description})...`)
    const response = await extractCommitments(email)
    rawResponses[email.id] = response
    const result = evaluateEmail(email, response)
    results.push(result)

    // Accumulate per-type stats from matched/unmatched
    const extracted = response.commitments
    const expected = email.expected

    // Re-do matching per type
    const matchedExpIdx = new Set<number>()
    const matchedExtIdx = new Set<number>()
    for (let ei = 0; ei < expected.length; ei++) {
      for (let xi = 0; xi < extracted.length; xi++) {
        if (matchedExtIdx.has(xi)) continue
        if (
          extracted[xi].type === expected[ei].type &&
          titleMatches(extracted[xi].title, expected[ei].titlePattern)
        ) {
          matchedExpIdx.add(ei)
          matchedExtIdx.add(xi)
          const t = expected[ei].type as CommitmentType
          perType[t].tp++
          break
        }
      }
    }
    for (let ei = 0; ei < expected.length; ei++) {
      if (!matchedExpIdx.has(ei)) {
        const t = expected[ei].type as CommitmentType
        perType[t].fn++
      }
    }
    for (let xi = 0; xi < extracted.length; xi++) {
      if (!matchedExtIdx.has(xi)) {
        const t = (extracted[xi].type === 'i_promised' || extracted[xi].type === 'waiting_on_them')
          ? extracted[xi].type as CommitmentType
          : 'i_promised' // fallback for unexpected types
        perType[t].fp++
      }
    }

    const status =
      result.falsePositives === 0 && result.falseNegatives === 0
        ? 'PASS'
        : 'FAIL'
    console.log(` ${status}`)
  }

  // ---------------------------------------------------------------------------
  // Aggregate metrics
  // ---------------------------------------------------------------------------
  let totalTP = 0
  let totalFP = 0
  let totalFN = 0

  for (const r of results) {
    totalTP += r.truePositives
    totalFP += r.falsePositives
    totalFN += r.falseNegatives
  }

  const precision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0
  const recall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0

  // False positive rate on negative emails (emails 16-25 + edge cases with no expected)
  const negativeEmails = results.filter(
    (r) => r.expectedCount === 0
  )
  const fpNegativeCount = negativeEmails.filter((r) => r.extractedCount > 0).length

  // ---------------------------------------------------------------------------
  // Print report
  // ---------------------------------------------------------------------------
  console.log('')
  console.log('Results')
  console.log('-------')
  console.log(`Emails tested:  ${TEST_EMAILS.length}`)
  console.log(`Precision:      ${(precision * 100).toFixed(1)}% (target: >85%)`)
  console.log(`Recall:         ${(recall * 100).toFixed(1)}% (target: >80%)`)
  console.log(`F1:             ${(f1 * 100).toFixed(1)}%`)
  console.log('')

  console.log('Per-type:')
  for (const [typeName, stats] of Object.entries(perType)) {
    const p = stats.tp + stats.fp > 0 ? stats.tp / (stats.tp + stats.fp) : 0
    const r = stats.tp + stats.fn > 0 ? stats.tp / (stats.tp + stats.fn) : 0
    console.log(
      `  ${typeName.padEnd(18)} P=${(p * 100).toFixed(0)}% R=${(r * 100).toFixed(0)}%  (TP=${stats.tp} FP=${stats.fp} FN=${stats.fn})`
    )
  }
  console.log('')

  console.log(
    `False positives on non-commitment emails: ${fpNegativeCount}/${negativeEmails.length} (${negativeEmails.length > 0 ? ((fpNegativeCount / negativeEmails.length) * 100).toFixed(0) : 0}%)`
  )
  console.log('')

  // Print failures
  const failures = results.filter((r) => r.details.length > 0)
  if (failures.length > 0) {
    console.log('Failures:')
    for (const f of failures) {
      console.log(`  Email #${f.emailId} [${f.category}]: ${f.description}`)
      for (const d of f.details) {
        console.log(`    ${d}`)
      }
    }
  } else {
    console.log('No failures - perfect score!')
  }

  // ---------------------------------------------------------------------------
  // Pass/fail verdict
  // ---------------------------------------------------------------------------
  console.log('')
  const pass = precision >= 0.85 && recall >= 0.80
  console.log(
    pass
      ? 'VERDICT: PASS - meets accuracy targets'
      : 'VERDICT: FAIL - below accuracy targets'
  )

  // ---------------------------------------------------------------------------
  // Save results to JSON
  // ---------------------------------------------------------------------------
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '')
  const resultsDir = resolve(__dirname, 'results')
  mkdirSync(resultsDir, { recursive: true })
  const outPath = resolve(resultsDir, `eval-${dateStr}-${timeStr}.json`)

  const report = {
    timestamp: now.toISOString(),
    model: MODEL,
    temperature: TEMPERATURE,
    emailCount: TEST_EMAILS.length,
    metrics: {
      precision: +precision.toFixed(4),
      recall: +recall.toFixed(4),
      f1: +f1.toFixed(4),
      falsePositiveRate: negativeEmails.length > 0 ? +(fpNegativeCount / negativeEmails.length).toFixed(4) : 0,
    },
    perType: Object.fromEntries(
      Object.entries(perType).map(([t, s]) => [
        t,
        {
          precision: s.tp + s.fp > 0 ? +(s.tp / (s.tp + s.fp)).toFixed(4) : null,
          recall: s.tp + s.fn > 0 ? +(s.tp / (s.tp + s.fn)).toFixed(4) : null,
          tp: s.tp,
          fp: s.fp,
          fn: s.fn,
        },
      ])
    ),
    targets: { precision: 0.85, recall: 0.80 },
    pass,
    perEmail: results.map((r) => ({
      id: r.emailId,
      category: r.category,
      description: r.description,
      expected: r.expectedCount,
      extracted: r.extractedCount,
      tp: r.truePositives,
      fp: r.falsePositives,
      fn: r.falseNegatives,
      details: r.details,
    })),
    rawResponses,
  }

  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`\nResults saved to: ${outPath}`)
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
runEval().catch((err) => {
  console.error('Evaluation failed:', err)
  process.exit(1)
})
