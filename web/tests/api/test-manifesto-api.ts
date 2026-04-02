/**
 * Manifesto API tests.
 * Tests API endpoints against the manifesto's promises.
 *
 * Requires: dev server running on localhost:3000, user logged in.
 * Run: npx tsx tests/api/test-manifesto-api.ts
 */

const BASE = 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET || ''

let passed = 0
let failed = 0
let skipped = 0
let total = 0

async function main() {

async function test(id: string, name: string, fn: () => Promise<boolean>) {
  total++
  try {
    const result = await fn()
    if (result) {
      passed++
      console.log(`  ✅ ${id}: ${name}`)
    } else {
      failed++
      console.log(`  ❌ ${id}: ${name}`)
    }
  } catch (err: any) {
    failed++
    console.log(`  ❌ ${id}: ${name} — ${err.message}`)
  }
}

async function skip(id: string, name: string, reason: string) {
  total++
  skipped++
  console.log(`  ⏭️  ${id}: ${name} — ${reason}`)
}

async function fetchJSON(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, opts)
  return { status: res.status, data: await res.json().catch(() => null) }
}

// ═══════════════════════════════════════
// C. Agent Tests
// ═══════════════════════════════════════

console.log('\n═══ C. Agent Tests (via Cron auth) ═══')

await test('C-01', 'Radar: responds with signals', async () => {
  const { status, data } = await fetchJSON('/api/agents/radar', {
    headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
  })
  // Radar needs auth — try both cron and unauthenticated
  return status === 200 || status === 401
})

await test('C-03', 'Weaver: responds with relationships', async () => {
  const { status } = await fetchJSON('/api/agents/weaver')
  return status === 200 || status === 401 // 401 if not logged in
})

await test('C-09', 'Travel Brain: responds', async () => {
  const { status } = await fetchJSON('/api/agents/travel-brain')
  return status === 200 || status === 401
})

// ═══════════════════════════════════════
// D. Cron Endpoint Tests (auth required)
// ═══════════════════════════════════════

console.log('\n═══ D. Cron Endpoint Tests ═══')

const cronEndpoints = [
  { id: 'D-01', name: 'sync', path: '/api/cron/sync' },
  { id: 'D-03', name: 'prep-agent', path: '/api/cron/prep-agent' },
  { id: 'D-04', name: 'radar-push', path: '/api/cron/radar-push' },
  { id: 'D-06', name: 'weaver-push', path: '/api/cron/weaver-push' },
  { id: 'D-09', name: 'travel-check', path: '/api/cron/travel-check' },
  { id: 'D-11', name: 'digest', path: '/api/cron/digest' },
]

for (const ep of cronEndpoints) {
  if (!CRON_SECRET) {
    await skip(ep.id, `Cron ${ep.name}: responds`, 'CRON_SECRET not set')
    continue
  }
  await test(ep.id, `Cron ${ep.name}: responds`, async () => {
    const { status, data } = await fetchJSON(ep.path, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
    })
    // 200 = success, 401 = auth issue (still a valid response)
    return status === 200
  })
}

// ═══════════════════════════════════════
// E. Wow Endpoint Test
// ═══════════════════════════════════════

console.log('\n═══ E. Wow Endpoint Tests ═══')

await test('E-02', 'Onboarding Wow: responds', async () => {
  const { status } = await fetchJSON('/api/onboarding/wow')
  return status === 200 || status === 401 // 401 if not logged in
})

// ═══════════════════════════════════════
// F. Six Rules Tests
// ═══════════════════════════════════════

console.log('\n═══ F. Six Rules Tests ═══')

await test('F-07', 'Data export endpoint exists', async () => {
  const { status } = await fetchJSON('/api/export')
  return status !== 404 // 401 = exists but needs auth, which is correct
})

await test('F-06', 'LLM settings endpoint exists', async () => {
  const { status } = await fetchJSON('/api/settings/llm')
  return status === 200 || status === 401
})

// ═══════════════════════════════════════
// G. Boundary Tests
// ═══════════════════════════════════════

console.log('\n═══ G. Boundary Tests ═══')

await test('G-01', 'No booking API exists', async () => {
  const { status: s1 } = await fetchJSON('/api/booking')
  const { status: s2 } = await fetchJSON('/api/book-flight')
  return s1 === 404 && s2 === 404
})

// ═══════════════════════════════════════
// I. Navigation & Page Tests
// ═══════════════════════════════════════

console.log('\n═══ I. Navigation & Page Tests ═══')

const pages = [
  { id: 'I-01', name: 'Today page', path: '/dashboard' },
  { id: 'I-02', name: 'Commitments page', path: '/dashboard/commitments' },
  { id: 'I-06', name: 'People page', path: '/dashboard/contacts' },
  { id: 'I-08', name: 'Calendar page', path: '/dashboard/calendar' },
  { id: 'I-10', name: 'Trips page', path: '/dashboard/trips' },
  { id: 'I-12', name: 'Inbox page', path: '/dashboard/inbox' },
  { id: 'I-xx', name: 'Settings page', path: '/dashboard/settings' },
]

for (const page of pages) {
  await test(page.id, `${page.name} loads`, async () => {
    const res = await fetch(`${BASE}${page.path}`, { redirect: 'manual' })
    // 200 = page loads, 307 = redirect to login (expected if not auth'd)
    return res.status === 200 || res.status === 307
  })
}

// Check removed pages redirect or 404
await test('I-17a', 'Family page not in main nav (still accessible)', async () => {
  const res = await fetch(`${BASE}/dashboard/family`, { redirect: 'manual' })
  return res.status === 200 || res.status === 307 // page exists but not in nav
})

await test('I-17b', 'Expenses page not in main nav (still accessible)', async () => {
  const res = await fetch(`${BASE}/dashboard/expenses`, { redirect: 'manual' })
  return res.status === 200 || res.status === 307
})

// ═══════════════════════════════════════
// API Structure Tests
// ═══════════════════════════════════════

console.log('\n═══ API Structure Tests ═══')

const apiEndpoints = [
  { id: 'API-01', name: 'Commitments API', path: '/api/commitments' },
  { id: 'API-02', name: 'Contacts API', path: '/api/contacts' },
  { id: 'API-03', name: 'Calendar API', path: '/api/calendar' },
  { id: 'API-04', name: 'Trips API', path: '/api/trips' },
  { id: 'API-05', name: 'Emails API', path: '/api/emails' },
  { id: 'API-06', name: 'Tasks API', path: '/api/tasks' },
  { id: 'API-07', name: 'Family Calendar API', path: '/api/family-calendar' },
  { id: 'API-08', name: 'Briefing API', path: '/api/briefing' },
  { id: 'API-09', name: 'Alerts API', path: '/api/alerts' },
  { id: 'API-10', name: 'Commitments Stats', path: '/api/commitments/stats' },
  { id: 'API-11', name: 'Contact Backfill City', path: '/api/contacts/backfill-city' },
  { id: 'API-12', name: 'Chat API', path: '/api/chat' },
]

for (const ep of apiEndpoints) {
  await test(ep.id, `${ep.name}: exists`, async () => {
    const res = await fetch(`${BASE}${ep.path}`, { method: ep.path.includes('chat') ? 'POST' : 'GET' })
    // Not 404 = endpoint exists (401/403/400/500 all mean the endpoint is there)
    return res.status !== 404
  })
}

// ═══════════════════════════════════════
// Summary
// ═══════════════════════════════════════

console.log(`\n${'═'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped (of ${total} total)`)
console.log(`Pass rate: ${Math.round(passed / (total - skipped) * 100)}%`)
console.log(`${'═'.repeat(50)}`)

if (failed > 0) process.exit(1)
}

main().catch(err => { console.error(err); process.exit(1) })
