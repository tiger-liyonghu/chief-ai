/**
 * Two-Pass Pipeline Eval — Tier 1 (Chat) + Tier 2 (Reasoner)
 *
 * Tests the full pipeline: Chat extracts → Reasoner verifies direction.
 * Compares against baseline (Chat-only) to measure Tier 2 impact.
 *
 * Usage:
 *   npx tsx tests/ai-eval/run-eval-two-pass.ts --limit 20
 *   npx tsx tests/ai-eval/run-eval-two-pass.ts --limit 20 --verbose
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import OpenAI from 'openai'

// Load env
const envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
for (const line of envContent.split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('='); if (eq === -1) continue
  process.env[t.slice(0, eq)] = t.slice(eq + 1)
}

import { COMMITMENT_EXTRACTION_SYSTEM } from '../../lib/ai/prompts/commitment-extraction'
import { shouldSkipEmail, postFilterCommitments } from '../../lib/ai/commitment-filters'
import { verifyCommitmentDirections } from '../../lib/ai/commitment-verifier'
import { TEST_EMAILS } from './commitment-test-data'
import type { TestEmail } from './eval-reporter'

// CLI args
const args = process.argv.slice(2)
const limit = parseInt(args.find((_, i, a) => a[i - 1] === '--limit') || '20', 10)
const verbose = args.includes('--verbose')

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseURL: 'https://api.deepseek.com',
})

function titleMatches(extractedTitle: string, pattern: string): boolean {
  const isRegex = pattern.startsWith('/') || /[.*+?|\\[\](){}^$]/.test(pattern)
  if (isRegex) {
    let regexBody = pattern
    if (pattern.startsWith('/')) {
      const lastSlash = pattern.lastIndexOf('/')
      regexBody = pattern.slice(1, lastSlash > 0 ? lastSlash : undefined)
    }
    try { return new RegExp(regexBody, 'i').test(extractedTitle) }
    catch { return extractedTitle.toLowerCase().includes(regexBody.toLowerCase()) }
  }
  return extractedTitle.toLowerCase().includes(pattern.toLowerCase())
}

async function extractTier1(email: any): Promise<any[]> {
  const isOutbound = email.from_address.includes('tiger') || email.from_address.includes('actuaryhelp') || email.from_address.includes('nkliyonghu')
  const direction = isOutbound ? 'OUTBOUND (user sent this)' : 'INBOUND (user received this)'

  const userMsg = `From: ${email.from_name} <${email.from_address}>
To: ${email.to_address}
Subject: ${email.subject}
Date: ${email.date}
Direction: ${direction}

${email.body.slice(0, 3000)}`

  const res = await client.chat.completions.create({
    model: 'deepseek-chat',
    temperature: 0.2,
    messages: [
      { role: 'system', content: COMMITMENT_EXTRACTION_SYSTEM },
      { role: 'user', content: userMsg },
    ],
    response_format: { type: 'json_object' },
  })

  const parsed = JSON.parse(res.choices[0]?.message?.content || '{}')
  return (parsed.commitments || []).map((c: any) => ({
    type: c.type,
    title: c.title,
    confidence: c.confidence || 0.5,
    due_date: c.due_date,
  }))
}

function evaluate(email: any, extracted: any[]) {
  const expected = email.expected_commitments
  const matchedExpected = new Set<number>()
  const matchedExtracted = new Set<number>()

  for (let ei = 0; ei < expected.length; ei++) {
    for (let xi = 0; xi < extracted.length; xi++) {
      if (matchedExtracted.has(xi)) continue
      if (extracted[xi].type === expected[ei].type && titleMatches(extracted[xi].title, expected[ei].title_pattern)) {
        matchedExpected.add(ei)
        matchedExtracted.add(xi)
        break
      }
    }
  }

  return {
    tp: matchedExpected.size,
    fn: expected.length - matchedExpected.size,
    fp: expected.length === 0 ? extracted.length : 0,
    details: expected
      .map((e: any, i: number) => matchedExpected.has(i) ? null : `MISS: ${e.type} "${e.title_pattern}"`)
      .filter(Boolean),
  }
}

async function main() {
  const emails = (TEST_EMAILS as any[]).slice(0, limit)
  console.log('Two-Pass Pipeline Eval (Chat + Reasoner)')
  console.log('='.repeat(50))
  console.log(`Emails: ${emails.length} | Tier 1: deepseek-chat | Tier 2: deepseek-reasoner`)
  console.log()

  let t1_tp = 0, t1_fn = 0, t1_fp = 0
  let t2_tp = 0, t2_fn = 0, t2_fp = 0
  let t2_corrections = 0
  let completed = 0

  for (const email of emails) {
    // Pre-filter
    const pf = shouldSkipEmail({
      from_address: email.from_address || '',
      from_name: email.from_name,
      subject: email.subject,
      snippet: email.body.slice(0, 200),
      to_address: email.to_address,
    })

    if (pf.skip) {
      const isNeg = email.expected_commitments.length === 0
      completed++
      if (verbose) console.log(`  [${completed}/${emails.length}] #${email.id} SKIP (pre-filter) ${isNeg ? 'CORRECT' : 'WRONG'}`)
      if (!isNeg) { t1_fn += email.expected_commitments.length; t2_fn += email.expected_commitments.length }
      continue
    }

    // Tier 1: Chat extraction
    let tier1: any[] = []
    try {
      tier1 = await extractTier1(email)
      if (tier1.length > 0) {
        const { passed } = postFilterCommitments(tier1)
        tier1 = passed
      }
    } catch (err: any) {
      console.log(`  [ERROR #${email.id}]: ${err.message}`)
      completed++
      continue
    }

    // Evaluate Tier 1
    const eval1 = evaluate(email, tier1)
    t1_tp += eval1.tp; t1_fn += eval1.fn; t1_fp += eval1.fp

    // Tier 2: Reasoner direction verification
    const isOutbound = email.from_address.includes('tiger') || email.from_address.includes('actuaryhelp') || email.from_address.includes('nkliyonghu')
    let tier2 = tier1
    try {
      tier2 = await verifyCommitmentDirections(client, tier1, {
        from: `${email.from_name} <${email.from_address}>`,
        to: email.to_address,
        subject: email.subject,
        body: email.body,
        direction: isOutbound ? 'outbound' : 'inbound',
      })
    } catch (err: any) {
      console.log(`  [TIER2 ERROR #${email.id}]: ${err.message}`)
    }

    // Count corrections
    for (let i = 0; i < tier1.length; i++) {
      if (tier1[i].type !== tier2[i]?.type) t2_corrections++
    }

    // Evaluate Tier 2
    const eval2 = evaluate(email, tier2)
    t2_tp += eval2.tp; t2_fn += eval2.fn; t2_fp += eval2.fp

    completed++
    const t1_pass = eval1.fn === 0 && eval1.fp === 0
    const t2_pass = eval2.fn === 0 && eval2.fp === 0
    const improved = eval2.tp > eval1.tp

    if (verbose || improved || (!t1_pass && !t2_pass)) {
      const marker = improved ? ' ⬆' : (t2_pass && !t1_pass) ? ' ✓' : ''
      console.log(`  [${String(completed).padStart(3)}/${emails.length}] #${String(email.id).padStart(3)} T1=${eval1.tp}/${eval1.tp + eval1.fn} T2=${eval2.tp}/${eval2.tp + eval2.fn}${marker}  ${email.description || email.subject}`)
      if (eval2.details.length > 0) {
        for (const d of eval2.details) console.log(`           ${d}`)
      }
    } else {
      process.stderr.write(`\r  Processing... [${completed}/${emails.length}]`)
    }
  }

  process.stderr.write('\r' + ' '.repeat(60) + '\r')

  const t1_p = t1_tp + t1_fp > 0 ? t1_tp / (t1_tp + t1_fp) : 1
  const t1_r = t1_tp + t1_fn > 0 ? t1_tp / (t1_tp + t1_fn) : 1
  const t1_f1 = t1_p + t1_r > 0 ? 2 * t1_p * t1_r / (t1_p + t1_r) : 0
  const t2_p = t2_tp + t2_fp > 0 ? t2_tp / (t2_tp + t2_fp) : 1
  const t2_r = t2_tp + t2_fn > 0 ? t2_tp / (t2_tp + t2_fn) : 1
  const t2_f1 = t2_p + t2_r > 0 ? 2 * t2_p * t2_r / (t2_p + t2_r) : 0

  console.log()
  console.log('═══ RESULTS ═══')
  console.log()
  console.log('              Precision   Recall    F1')
  console.log(`  Tier 1:     ${(t1_p*100).toFixed(1)}%      ${(t1_r*100).toFixed(1)}%    ${(t1_f1*100).toFixed(1)}%   (TP=${t1_tp} FP=${t1_fp} FN=${t1_fn})`)
  console.log(`  Tier 1+2:   ${(t2_p*100).toFixed(1)}%      ${(t2_r*100).toFixed(1)}%    ${(t2_f1*100).toFixed(1)}%   (TP=${t2_tp} FP=${t2_fp} FN=${t2_fn})`)
  console.log()
  console.log(`  Direction corrections by Tier 2: ${t2_corrections}`)
  console.log(`  Recall delta: ${((t2_r - t1_r) * 100).toFixed(1)}pp`)
}

main().catch(err => { console.error('Eval failed:', err); process.exit(1) })
