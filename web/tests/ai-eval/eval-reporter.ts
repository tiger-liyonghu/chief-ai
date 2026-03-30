/**
 * Eval Reporter — generates markdown + JSON reports from eval results.
 *
 * Produces:
 *   1. A markdown report printed to stdout
 *   2. A JSON file saved to tests/ai-eval/results/eval-{timestamp}.json
 */

import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestResult {
  id: number
  category: string
  difficulty: string
  language: string
  passed: boolean
  expected_count: number
  extracted_count: number
  true_positives: number
  false_positives: number
  false_negatives: number
  pre_filter_correct: boolean
  latency_ms: number
  raw_response?: any
  details: string[]
}

export interface EvalRunMeta {
  model: string
  temperature: number
  total_emails: number
  filtered_emails: number
  start_time: Date
  end_time: Date
}

// ---------------------------------------------------------------------------
// Metric helpers
// ---------------------------------------------------------------------------

function precision(tp: number, fp: number): number {
  return tp + fp > 0 ? tp / (tp + fp) : 0
}

function recall(tp: number, fn: number): number {
  return tp + fn > 0 ? tp / (tp + fn) : 0
}

function f1(p: number, r: number): number {
  return p + r > 0 ? (2 * p * r) / (p + r) : 0
}

function pct(v: number): string {
  return (v * 100).toFixed(1) + '%'
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {}
  for (const item of arr) {
    const k = key(item)
    if (!groups[k]) groups[k] = []
    groups[k].push(item)
  }
  return groups
}

function computeGroupMetrics(results: TestResult[]) {
  let tp = 0, fp = 0, fn = 0
  for (const r of results) {
    tp += r.true_positives
    fp += r.false_positives
    fn += r.false_negatives
  }
  const p = precision(tp, fp)
  const r = recall(tp, fn)
  return { count: results.length, tp, fp, fn, precision: p, recall: r, f1: f1(p, r) }
}

// ---------------------------------------------------------------------------
// Latency stats
// ---------------------------------------------------------------------------

function latencyStats(results: TestResult[]) {
  const times = results.map(r => r.latency_ms).filter(t => t > 0).sort((a, b) => a - b)
  if (times.length === 0) return { mean: 0, p50: 0, p95: 0 }
  const mean = times.reduce((a, b) => a + b, 0) / times.length
  const p50 = times[Math.floor(times.length * 0.5)]
  const p95 = times[Math.floor(times.length * 0.95)]
  return { mean, p50, p95 }
}

// ---------------------------------------------------------------------------
// Markdown report
// ---------------------------------------------------------------------------

export function generateMarkdownReport(
  results: TestResult[],
  meta: EvalRunMeta,
): string {
  const durationSec = ((meta.end_time.getTime() - meta.start_time.getTime()) / 1000).toFixed(0)
  const runTime = meta.start_time.toISOString().replace('T', ' ').slice(0, 19)

  const overall = computeGroupMetrics(results)

  // Pre-filter accuracy: for negative emails (expected_count === 0),
  // check if pre_filter_correct is true
  const negativeResults = results.filter(r => r.expected_count === 0)
  const preFilterCorrect = negativeResults.filter(r => r.pre_filter_correct).length
  const preFilterAccuracy = negativeResults.length > 0
    ? preFilterCorrect / negativeResults.length
    : 1

  const lines: string[] = []
  const ln = (s: string = '') => lines.push(s)

  ln(`# Commitment Extraction Eval Report`)
  ln(`Run: ${runTime} | Emails: ${meta.filtered_emails}/${meta.total_emails} | Duration: ${durationSec}s`)
  ln()

  // --- Summary ---
  ln(`## Summary`)
  ln(`| Metric | Value | Target |`)
  ln(`|--------|-------|--------|`)
  ln(`| Precision | ${pct(overall.precision)} | >90% |`)
  ln(`| Recall | ${pct(overall.recall)} | >85% |`)
  ln(`| F1 | ${pct(overall.f1)} | >87% |`)
  ln(`| Pre-filter accuracy | ${pct(preFilterAccuracy)} | >95% |`)
  ln(`| True Positives | ${overall.tp} | |`)
  ln(`| False Positives | ${overall.fp} | |`)
  ln(`| False Negatives | ${overall.fn} | |`)
  ln()

  // --- By Category ---
  const byCategory = groupBy(results, r => r.category)
  ln(`## By Category`)
  ln(`| Category | Count | Precision | Recall | F1 |`)
  ln(`|----------|-------|-----------|--------|-----|`)
  for (const [cat, group] of Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b))) {
    const m = computeGroupMetrics(group)
    ln(`| ${cat} | ${m.count} | ${pct(m.precision)} | ${pct(m.recall)} | ${pct(m.f1)} |`)
  }
  ln()

  // --- By Difficulty ---
  const byDifficulty = groupBy(results, r => r.difficulty)
  ln(`## By Difficulty`)
  ln(`| Difficulty | Count | Precision | Recall | F1 |`)
  ln(`|------------|-------|-----------|--------|-----|`)
  for (const level of ['easy', 'medium', 'hard']) {
    const group = byDifficulty[level]
    if (!group) continue
    const m = computeGroupMetrics(group)
    ln(`| ${level} | ${m.count} | ${pct(m.precision)} | ${pct(m.recall)} | ${pct(m.f1)} |`)
  }
  ln()

  // --- By Language ---
  const byLanguage = groupBy(results, r => r.language)
  ln(`## By Language`)
  ln(`| Language | Count | Precision | Recall | F1 |`)
  ln(`|----------|-------|-----------|--------|-----|`)
  for (const [lang, group] of Object.entries(byLanguage).sort(([a], [b]) => a.localeCompare(b))) {
    const m = computeGroupMetrics(group)
    ln(`| ${lang} | ${m.count} | ${pct(m.precision)} | ${pct(m.recall)} | ${pct(m.f1)} |`)
  }
  ln()

  // --- Failures (top 20) ---
  const failures = results.filter(r => !r.passed).slice(0, 20)
  ln(`## Failures (${failures.length > 20 ? 'top 20' : failures.length} of ${results.filter(r => !r.passed).length})`)
  if (failures.length === 0) {
    ln(`No failures - perfect score!`)
  } else {
    for (const f of failures) {
      ln(`### Test #${f.id}: ${f.category} / ${f.difficulty}`)
      for (const d of f.details) {
        ln(`- ${d}`)
      }
      if (f.raw_response) {
        ln(`- Raw LLM response: \`${JSON.stringify(f.raw_response).slice(0, 300)}\``)
      }
      ln()
    }
  }
  ln()

  // --- Latency ---
  const lat = latencyStats(results)
  ln(`## Avg Latency`)
  ln(`- Mean: ${(lat.mean / 1000).toFixed(1)}s | P50: ${(lat.p50 / 1000).toFixed(1)}s | P95: ${(lat.p95 / 1000).toFixed(1)}s`)
  ln()

  // --- Verdict ---
  const pass = overall.precision >= 0.90 && overall.recall >= 0.85 && overall.f1 >= 0.87
  ln(`## Verdict`)
  ln(pass
    ? `**PASS** - meets all accuracy targets`
    : `**FAIL** - below accuracy targets (P=${pct(overall.precision)} R=${pct(overall.recall)} F1=${pct(overall.f1)})`)

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// JSON report + save
// ---------------------------------------------------------------------------

export function saveResults(
  results: TestResult[],
  meta: EvalRunMeta,
  markdown: string,
): string {
  const resultsDir = resolve(__dirname, 'results')
  mkdirSync(resultsDir, { recursive: true })

  const now = meta.end_time
  const dateStr = now.toISOString().slice(0, 10)
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '')
  const outPath = resolve(resultsDir, `eval-${dateStr}-${timeStr}.json`)

  const overall = computeGroupMetrics(results)

  const report = {
    timestamp: now.toISOString(),
    model: meta.model,
    temperature: meta.temperature,
    email_count: meta.filtered_emails,
    total_available: meta.total_emails,
    duration_sec: +((meta.end_time.getTime() - meta.start_time.getTime()) / 1000).toFixed(1),
    metrics: {
      precision: +overall.precision.toFixed(4),
      recall: +overall.recall.toFixed(4),
      f1: +overall.f1.toFixed(4),
      true_positives: overall.tp,
      false_positives: overall.fp,
      false_negatives: overall.fn,
    },
    by_category: Object.fromEntries(
      Object.entries(groupBy(results, r => r.category)).map(([k, v]) => {
        const m = computeGroupMetrics(v)
        return [k, { count: m.count, precision: +m.precision.toFixed(4), recall: +m.recall.toFixed(4), f1: +m.f1.toFixed(4) }]
      })
    ),
    by_difficulty: Object.fromEntries(
      Object.entries(groupBy(results, r => r.difficulty)).map(([k, v]) => {
        const m = computeGroupMetrics(v)
        return [k, { count: m.count, precision: +m.precision.toFixed(4), recall: +m.recall.toFixed(4), f1: +m.f1.toFixed(4) }]
      })
    ),
    by_language: Object.fromEntries(
      Object.entries(groupBy(results, r => r.language)).map(([k, v]) => {
        const m = computeGroupMetrics(v)
        return [k, { count: m.count, precision: +m.precision.toFixed(4), recall: +m.recall.toFixed(4), f1: +m.f1.toFixed(4) }]
      })
    ),
    per_email: results.map(r => ({
      id: r.id,
      category: r.category,
      difficulty: r.difficulty,
      language: r.language,
      passed: r.passed,
      expected: r.expected_count,
      extracted: r.extracted_count,
      tp: r.true_positives,
      fp: r.false_positives,
      fn: r.false_negatives,
      pre_filter_correct: r.pre_filter_correct,
      latency_ms: r.latency_ms,
      details: r.details,
      raw_response: r.raw_response,
    })),
  }

  writeFileSync(outPath, JSON.stringify(report, null, 2))

  // Also save the markdown report
  const mdPath = outPath.replace('.json', '.md')
  writeFileSync(mdPath, markdown)

  return outPath
}
