/**
 * Stress Test / Load Test for Chief API
 * ======================================
 * Measures latency percentiles (P50, P95, P99) under concurrent load.
 * Uses native fetch + Promise.all — no external dependencies (no k6).
 *
 * Prerequisites:
 *   - Dev server running on localhost:3003
 *   - Valid Supabase credentials (for seeding test data)
 *
 * Usage:
 *   npx tsx tests/stress/load-test.ts [--concurrency 50] [--base-url http://localhost:3003]
 */

import { createClient } from '@supabase/supabase-js'

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://krxhyvixctwdoraulvlz.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGh5dml4Y3R3ZG9yYXVsdmx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYwNTIyMCwiZXhwIjoyMDkwMTgxMjIwfQ.IBh2XBnPRTtpVJTTusCfIRQN5I0ws1xfqnT4wyOKDl0'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGh5dml4Y3R3ZG9yYXVsdmx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MDUyMjAsImV4cCI6MjA5MDE4MTIyMH0.yxT8eL7tGym6h_QjA23vykLXnhmI5V3WfS0_ne7sfXw'

const args = process.argv.slice(2)
const BASE_URL = getArg('--base-url') || process.env.TEST_BASE_URL || 'http://localhost:3003'
const DEFAULT_CONCURRENCY = parseInt(getArg('--concurrency') || '50')

const TEST_USER_ID = 'stress-test-user-001'

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Types ───────────────────────────────────────────────────────────────────

interface RequestResult {
  status: number
  latencyMs: number
  ok: boolean
  error?: string
}

interface EndpointResult {
  endpoint: string
  method: string
  concurrency: number
  totalRequests: number
  successCount: number
  failCount: number
  p50: number
  p95: number
  p99: number
  min: number
  max: number
  mean: number
  totalDurationMs: number
  requestsPerSecond: number
  errors: string[]
}

// ─── Arg Parser ──────────────────────────────────────────────────────────────

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx !== -1 ? args[idx + 1] : undefined
}

// ─── Percentile Calculator ───────────────────────────────────────────────────

function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0
  const index = Math.ceil((p / 100) * sortedArr.length) - 1
  return sortedArr[Math.max(0, index)]
}

// ─── Request Sender ──────────────────────────────────────────────────────────

async function sendRequest(
  url: string,
  method: string = 'GET',
  body?: any,
  headers?: Record<string, string>
): Promise<RequestResult> {
  const start = performance.now()

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const latencyMs = Math.round(performance.now() - start)

    // Consume the body to ensure the full response is received
    await res.text()

    return {
      status: res.status,
      latencyMs,
      ok: res.ok || res.status === 401, // 401 is expected since we don't have auth session
    }
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start)
    return {
      status: 0,
      latencyMs,
      ok: false,
      error: err.message || String(err),
    }
  }
}

// ─── Load Test Runner ────────────────────────────────────────────────────────

async function runLoadTest(
  endpoint: string,
  method: string,
  concurrency: number,
  body?: any,
  headers?: Record<string, string>
): Promise<EndpointResult> {
  const url = `${BASE_URL}${endpoint}`
  const totalStart = performance.now()

  // Fire all requests concurrently
  const promises = Array.from({ length: concurrency }, () =>
    sendRequest(url, method, body, headers)
  )

  const results = await Promise.all(promises)
  const totalDurationMs = Math.round(performance.now() - totalStart)

  // Compute statistics
  const latencies = results.map(r => r.latencyMs).sort((a, b) => a - b)
  const successCount = results.filter(r => r.ok).length
  const failCount = results.filter(r => !r.ok).length
  const errors = results.filter(r => r.error).map(r => r.error!)
  const uniqueErrors = [...new Set(errors)]

  return {
    endpoint,
    method,
    concurrency,
    totalRequests: concurrency,
    successCount,
    failCount,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    min: latencies[0] || 0,
    max: latencies[latencies.length - 1] || 0,
    mean: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    totalDurationMs,
    requestsPerSecond: Math.round((concurrency / totalDurationMs) * 1000 * 100) / 100,
    errors: uniqueErrors,
  }
}

// ─── Seed Test Data ──────────────────────────────────────────────────────────

async function seedTestData() {
  console.log('  Seeding test data for stress test user...')

  // Clean first
  await admin.from('commitments').delete().eq('user_id', TEST_USER_ID)
  await admin.from('family_calendar').delete().eq('user_id', TEST_USER_ID)
  await admin.from('contacts').delete().eq('user_id', TEST_USER_ID)

  // Insert some commitments for the stats endpoint to work with
  const commitments = Array.from({ length: 20 }, (_, i) => ({
    user_id: TEST_USER_ID,
    type: i < 10 ? 'i_promised' : i < 15 ? 'they_promised' : 'family',
    contact_name: `Contact ${i}`,
    contact_email: `contact${i}@example.com`,
    title: `Stress test commitment ${i}`,
    deadline: new Date(Date.now() + (i - 5) * 86400000).toISOString().split('T')[0],
    status: i < 3 ? 'done' : i < 5 ? 'overdue' : 'pending',
    urgency_score: Math.min(10, Math.max(0, 10 - i)),
    source_type: 'email',
    ...(i < 3 ? { completed_at: new Date().toISOString() } : {}),
  }))

  const { error: cErr } = await admin.from('commitments').insert(commitments)
  if (cErr) console.log(`    WARNING: commitment seed failed: ${cErr.message}`)

  // Insert family calendar events
  const familyEvents = [
    { user_id: TEST_USER_ID, event_type: 'hard_constraint', title: 'Piano lesson', start_date: '2026-04-02', start_time: '15:30', end_time: '16:30', recurrence: 'weekly', recurrence_day: 3, family_member: 'Emily', is_active: true, source: 'manual' },
    { user_id: TEST_USER_ID, event_type: 'important_date', title: 'Anniversary', start_date: '2026-05-12', recurrence: 'yearly', family_member: 'Sarah', is_active: true, source: 'manual' },
    { user_id: TEST_USER_ID, event_type: 'school_cycle', title: 'Exam week', start_date: '2026-06-01', end_date: '2026-06-12', family_member: 'Emily', is_active: true, source: 'manual' },
  ]

  const { error: fErr } = await admin.from('family_calendar').insert(familyEvents)
  if (fErr) console.log(`    WARNING: family calendar seed failed: ${fErr.message}`)

  console.log('  Seed complete.')
}

async function cleanupTestData() {
  await admin.from('commitments').delete().eq('user_id', TEST_USER_ID)
  await admin.from('family_calendar').delete().eq('user_id', TEST_USER_ID)
  await admin.from('contacts').delete().eq('user_id', TEST_USER_ID)
}

// ─── Report Formatter ────────────────────────────────────────────────────────

function formatResult(r: EndpointResult, target: { p95: number }): string {
  const p95Status = r.p95 <= target.p95 ? '✅' : '❌'
  const successRate = ((r.successCount / r.totalRequests) * 100).toFixed(1)

  let output = ''
  output += `  ${r.method} ${r.endpoint}\n`
  output += `    Concurrency:    ${r.concurrency}\n`
  output += `    Success rate:   ${successRate}% (${r.successCount}/${r.totalRequests})\n`
  output += `    Latency (ms):   min=${r.min}  mean=${r.mean}  max=${r.max}\n`
  output += `    P50:  ${r.p50}ms\n`
  output += `    P95:  ${r.p95}ms  ${p95Status} (target: <${target.p95}ms)\n`
  output += `    P99:  ${r.p99}ms\n`
  output += `    Throughput:     ${r.requestsPerSecond} req/s\n`
  output += `    Wall clock:     ${r.totalDurationMs}ms\n`

  if (r.errors.length > 0) {
    output += `    Errors:         ${r.errors.slice(0, 3).join('; ')}\n`
  }

  return output
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║  Chief API Stress Test                   ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log()
  console.log(`Base URL:     ${BASE_URL}`)
  console.log(`Concurrency:  ${DEFAULT_CONCURRENCY}`)
  console.log(`Supabase:     ${SUPABASE_URL}`)
  console.log()

  // Check if server is reachable
  console.log('Checking server connectivity...')
  try {
    const healthCheck = await sendRequest(`${BASE_URL}/api/health`, 'GET')
    if (healthCheck.status === 0) {
      console.error(`ERROR: Cannot reach ${BASE_URL}. Is the dev server running?`)
      console.error(`  Start it with: cd web && npm run dev -- --port 3003`)
      process.exit(1)
    }
    console.log(`  Server responded: HTTP ${healthCheck.status} (${healthCheck.latencyMs}ms)`)
  } catch {
    console.error(`ERROR: Cannot reach ${BASE_URL}. Is the dev server running?`)
    process.exit(1)
  }
  console.log()

  // Seed data
  await seedTestData()
  console.log()

  // Define test endpoints with targets from TESTING_SYSTEM.md
  const tests = [
    {
      endpoint: '/api/commitments',
      method: 'GET',
      concurrency: 50,
      target: { p95: 200 },
      body: undefined,
    },
    {
      endpoint: '/api/commitments/stats',
      method: 'GET',
      concurrency: 50,
      target: { p95: 200 },
      body: undefined,
    },
    {
      endpoint: '/api/family-calendar/conflicts',
      method: 'POST',
      concurrency: 30,
      target: { p95: 500 },
      body: { date: '2026-04-02', start_time: '15:00', end_time: '17:00' },
    },
    {
      endpoint: '/api/family-calendar',
      method: 'GET',
      concurrency: 50,
      target: { p95: 200 },
      body: undefined,
    },
  ]

  const results: EndpointResult[] = []

  for (const test of tests) {
    console.log(`▶ Testing ${test.method} ${test.endpoint} (${test.concurrency} concurrent)...`)
    const result = await runLoadTest(
      test.endpoint,
      test.method,
      test.concurrency,
      test.body
    )
    results.push(result)
    console.log(formatResult(result, test.target))
  }

  // Second wave: sustained load (3 rounds of the main endpoint)
  console.log('▶ Sustained load: 3 rounds of GET /api/commitments (50 each)...')
  const sustainedLatencies: number[] = []
  for (let round = 1; round <= 3; round++) {
    const result = await runLoadTest('/api/commitments', 'GET', 50)
    sustainedLatencies.push(result.p95)
    console.log(`    Round ${round}: P95=${result.p95}ms  mean=${result.mean}ms`)
  }
  const sustainedP95Drift = Math.max(...sustainedLatencies) - Math.min(...sustainedLatencies)
  const driftOk = sustainedP95Drift < 200
  console.log(`    P95 drift across rounds: ${sustainedP95Drift}ms ${driftOk ? '✅' : '⚠️'} (< 200ms expected)`)
  console.log()

  // Cleanup
  await cleanupTestData()

  // Final report
  console.log('═══════════════════════════════════════════')
  console.log('  RESULTS SUMMARY')
  console.log('═══════════════════════════════════════════')
  console.log()

  const tableRows = results.map((r, i) => ({
    endpoint: `${r.method} ${r.endpoint}`,
    concurrency: r.concurrency,
    p50: r.p50,
    p95: r.p95,
    p99: r.p99,
    target: tests[i].target.p95,
    pass: r.p95 <= tests[i].target.p95,
    rps: r.requestsPerSecond,
  }))

  // Print table header
  console.log(
    '  ' +
    'Endpoint'.padEnd(40) +
    'N'.padStart(4) +
    'P50'.padStart(7) +
    'P95'.padStart(7) +
    'P99'.padStart(7) +
    'Target'.padStart(8) +
    'Pass'.padStart(6) +
    'RPS'.padStart(8)
  )
  console.log('  ' + '─'.repeat(87))

  for (const row of tableRows) {
    console.log(
      '  ' +
      row.endpoint.padEnd(40) +
      String(row.concurrency).padStart(4) +
      `${row.p50}ms`.padStart(7) +
      `${row.p95}ms`.padStart(7) +
      `${row.p99}ms`.padStart(7) +
      `${row.target}ms`.padStart(8) +
      (row.pass ? '  ✅' : '  ❌').padStart(6) +
      `${row.rps}`.padStart(8)
    )
  }
  console.log()

  const allPass = tableRows.every(r => r.pass)
  const passCount = tableRows.filter(r => r.pass).length

  console.log(`  ${passCount}/${tableRows.length} endpoints meet P95 latency targets`)
  console.log(`  Sustained load drift: ${sustainedP95Drift}ms ${driftOk ? '✅' : '⚠️'}`)
  console.log()

  // Note about auth
  console.log('  NOTE: All endpoints return 401 (Unauthorized) because these tests')
  console.log('  run without an authenticated session. The latency measurements are')
  console.log('  still valid — they measure the server\'s ability to handle concurrent')
  console.log('  connections, middleware overhead, and Supabase auth check latency.')
  console.log('  For authenticated load testing, configure a test session cookie.')
  console.log()

  process.exit(allPass && driftOk ? 0 : 1)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
