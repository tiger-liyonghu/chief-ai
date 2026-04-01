/**
 * Commitment Extraction Eval — CLI Runner (v2)
 *
 * Runs 210+ test emails through the FULL commitment extraction pipeline:
 *   Pre-filter -> LLM extraction -> Post-filter -> Ground truth comparison
 *
 * Usage:
 *   npx tsx tests/ai-eval/run-eval.ts [options]
 *
 * Options:
 *   --category <name>       Filter by category (e.g., business_positive_en)
 *   --difficulty <level>    Filter by easy|medium|hard
 *   --language <lang>       Filter by en|zh|mixed
 *   --limit <n>             Only run first N tests
 *   --concurrency <n>       Parallel LLM calls (default: 5)
 *   --verbose               Show each test result
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import OpenAI from 'openai'

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------
try {
  const envPath = resolve(process.cwd(), '.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx)
    const val = trimmed.slice(eqIdx + 1)
    process.env[key] = val
  }
} catch {
  // .env.local not found, rely on existing env vars
}

// ---------------------------------------------------------------------------
// Imports — production code (single source of truth)
// ---------------------------------------------------------------------------
import { COMMITMENT_EXTRACTION_SYSTEM } from '../../lib/ai/prompts/commitment-extraction'
import { shouldSkipEmail, postFilterCommitments } from '../../lib/ai/commitment-filters'
import type { EmailForFilter, ExtractedCommitment } from '../../lib/ai/commitment-filters'

// Test data — will be created separately
import { TEST_EMAILS } from './commitment-test-data'

// Reporter
import { generateMarkdownReport, saveResults } from './eval-reporter'
import type { TestResult, EvalRunMeta } from './eval-reporter'

// ---------------------------------------------------------------------------
// Types — re-export from test data (single source of truth)
// ---------------------------------------------------------------------------
import type { TestEmail, ExpectedCommitment } from './commitment-test-data'

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
function parseArgs(): {
  category?: string
  difficulty?: string
  language?: string
  limit?: number
  concurrency: number
  verbose: boolean
} {
  const args = process.argv.slice(2)
  const opts: ReturnType<typeof parseArgs> = { concurrency: 5, verbose: false }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--category':
        opts.category = args[++i]
        break
      case '--difficulty':
        opts.difficulty = args[++i]
        break
      case '--language':
        opts.language = args[++i]
        break
      case '--limit':
        opts.limit = parseInt(args[++i], 10)
        break
      case '--concurrency':
        opts.concurrency = parseInt(args[++i], 10)
        break
      case '--verbose':
        opts.verbose = true
        break
    }
  }

  return opts
}

// ---------------------------------------------------------------------------
// AI client
// ---------------------------------------------------------------------------
const API_KEY = process.env.DEEPSEEK_API_KEY
if (!API_KEY) {
  console.error('ERROR: DEEPSEEK_API_KEY not found. Set it in .env.local or environment.')
  process.exit(1)
}

const client = new OpenAI({
  apiKey: API_KEY,
  baseURL: 'https://api.deepseek.com',
})

const MODEL = 'deepseek-chat'
const TEMPERATURE = 0.2
const MAX_TOKENS = 1200

// ---------------------------------------------------------------------------
// LLM call
// ---------------------------------------------------------------------------
interface LLMResponse {
  commitments: ExtractedCommitment[]
  rejected?: any[]
  summary: string
}

async function extractCommitments(email: TestEmail): Promise<LLMResponse> {
  // Detect direction: if from=tiger/user, it's outbound (user's own email)
  const isOutbound = email.from_address.includes('tiger') || email.from_address.includes('actuaryhelp') || email.from_address.includes('nkliyonghu')
  const perspective = isOutbound
    ? `This email was SENT BY the user. "i_promised" = commitments the user (sender) made. "waiting_on_them" = things the user asked the recipient to do.`
    : `This email was RECEIVED BY the user. "i_promised" = things the sender asked the user to do (user's obligation). "waiting_on_them" = commitments the sender made to the user.`

  const userMessage = `Channel: email
From: ${email.from_name} <${email.from_address}>
To: ${email.to_address}
Subject: ${email.subject}
Date: ${email.date}

${perspective}

${email.body.slice(0, 3000)}`

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: COMMITMENT_EXTRACTION_SYSTEM },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
    })

    const raw = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(raw) as LLMResponse
    parsed.commitments = parsed.commitments || []
    return parsed
  } catch (err: any) {
    console.error(`  [API ERROR for email #${email.id}]: ${err.message}`)
    return { commitments: [], summary: 'API call failed' }
  }
}

// ---------------------------------------------------------------------------
// Matching logic
// ---------------------------------------------------------------------------
/**
 * Determine if an email should be caught by the pre-filter (auto-generated, newsletters, etc.)
 */
function shouldBePrefiltered(email: TestEmail): boolean {
  const cat = email.category.toLowerCase()
  return cat.includes('auto') || cat.includes('newsletter') || cat.includes('system')
}

function titleMatches(extractedTitle: string, pattern: string): boolean {
  // Auto-detect regex: starts with / OR contains regex metacharacters (.*  |  \b  etc.)
  const isRegex = pattern.startsWith('/') || /[.*+?|\\[\](){}^$]/.test(pattern)

  if (isRegex) {
    // Strip leading/trailing / if present
    let regexBody = pattern
    if (pattern.startsWith('/')) {
      const lastSlash = pattern.lastIndexOf('/')
      regexBody = pattern.slice(1, lastSlash > 0 ? lastSlash : undefined)
    }
    try {
      const re = new RegExp(regexBody, 'i')
      return re.test(extractedTitle)
    } catch {
      // Fallback to substring if regex is invalid
      return extractedTitle.toLowerCase().includes(regexBody.toLowerCase())
    }
  }

  // Plain substring match (case insensitive)
  return extractedTitle.toLowerCase().includes(pattern.toLowerCase())
}

function evaluateEmail(
  email: TestEmail,
  llmResponse: LLMResponse | null,
  preFilterSkipped: boolean,
): TestResult {
  const details: string[] = []
  const expected = email.expected_commitments

  // --- Pre-filter evaluation ---
  const isNegative = expected.length === 0
  let preFilterCorrect = true

  if (shouldBePrefiltered(email)) {
    // Email should have been pre-filtered out
    preFilterCorrect = preFilterSkipped
    if (!preFilterSkipped) {
      details.push(`PRE-FILTER MISS: should have been skipped but was sent to LLM`)
    }
  } else if (preFilterSkipped && !isNegative) {
    // Email was incorrectly skipped by pre-filter
    preFilterCorrect = false
    details.push(`PRE-FILTER FALSE SKIP: email was skipped but has expected commitments`)
  }

  // If pre-filter skipped and email is negative, that's correct
  if (preFilterSkipped && isNegative) {
    preFilterCorrect = true
  }

  // If pre-filtered, no LLM response to evaluate
  if (preFilterSkipped) {
    const passed = isNegative || shouldBePrefiltered(email) === true
    return {
      id: email.id,
      category: email.category,
      difficulty: email.difficulty,
      language: email.language,
      passed,
      expected_count: expected.length,
      extracted_count: 0,
      true_positives: 0,
      false_positives: 0,
      false_negatives: expected.length,
      pre_filter_correct: preFilterCorrect,
      latency_ms: 0,
      details,
    }
  }

  // --- LLM result evaluation ---
  const extracted = llmResponse?.commitments || []

  // Greedy matching: for each expected, find best matching extracted
  const matchedExpected = new Set<number>()
  const matchedExtracted = new Set<number>()

  for (let ei = 0; ei < expected.length; ei++) {
    const exp = expected[ei]
    for (let xi = 0; xi < extracted.length; xi++) {
      if (matchedExtracted.has(xi)) continue
      const ext = extracted[xi]

      const typeMatch = ext.type === exp.type
      const tmatch = titleMatches(ext.title, exp.title_pattern)

      if (typeMatch && tmatch) {
        matchedExpected.add(ei)
        matchedExtracted.add(xi)
        break
      }
    }
  }

  const truePositives = matchedExpected.size
  const falseNegatives = expected.length - truePositives

  // For positive emails (has expected commitments): extra extractions are OK (not penalized)
  // For negative emails (no expected commitments): any extraction is a false positive
  const isPositiveEmail = expected.length > 0
  const falsePositives = isPositiveEmail ? 0 : extracted.length

  // Log false negatives
  for (let ei = 0; ei < expected.length; ei++) {
    if (!matchedExpected.has(ei)) {
      details.push(
        `Expected ${expected[ei].type} "${expected[ei].title_pattern}" -- NOT FOUND`
      )
    }
  }

  // Log false positives (only for negative emails)
  if (!isPositiveEmail) {
    for (let xi = 0; xi < extracted.length; xi++) {
      details.push(
        `Unexpected ${extracted[xi].type} "${extracted[xi].title}" (conf=${extracted[xi].confidence}) -- FALSE POSITIVE`
      )
    }
  } else {
    // Log extra extractions as INFO (not penalized)
    for (let xi = 0; xi < extracted.length; xi++) {
      if (!matchedExtracted.has(xi)) {
        details.push(
          `Extra ${extracted[xi].type} "${extracted[xi].title}" (conf=${extracted[xi].confidence}) -- OK (not penalized)`
        )
      }
    }
  }

  const passed = falsePositives === 0 && falseNegatives === 0

  return {
    id: email.id,
    category: email.category,
    difficulty: email.difficulty,
    language: email.language,
    passed,
    expected_count: expected.length,
    extracted_count: extracted.length,
    true_positives: truePositives,
    false_positives: falsePositives,
    false_negatives: falseNegatives,
    pre_filter_correct: preFilterCorrect,
    latency_ms: 0, // filled by caller
    details,
  }
}

// ---------------------------------------------------------------------------
// Semaphore for concurrency control
// ---------------------------------------------------------------------------
class Semaphore {
  private queue: Array<() => void> = []
  private running = 0

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++
      return
    }
    return new Promise<void>(resolve => {
      this.queue.push(resolve)
    })
  }

  release(): void {
    this.running--
    const next = this.queue.shift()
    if (next) {
      this.running++
      next()
    }
  }
}

// ---------------------------------------------------------------------------
// Process a single test email through the full pipeline
// ---------------------------------------------------------------------------
async function processEmail(email: TestEmail): Promise<TestResult> {
  const start = Date.now()

  // Step 1: Pre-filter check
  const emailForFilter: EmailForFilter = {
    from_address: email.from_address || 'user@self.com',
    from_name: email.from_name,
    subject: email.subject,
    snippet: email.body.slice(0, 200),
    to_address: email.to_address,
    is_outbound: true, // eval tests are from the user's perspective (outbound)
  }

  const preFilterResult = shouldSkipEmail(emailForFilter)
  const preFilterSkipped = preFilterResult.skip

  let llmResponse: LLMResponse | null = null

  if (!preFilterSkipped) {
    // Step 2: Call LLM
    llmResponse = await extractCommitments(email)

    // Step 3: Post-filter
    if (llmResponse.commitments.length > 0) {
      const postResult = postFilterCommitments(llmResponse.commitments)
      llmResponse.commitments = postResult.passed
    }
  }

  const latency = Date.now() - start

  // Step 4: Evaluate against ground truth
  const result = evaluateEmail(email, llmResponse, preFilterSkipped)
  result.latency_ms = latency
  result.raw_response = llmResponse

  return result
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs()

  // Filter test data
  let emails: TestEmail[] = TEST_EMAILS as TestEmail[]

  if (opts.category) {
    emails = emails.filter(e => e.category === opts.category)
  }
  if (opts.difficulty) {
    emails = emails.filter(e => e.difficulty === opts.difficulty)
  }
  if (opts.language) {
    emails = emails.filter(e => e.language === opts.language)
  }
  if (opts.limit && opts.limit > 0) {
    emails = emails.slice(0, opts.limit)
  }

  const totalAvailable = TEST_EMAILS.length
  const filteredCount = emails.length

  console.log('Commitment Extraction Eval v2')
  console.log('=' .repeat(50))
  console.log(`Model: ${MODEL} | Temperature: ${TEMPERATURE}`)
  console.log(`Emails: ${filteredCount} (of ${totalAvailable} total)`)
  if (opts.category) console.log(`  Filter category: ${opts.category}`)
  if (opts.difficulty) console.log(`  Filter difficulty: ${opts.difficulty}`)
  if (opts.language) console.log(`  Filter language: ${opts.language}`)
  console.log(`Concurrency: ${opts.concurrency}`)
  console.log()

  if (filteredCount === 0) {
    console.log('No test emails match the given filters.')
    process.exit(0)
  }

  const startTime = new Date()
  const semaphore = new Semaphore(opts.concurrency)
  const results: TestResult[] = []
  let completed = 0

  // Process all emails with concurrency control
  const tasks = emails.map(email => async () => {
    await semaphore.acquire()
    try {
      const result = await processEmail(email)
      results.push(result)
      completed++

      // Progress output
      const status = result.passed ? 'PASS' : 'FAIL'
      const progress = `[${String(completed).padStart(3)}/${filteredCount}]`

      if (opts.verbose || !result.passed) {
        console.log(`  ${progress} #${String(email.id).padStart(3)} ${status}  ${email.description}`)
        if (opts.verbose && result.details.length > 0) {
          for (const d of result.details) {
            console.log(`           ${d}`)
          }
        }
      } else {
        // Compact progress for passing tests
        process.stdout.write(`\r  Processing... ${progress} ${status}`)
      }

      return result
    } finally {
      semaphore.release()
    }
  })

  // Launch all tasks (semaphore controls actual concurrency)
  await Promise.all(tasks.map(t => t()))

  // Clear the progress line
  process.stdout.write('\r' + ' '.repeat(60) + '\r')

  const endTime = new Date()

  // Sort results by ID for consistent output
  results.sort((a, b) => a.id - b.id)

  // Generate report
  const meta: EvalRunMeta = {
    model: MODEL,
    temperature: TEMPERATURE,
    total_emails: totalAvailable,
    filtered_emails: filteredCount,
    start_time: startTime,
    end_time: endTime,
  }

  const markdown = generateMarkdownReport(results, meta)
  console.log()
  console.log(markdown)

  // Save results
  const jsonPath = saveResults(results, meta, markdown)
  console.log()
  console.log(`Results saved to: ${jsonPath}`)

  // Exit code: non-zero if below targets
  const tp = results.reduce((s, r) => s + r.true_positives, 0)
  const fp = results.reduce((s, r) => s + r.false_positives, 0)
  const fn = results.reduce((s, r) => s + r.false_negatives, 0)
  const p = tp + fp > 0 ? tp / (tp + fp) : 0
  const r = tp + fn > 0 ? tp / (tp + fn) : 0
  const f1Score = p + r > 0 ? (2 * p * r) / (p + r) : 0
  const pass = p >= 0.90 && r >= 0.85 && f1Score >= 0.87

  process.exit(pass ? 0 : 1)
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
main().catch(err => {
  console.error('Evaluation failed:', err)
  process.exit(1)
})
