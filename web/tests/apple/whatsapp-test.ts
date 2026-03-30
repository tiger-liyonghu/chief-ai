/**
 * Apple WhatsApp Capability Test Suite
 * ====================================
 * Tests all 32 tools via WhatsApp Service API + verifies backend state.
 *
 * Usage: npx tsx tests/apple/whatsapp-test.ts [--suite a|b|c|d|e|p|l|all]
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local
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
} catch {}

// ─── Config ───

const WA_SERVICE = 'http://localhost:3001'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const USER_ID = 'fd02d097-4d5c-4675-b559-4c2b8c4ddc68' // Sophie's user_id

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Helpers ───

interface TestResult {
  suite: string
  name: string
  passed: boolean
  details: string
  responseTime: number
  appleReply?: string
}

const results: TestResult[] = []

async function sendMessage(text: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${WA_SERVICE}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: USER_ID, message: text }),
  })
  return res.json()
}

async function waitForReply(afterTimestamp: string, maxWaitMs = 45000): Promise<string | null> {
  // Apple needs time: receive msg → LLM + tool calls → send reply
  // Wait at least 8 seconds before first check
  await sleep(8000)

  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('body, direction, created_at')
      .eq('user_id', USER_ID)
      .eq('direction', 'inbound')
      .gt('created_at', afterTimestamp)
      .order('created_at', { ascending: false })
      .limit(1)

    if (data && data.length > 0 && data[0].body) {
      return data[0].body
    }
    await sleep(3000)
  }
  return null
}

async function testApple(suite: string, name: string, message: string, checks: {
  replyContains?: string[]
  replyNotContains?: string[]
  dbCheck?: () => Promise<boolean>
  maxResponseTime?: number
}): Promise<TestResult> {
  const timestamp = new Date().toISOString()
  const start = Date.now()

  console.log(`  Testing: ${name}`)
  console.log(`    Sending: "${message}"`)

  // Send message
  const sendResult = await sendMessage(message)
  if (!sendResult.ok) {
    const result: TestResult = { suite, name, passed: false, details: 'Failed to send message', responseTime: 0 }
    results.push(result)
    console.log(`    FAIL: Could not send message`)
    return result
  }

  // Wait for reply
  const reply = await waitForReply(timestamp, checks.maxResponseTime || 30000)
  const responseTime = Date.now() - start

  if (!reply) {
    const result: TestResult = { suite, name, passed: false, details: 'No reply received within timeout', responseTime }
    results.push(result)
    console.log(`    FAIL: No reply (${responseTime}ms)`)
    return result
  }

  console.log(`    Reply (${responseTime}ms): ${reply.slice(0, 100)}${reply.length > 100 ? '...' : ''}`)

  // Check reply content
  const failures: string[] = []

  if (checks.replyContains) {
    for (const keyword of checks.replyContains) {
      if (!reply.toLowerCase().includes(keyword.toLowerCase())) {
        failures.push(`Reply missing keyword: "${keyword}"`)
      }
    }
  }

  if (checks.replyNotContains) {
    for (const keyword of checks.replyNotContains) {
      if (reply.toLowerCase().includes(keyword.toLowerCase())) {
        failures.push(`Reply should not contain: "${keyword}"`)
      }
    }
  }

  // Check DB state
  if (checks.dbCheck) {
    try {
      const dbOk = await checks.dbCheck()
      if (!dbOk) failures.push('DB state verification failed')
    } catch (err) {
      failures.push(`DB check error: ${(err as Error).message}`)
    }
  }

  const passed = failures.length === 0
  const result: TestResult = {
    suite, name, passed,
    details: passed ? 'OK' : failures.join('; '),
    responseTime,
    appleReply: reply.slice(0, 200),
  }
  results.push(result)
  console.log(`    ${passed ? 'PASS' : 'FAIL'}: ${result.details} (${responseTime}ms)`)
  return result
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ─── Test Suites ───

async function suiteA_Brain() {
  console.log('\n=== Suite A: Brain (Work Management) ===\n')

  // A1: Calendar
  await testApple('A', 'A1: Calendar query', '今天有什么会？', {
    replyContains: [], // Just check it replies
    maxResponseTime: 10000,
  })
  await sleep(3000)

  // A2: Email
  await testApple('A', 'A2: Email query', '有什么邮件要处理？', {
    maxResponseTime: 10000,
  })
  await sleep(3000)

  // A3: Create task
  await testApple('A', 'A3: Create task', '记一下，后天前把测试报告发给David', {
    replyContains: ['David'],
    dbCheck: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id, title')
        .eq('user_id', USER_ID)
        .ilike('title', '%David%')
        .order('created_at', { ascending: false })
        .limit(1)
      return (data?.length ?? 0) > 0
    },
  })
  await sleep(3000)

  // A4: Commitment query
  await testApple('A', 'A4: My commitments', '我欠谁什么？', {
    maxResponseTime: 10000,
  })
  await sleep(3000)

  // A5: Others' commitments
  await testApple('A', 'A5: Others commitments', '谁欠我什么？', {
    maxResponseTime: 10000,
  })
  await sleep(3000)

  // A6: Draft email
  await testApple('A', 'A6: Draft email', '帮我给David写封邮件，说测试报告明天发', {
    replyContains: ['David'],
    maxResponseTime: 15000,
  })
  await sleep(3000)
}

async function suiteC_Relationship() {
  console.log('\n=== Suite C: Relationship (Contact Intelligence) ===\n')

  // C1: Contact query
  await testApple('C', 'C1: Contact query', '帮我查一下David Chen的信息', {
    maxResponseTime: 10000,
  })
  await sleep(3000)

  // C2: Taste update
  await testApple('C', 'C2: Taste update', 'David喜欢喝日本威士忌，记一下', {
    replyContains: ['记', '威士忌'],
    maxResponseTime: 10000,
  })
  await sleep(3000)
}

async function suiteD_Intelligence() {
  console.log('\n=== Suite D: Intelligence (Industry Radar) ===\n')

  // D1: Company news (uses "先应后回")
  await testApple('D', 'D1: Company news', '帮我查一下Grab最近有什么新闻', {
    maxResponseTime: 45000, // Allow time for "先应后回"
  })
  await sleep(5000)
}

async function suiteE_Travel() {
  console.log('\n=== Suite E: Travel (Trip Management) ===\n')

  // E1: Trip query
  await testApple('E', 'E1: Trip query', '下趟出差什么安排？', {
    maxResponseTime: 10000,
  })
  await sleep(3000)
}

async function suiteP_Stress() {
  console.log('\n=== Suite P: Stress Tests ===\n')

  // P1: Rapid fire (5 messages in quick succession)
  console.log('  P1: Rapid fire (5 messages, 2s interval)')
  const rapidStart = Date.now()
  let rapidReplies = 0
  for (let i = 0; i < 5; i++) {
    await sendMessage(`快速测试 ${i + 1}: 现在几点？`)
    await sleep(2000)
  }
  // Wait for all replies
  await sleep(15000)
  const { data: rapidData } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('user_id', USER_ID)
    .eq('from_me', true)
    .gt('created_at', new Date(rapidStart).toISOString())
  rapidReplies = rapidData?.length ?? 0
  const rapidResult: TestResult = {
    suite: 'P', name: 'P1: Rapid fire',
    passed: rapidReplies >= 3, // At least 3 of 5 should reply
    details: `${rapidReplies}/5 replies received`,
    responseTime: Date.now() - rapidStart,
  }
  results.push(rapidResult)
  console.log(`    ${rapidResult.passed ? 'PASS' : 'FAIL'}: ${rapidResult.details}`)
  await sleep(5000)

  // P3: Multi-language
  console.log('  P3: Multi-language switching')
  await testApple('P', 'P3a: Chinese', '你好，今天天气怎么样？', { maxResponseTime: 10000 })
  await sleep(3000)
  await testApple('P', 'P3b: English', 'What meetings do I have today?', { maxResponseTime: 10000 })
  await sleep(3000)
  await testApple('P', 'P3c: Mixed', '帮我 check 一下明天的 schedule', { maxResponseTime: 10000 })
  await sleep(3000)

  // P5: Error recovery
  console.log('  P5: Error recovery')
  await testApple('P', 'P5a: Gibberish', 'asdjfhaskjdfhqwer', {
    replyNotContains: ['error', '错误', 'crash'],
    maxResponseTime: 10000,
  })
  await sleep(3000)
}

// ─── Linkage Tests ───

async function suiteL_Linkage() {
  console.log('\n=== Suite L: Linkage (Cross-module Integration) ===\n')

  // L1: Create commitment via WhatsApp, verify in DB
  const beforeCommit = new Date().toISOString()
  await testApple('L', 'L1a: Create commitment via WA', '答应张总下周三前发合作方案', {
    replyContains: ['任务', '记', '张总'],
    maxResponseTime: 15000,
  })
  await sleep(5000)

  // Check if it appeared in commitments or tasks
  const { data: newCommitments } = await supabase
    .from('commitments')
    .select('id, title, type')
    .eq('user_id', USER_ID)
    .gt('created_at', beforeCommit)
  const { data: newTasks } = await supabase
    .from('tasks')
    .select('id, title')
    .eq('user_id', USER_ID)
    .gt('created_at', beforeCommit)

  const l1bResult: TestResult = {
    suite: 'L', name: 'L1b: Verify in DB',
    passed: ((newCommitments?.length ?? 0) + (newTasks?.length ?? 0)) > 0,
    details: `Commitments: ${newCommitments?.length ?? 0}, Tasks: ${newTasks?.length ?? 0}`,
    responseTime: 0,
  }
  results.push(l1bResult)
  console.log(`  L1b: ${l1bResult.passed ? 'PASS' : 'FAIL'}: ${l1bResult.details}`)

  // L1c: Query commitments to verify it shows up
  await sleep(3000)
  await testApple('L', 'L1c: Query commitment', '我欠谁什么？', {
    maxResponseTime: 10000,
  })
}

// ─── Main ───

async function main() {
  const args = process.argv.slice(2)
  const suiteArg = args.find(a => a.startsWith('--suite'))
    ? args[args.indexOf('--suite') + 1]
    : 'all'

  console.log('============================================')
  console.log('  Apple WhatsApp Capability Tests')
  console.log('============================================')
  console.log(`WA Service: ${WA_SERVICE}`)
  console.log(`User ID: ${USER_ID}`)
  console.log(`Suite: ${suiteArg}`)

  // Check WhatsApp service is connected
  const health = await fetch(`${WA_SERVICE}/health`).then(r => r.json()).catch(() => null)
  if (!health?.ok || health.activeConnections === 0) {
    console.error('\nERROR: WhatsApp not connected. Connect first via dashboard.')
    process.exit(1)
  }
  console.log(`WhatsApp: Connected (${health.activeConnections} active)\n`)

  const suites = suiteArg === 'all' ? ['a', 'c', 'd', 'e', 'p', 'l'] : suiteArg.split(',')

  for (const s of suites) {
    switch (s.toLowerCase()) {
      case 'a': await suiteA_Brain(); break
      case 'c': await suiteC_Relationship(); break
      case 'd': await suiteD_Intelligence(); break
      case 'e': await suiteE_Travel(); break
      case 'p': await suiteP_Stress(); break
      case 'l': await suiteL_Linkage(); break
    }
  }

  // ─── Summary ───
  console.log('\n============================================')
  console.log('  RESULTS')
  console.log('============================================')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const avgResponseTime = Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length)

  console.log(`\n  Total: ${results.length} tests`)
  console.log(`  Passed: ${passed}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Avg response time: ${avgResponseTime}ms`)

  if (failed > 0) {
    console.log('\n  Failures:')
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    ${r.name}: ${r.details}`)
    }
  }

  console.log('\n  Response Times:')
  for (const r of results.filter(r => r.responseTime > 0)) {
    const bar = '█'.repeat(Math.min(Math.round(r.responseTime / 500), 40))
    console.log(`    ${r.name.padEnd(30)} ${String(r.responseTime).padStart(6)}ms ${bar}`)
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(console.error)
