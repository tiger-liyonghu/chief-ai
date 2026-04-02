/**
 * Production issue simulation tests.
 * Tests the top 7 potential production problems identified in risk analysis.
 *
 * Run: CRON_SECRET=xxx npx tsx tests/stress/simulate-production.ts
 */

const BASE = 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET || ''

let passed = 0
let failed = 0
let warnings = 0
let total = 0

function result(id: string, status: 'pass' | 'fail' | 'warn', msg: string) {
  total++
  if (status === 'pass') { passed++; console.log(`  ✅ ${id}: ${msg}`) }
  else if (status === 'fail') { failed++; console.log(`  ❌ ${id}: ${msg}`) }
  else { warnings++; console.log(`  ⚠️  ${id}: ${msg}`) }
}

async function fetchTimed(path: string, opts?: RequestInit): Promise<{ status: number; data: any; ms: number }> {
  const start = Date.now()
  const res = await fetch(`${BASE}${path}`, opts)
  const ms = Date.now() - start
  const data = await res.json().catch(() => null)
  return { status: res.status, data, ms }
}

async function main() {

// ═══════════════════════════════════════
// 1. Sync 超时风险
// ═══════════════════════════════════════

console.log('\n═══ 1. Sync Performance (超时风险) ═══')

const syncResult = await fetchTimed('/api/cron/sync', {
  headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
})

if (syncResult.status === 200) {
  const userCount = syncResult.data?.results?.length || 0
  result('SYNC-01', syncResult.ms < 30000 ? 'pass' : syncResult.ms < 55000 ? 'warn' : 'fail',
    `Sync ${userCount} users in ${syncResult.ms}ms (Vercel limit: 60000ms)`)

  // Estimate at 50 users
  const perUserMs = userCount > 0 ? syncResult.ms / userCount : 5000
  const estimated50 = perUserMs * 50
  result('SYNC-02', estimated50 < 55000 ? 'pass' : 'warn',
    `Estimated 50 users: ${Math.round(estimated50)}ms (per user: ${Math.round(perUserMs)}ms) ${estimated50 > 55000 ? '→ WILL TIMEOUT' : ''}`)
} else {
  result('SYNC-01', 'fail', `Sync failed: HTTP ${syncResult.status}`)
}

// ═══════════════════════════════════════
// 2. Cron 端点响应时间
// ═══════════════════════════════════════

console.log('\n═══ 2. Cron Response Times ═══')

const cronEndpoints = [
  { name: 'prep-agent', path: '/api/cron/prep-agent', maxMs: 30000 },
  { name: 'radar-push', path: '/api/cron/radar-push', maxMs: 30000 },
  { name: 'weaver-push', path: '/api/cron/weaver-push', maxMs: 30000 },
  { name: 'travel-check', path: '/api/cron/travel-check', maxMs: 30000 },
  { name: 'digest', path: '/api/cron/digest', maxMs: 30000 },
]

for (const ep of cronEndpoints) {
  const r = await fetchTimed(ep.path, {
    headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
  })
  if (r.status === 200) {
    result(`CRON-${ep.name}`,
      r.ms < ep.maxMs / 2 ? 'pass' : r.ms < ep.maxMs ? 'warn' : 'fail',
      `${ep.name}: ${r.ms}ms (limit: ${ep.maxMs}ms)`)
  } else {
    result(`CRON-${ep.name}`, 'fail', `${ep.name}: HTTP ${r.status} in ${r.ms}ms`)
  }
}

// ═══════════════════════════════════════
// 3. WhatsApp 连接状态
// ═══════════════════════════════════════

console.log('\n═══ 3. WhatsApp Session Health ═══')

const waResult = await fetchTimed('/api/whatsapp')
if (waResult.status === 200) {
  const connected = waResult.data?.connected
  result('WA-01', connected ? 'pass' : 'warn',
    `WhatsApp: ${connected ? 'connected' : 'DISCONNECTED — push notifications will fail'}`)
} else if (waResult.status === 401) {
  result('WA-01', 'warn', 'WhatsApp: cannot check (not authenticated)')
} else {
  result('WA-01', 'warn', `WhatsApp: HTTP ${waResult.status}`)
}

// ═══════════════════════════════════════
// 4. 承诺去重测试
// ═══════════════════════════════════════

console.log('\n═══ 4. Commitment Dedup Check ═══')

const commitmentsRes = await fetchTimed('/api/commitments')
if (commitmentsRes.status === 200) {
  const commitments = commitmentsRes.data?.commitments || commitmentsRes.data || []

  // Check for potential duplicates: same contact + similar title
  const dupes: Array<{ a: string; b: string; contact: string }> = []
  for (let i = 0; i < commitments.length; i++) {
    for (let j = i + 1; j < commitments.length; j++) {
      const a = commitments[i]
      const b = commitments[j]
      if (a.contact_email === b.contact_email && a.contact_email) {
        // Simple similarity: check if titles share >50% of words
        const wordsA = new Set((a.title || '').toLowerCase().split(/\s+/))
        const wordsB = new Set((b.title || '').toLowerCase().split(/\s+/))
        const overlap = [...wordsA].filter(w => wordsB.has(w)).length
        const similarity = overlap / Math.max(wordsA.size, wordsB.size)
        if (similarity > 0.5) {
          dupes.push({ a: a.title, b: b.title, contact: a.contact_email })
        }
      }
    }
  }

  result('DEDUP-01', dupes.length === 0 ? 'pass' : 'warn',
    `${commitments.length} commitments, ${dupes.length} potential duplicates`)

  if (dupes.length > 0) {
    for (const d of dupes.slice(0, 3)) {
      console.log(`    ⚠️  "${d.a}" ↔ "${d.b}" (${d.contact})`)
    }
  }
} else {
  result('DEDUP-01', 'warn', `Cannot check: HTTP ${commitmentsRes.status}`)
}

// ═══════════════════════════════════════
// 5. LLM 成本估算
// ═══════════════════════════════════════

console.log('\n═══ 5. LLM Cost Estimation ═══')

const emailsRes = await fetchTimed('/api/emails')
if (emailsRes.status === 200) {
  const emails = emailsRes.data || []
  const totalEmails = emails.length

  // Estimate: ~30% pass pre-filter → need LLM
  const needLLM = Math.ceil(totalEmails * 0.3)
  const costPerCall = 0.003  // ~$0.003 per DeepSeek call (input+output)
  const dailyCost = needLLM * costPerCall
  const monthlyCost = dailyCost * 30

  result('COST-01', monthlyCost < 50 ? 'pass' : monthlyCost < 100 ? 'warn' : 'fail',
    `Emails in DB: ${totalEmails}. Estimated LLM cost: ~$${monthlyCost.toFixed(2)}/month (this user)`)

  // Extrapolate to 50 users
  const cost50 = monthlyCost * 50
  result('COST-02', cost50 < 500 ? 'pass' : cost50 < 2000 ? 'warn' : 'fail',
    `At 50 users: ~$${cost50.toFixed(0)}/month LLM cost vs $${50 * 50} subscription revenue`)
} else {
  result('COST-01', 'warn', `Cannot estimate: HTTP ${emailsRes.status}`)
}

// ═══════════════════════════════════════
// 6. notification_log 膨胀检查
// ═══════════════════════════════════════

console.log('\n═══ 6. Data Growth Check ═══')

// Check table sizes via API calls
const tables = [
  { name: 'emails', path: '/api/emails' },
  { name: 'commitments', path: '/api/commitments' },
  { name: 'contacts', path: '/api/contacts' },
]

for (const t of tables) {
  const r = await fetchTimed(t.path)
  if (r.status === 200) {
    const count = Array.isArray(r.data) ? r.data.length : (r.data?.commitments?.length || r.data?.length || '?')
    result(`DATA-${t.name}`, 'pass', `${t.name}: ${count} rows (query: ${r.ms}ms)`)
  }
}

// ═══════════════════════════════════════
// 7. 首次同步模拟（测量 Wow 端点速度）
// ═══════════════════════════════════════

console.log('\n═══ 7. First-Time Wow Speed ═══')

const wowResult = await fetchTimed('/api/onboarding/wow')
if (wowResult.status === 200) {
  result('WOW-01', wowResult.ms < 5000 ? 'pass' : wowResult.ms < 15000 ? 'warn' : 'fail',
    `Wow instant data: ${wowResult.ms}ms (target: <5000ms)`)

  const data = wowResult.data
  result('WOW-02', 'pass',
    `Wow data: ${data?.unrepliedCount || 0} unreplied, ${data?.coolingCount || 0} cooling, ${data?.conflictCount || 0} conflicts`)
} else if (wowResult.status === 401) {
  result('WOW-01', 'warn', `Wow: needs auth (HTTP 401), ${wowResult.ms}ms`)
} else {
  result('WOW-01', 'fail', `Wow: HTTP ${wowResult.status}, ${wowResult.ms}ms`)
}

// ═══════════════════════════════════════
// 8. Agent 响应时间（模拟用户等待）
// ═══════════════════════════════════════

console.log('\n═══ 8. Agent Response Times (User Wait) ═══')

const agents = [
  { name: 'Weaver', path: '/api/agents/weaver', maxMs: 5000 },
  { name: 'Radar', path: '/api/agents/radar', maxMs: 5000 },
  { name: 'Travel Brain', path: '/api/agents/travel-brain', maxMs: 5000 },
]

for (const agent of agents) {
  const r = await fetchTimed(agent.path)
  const effectiveMs = r.ms
  if (r.status === 200) {
    result(`AGENT-${agent.name}`,
      effectiveMs < agent.maxMs / 2 ? 'pass' : effectiveMs < agent.maxMs ? 'warn' : 'fail',
      `${agent.name}: ${effectiveMs}ms (target: <${agent.maxMs}ms)`)
  } else if (r.status === 401) {
    result(`AGENT-${agent.name}`, 'warn', `${agent.name}: needs auth (${effectiveMs}ms)`)
  } else {
    result(`AGENT-${agent.name}`, 'fail', `${agent.name}: HTTP ${r.status} (${effectiveMs}ms)`)
  }
}

// ═══════════════════════════════════════
// 9. 并发请求压力测试（模拟多用户同时访问）
// ═══════════════════════════════════════

console.log('\n═══ 9. Concurrent Request Stress ═══')

const concurrentPaths = [
  '/api/commitments',
  '/api/contacts',
  '/api/emails',
  '/api/calendar',
  '/api/trips',
]

const startConcurrent = Date.now()
const concurrentResults = await Promise.all(
  concurrentPaths.map(p => fetchTimed(p))
)
const totalConcurrentMs = Date.now() - startConcurrent

const allOk = concurrentResults.every(r => r.status === 200 || r.status === 401)
const maxSingle = Math.max(...concurrentResults.map(r => r.ms))

result('STRESS-01', allOk ? 'pass' : 'fail',
  `5 concurrent requests: total ${totalConcurrentMs}ms, max single ${maxSingle}ms, all OK: ${allOk}`)

// 10 concurrent (simulate 10 users loading dashboard simultaneously)
const start10 = Date.now()
const results10 = await Promise.all(
  Array(10).fill(null).map((_, i) =>
    fetchTimed(concurrentPaths[i % concurrentPaths.length])
  )
)
const total10Ms = Date.now() - start10
const all10Ok = results10.every(r => r.status === 200 || r.status === 401)
const max10 = Math.max(...results10.map(r => r.ms))

result('STRESS-02', all10Ok && max10 < 10000 ? 'pass' : max10 < 20000 ? 'warn' : 'fail',
  `10 concurrent: total ${total10Ms}ms, max single ${max10}ms, all OK: ${all10Ok}`)

// ═══════════════════════════════════════
// Summary
// ═══════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`)
console.log(`Production Simulation Results:`)
console.log(`  ✅ Passed:   ${passed}`)
console.log(`  ⚠️  Warnings: ${warnings}`)
console.log(`  ❌ Failed:   ${failed}`)
console.log(`  Total:       ${total}`)
console.log(`${'═'.repeat(60)}`)

if (warnings > 0) {
  console.log(`\n⚠️  Warnings indicate areas to monitor after launch.`)
}
if (failed > 0) {
  console.log(`\n❌ Failures indicate issues to fix BEFORE launch.`)
  process.exit(1)
}

}

main().catch(err => { console.error(err); process.exit(1) })
