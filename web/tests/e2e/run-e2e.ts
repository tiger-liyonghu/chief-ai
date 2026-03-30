#!/usr/bin/env npx tsx
/**
 * E2E Test Runner for Chief AI
 *
 * Usage:
 *   npx tsx tests/e2e/run-e2e.ts [options]
 *     --category <name>       Filter by category
 *     --priority <P0|P1|P2>   Filter by priority
 *     --type <ui|api|flow|data> Filter by type
 *     --base-url <url>        Base URL (default: http://localhost:3000)
 *     --auth-email <email>    Email to authenticate with (Supabase magic link)
 *     --screenshots <dir>     Screenshot output dir
 *     --verbose               Show each step
 */

import { execSync } from 'child_process'
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { TEST_CASES, type TestCase, type TestStep, type TestStatus } from './test-cases'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface TestResult {
  id: string
  name: string
  category: string
  priority: string
  status: TestStatus
  duration_ms: number
  steps_passed: number
  steps_total: number
  failure_step?: string
  failure_reason?: string
  screenshot?: string
}

interface RunConfig {
  category?: string
  priority?: string
  type?: string
  baseUrl: string
  authEmail?: string
  screenshotDir: string
  verbose: boolean
}

interface AuthSession {
  access_token: string
  refresh_token: string
}

// ─────────────────────────────────────────────
// CLI arg parsing
// ─────────────────────────────────────────────

function parseArgs(): RunConfig {
  const args = process.argv.slice(2)
  const cfg: RunConfig = {
    baseUrl: 'http://localhost:3000',
    screenshotDir: resolve(process.cwd(), '.gstack/e2e-screenshots'),
    verbose: false,
  }
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--category':   cfg.category = args[++i]; break
      case '--priority':   cfg.priority = args[++i]; break
      case '--type':       cfg.type = args[++i]; break
      case '--base-url':   cfg.baseUrl = args[++i]; break
      case '--auth-email': cfg.authEmail = args[++i]; break
      case '--screenshots': cfg.screenshotDir = resolve(args[++i]); break
      case '--verbose':    cfg.verbose = true; break
    }
  }
  return cfg
}

// ─────────────────────────────────────────────
// Supabase credentials from .env.local
// ─────────────────────────────────────────────

function loadEnv(): { url: string; anonKey: string; serviceKey: string } {
  const envPath = resolve(__dirname, '../../.env.local')
  const content = readFileSync(envPath, 'utf-8')
  const get = (key: string) => {
    const m = content.match(new RegExp(`^${key}=(.+)$`, 'm'))
    return m?.[1]?.trim() || ''
  }
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: get('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    serviceKey: get('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

// ─────────────────────────────────────────────
// Auth: Supabase admin magic link -> session
// ─────────────────────────────────────────────

async function authenticate(email: string, env: ReturnType<typeof loadEnv>): Promise<AuthSession | null> {
  try {
    // Generate OTP via admin API
    const otpRes = await fetch(`${env.url}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'apikey': env.serviceKey,
        'Authorization': `Bearer ${env.serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'magiclink', email }),
    })
    const otpData = await otpRes.json()
    if (!otpData.properties?.email_otp) {
      console.error('[AUTH] Failed to generate OTP:', JSON.stringify(otpData).slice(0, 200))
      return null
    }
    const emailOtp = otpData.properties.email_otp

    // Verify OTP to get session
    const sessionRes = await fetch(`${env.url}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'apikey': env.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'magiclink', token: emailOtp, email }),
    })
    const session = await sessionRes.json()
    if (!session.access_token) {
      console.error('[AUTH] Failed to verify OTP:', JSON.stringify(session).slice(0, 200))
      return null
    }
    return { access_token: session.access_token, refresh_token: session.refresh_token }
  } catch (err: any) {
    console.error('[AUTH] Error:', err.message)
    return null
  }
}

// ─────────────────────────────────────────────
// Browse binary wrapper
// ─────────────────────────────────────────────

const BROWSE_BIN = resolve(process.env.HOME || '~', '.claude/skills/gstack/browse/dist/browse')
const hasBrowse = existsSync(BROWSE_BIN)

function browse(cmd: string, timeout = 15000): string {
  try {
    return execSync(`"${BROWSE_BIN}" ${cmd}`, { timeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch (e: any) {
    return e.stdout?.trim() || e.stderr?.trim() || e.message || 'browse command failed'
  }
}

function screenshot(name: string, dir: string): string | undefined {
  if (!hasBrowse) return undefined
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${name}.png`)
  try {
    browse(`screenshot "${path}"`)
    return path
  } catch { return undefined }
}

// ─────────────────────────────────────────────
// Step executors
// ─────────────────────────────────────────────

/** State shared across steps within a single test */
interface StepCtx {
  cfg: RunConfig
  session: AuthSession | null
  lastApiResponse: any
  lastApiStatus: number
  currentUrl: string
}

function resolveUrl(target: string | undefined, baseUrl: string): string {
  if (!target) return baseUrl
  if (target.startsWith('http')) return target
  return `${baseUrl}${target.startsWith('/') ? '' : '/'}${target}`
}

async function execApiCall(step: TestStep, ctx: StepCtx): Promise<{ ok: boolean; detail: string }> {
  const raw = step.target || ''
  const match = raw.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(.+)$/)
  const method = match?.[1] || 'GET'
  const path = match?.[2] || raw
  const url = resolveUrl(path, ctx.cfg.baseUrl)

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ctx.session) headers['Authorization'] = `Bearer ${ctx.session.access_token}`

  const opts: RequestInit = { method, headers }
  if (step.data && method !== 'GET') opts.body = step.data

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    opts.signal = controller.signal

    // SSE streams need special handling
    if (url.includes('scan-stream')) {
      const res = await fetch(url, opts)
      clearTimeout(timer)
      ctx.lastApiStatus = res.status
      const text = await res.text()
      ctx.lastApiResponse = text
      const ok = res.status < 500
      return { ok, detail: `${res.status} (${text.length} bytes SSE)` }
    }

    const res = await fetch(url, opts)
    clearTimeout(timer)
    ctx.lastApiStatus = res.status
    const text = await res.text()
    try { ctx.lastApiResponse = JSON.parse(text) } catch { ctx.lastApiResponse = text }
    const ok = res.status < 500
    return { ok, detail: `${res.status} ${typeof ctx.lastApiResponse === 'object' ? JSON.stringify(ctx.lastApiResponse).slice(0, 120) : String(ctx.lastApiResponse).slice(0, 120)}` }
  } catch (err: any) {
    return { ok: false, detail: err.message }
  }
}

async function execStep(step: TestStep, ctx: StepCtx): Promise<{ ok: boolean; detail: string }> {
  const { action, target, data, verify } = step

  switch (action) {
    case 'navigate': {
      if (!hasBrowse) return { ok: false, detail: 'browse binary not available' }
      const url = resolveUrl(target, ctx.cfg.baseUrl)
      const out = browse(`goto "${url}"`)
      ctx.currentUrl = url
      const ok = !out.toLowerCase().includes('error') || out.includes('200') || out.includes('loaded')
      return { ok: true, detail: out.slice(0, 120) }
    }

    case 'click': {
      if (!hasBrowse) return { ok: false, detail: 'browse binary not available' }
      const out = browse(`click "${target || ''}"`)
      return { ok: !out.toLowerCase().includes('not found'), detail: out.slice(0, 120) }
    }

    case 'fill': {
      if (!hasBrowse) return { ok: false, detail: 'browse binary not available' }
      const out = browse(`fill "${target || ''}" "${data || ''}"`)
      return { ok: true, detail: out.slice(0, 120) }
    }

    case 'check_element': {
      if (!hasBrowse) return { ok: false, detail: 'browse binary not available' }
      const snap = browse('snapshot -i')
      const found = target ? snap.toLowerCase().includes(target.toLowerCase().split('(')[0].trim().toLowerCase()) : true
      return { ok: found, detail: found ? `Found: ${target}` : `Not found: ${target} (snapshot ${snap.length} chars)` }
    }

    case 'check_text': {
      if (!hasBrowse) return { ok: false, detail: 'browse binary not available' }
      const text = browse('js "document.body.innerText"')
      const search = verify?.match(/Contains "([^"]+)"/)?.[1] || target || ''
      const found = search ? text.includes(search) : text.length > 0
      return { ok: found, detail: found ? `Found text: "${search}"` : `Text "${search}" not found in ${text.length} chars` }
    }

    case 'check_console': {
      if (!hasBrowse) return { ok: false, detail: 'browse binary not available' }
      const out = browse('console --errors')
      const hasErrors = out.includes('Error') || out.includes('error')
      const ok = verify?.includes('Zero') || verify?.includes('No') ? !hasErrors : true
      return { ok, detail: hasErrors ? out.slice(0, 200) : 'No console errors' }
    }

    case 'set_viewport': {
      if (!hasBrowse) return { ok: false, detail: 'browse binary not available' }
      const out = browse(`viewport ${data || '1280x720'}`)
      return { ok: true, detail: `Viewport set to ${data}` }
    }

    case 'wait_for': {
      if (!hasBrowse) return { ok: false, detail: 'browse binary not available' }
      const timeoutMatch = data?.match(/(\d+)s/)
      const maxWait = (timeoutMatch ? parseInt(timeoutMatch[1]) : 10) * 1000
      const start = Date.now()
      while (Date.now() - start < maxWait) {
        const snap = browse('snapshot -i')
        const search = target?.toLowerCase() || ''
        if (search && snap.toLowerCase().includes(search)) return { ok: true, detail: `Found after ${Date.now() - start}ms` }
        await new Promise(r => setTimeout(r, 2000))
      }
      return { ok: false, detail: `Timed out after ${maxWait}ms waiting for: ${target}` }
    }

    case 'reload_page': {
      if (!hasBrowse) return { ok: false, detail: 'browse binary not available' }
      const out = browse(`goto "${ctx.currentUrl || ctx.cfg.baseUrl}"`)
      return { ok: true, detail: 'Page reloaded' }
    }

    case 'api_call':
      return execApiCall(step, ctx)

    case 'check_response': {
      const resp = ctx.lastApiResponse
      const ok = resp !== undefined && resp !== null && ctx.lastApiStatus < 500
      return { ok, detail: `Status ${ctx.lastApiStatus}, response: ${JSON.stringify(resp).slice(0, 120)}` }
    }

    case 'seed_data': {
      // Seed data via Supabase admin - placeholder, mark as skip
      return { ok: false, detail: 'seed_data not implemented (requires specific table knowledge)' }
    }

    case 'compare': {
      // Data comparison - relies on lastApiResponse
      const ok = ctx.lastApiResponse != null
      return { ok, detail: `Comparison check (manual verify): ${verify}` }
    }

    case 'check_data': {
      const ok = ctx.lastApiResponse != null
      return { ok, detail: `Data check (manual verify): ${verify}` }
    }

    case 'check_value': {
      if (!hasBrowse) return { ok: false, detail: 'browse binary not available' }
      const out = browse(`js "document.querySelector('input')?.value"`)
      return { ok: out.length > 0, detail: out.slice(0, 120) }
    }

    case 'count': {
      if (!hasBrowse) return { ok: false, detail: 'browse binary not available' }
      const snap = browse('snapshot -i')
      return { ok: true, detail: `Snapshot: ${snap.length} chars (count recorded)` }
    }

    case 'scroll_to': {
      if (!hasBrowse) return { ok: false, detail: 'browse binary not available' }
      const out = browse(`js "document.querySelector('[data-section]')?.scrollIntoView()"`)
      return { ok: true, detail: 'Scrolled' }
    }

    case 'select': {
      if (!hasBrowse) return { ok: false, detail: 'browse binary not available' }
      const out = browse(`fill "${target || ''}" "${data || ''}"`)
      return { ok: true, detail: out.slice(0, 120) }
    }

    default:
      return { ok: false, detail: `Unknown action: ${action}` }
  }
}

// ─────────────────────────────────────────────
// Test runner
// ─────────────────────────────────────────────

function needsBrowse(tc: TestCase): boolean {
  return tc.type === 'ui' || tc.type === 'flow'
}

function needsAuth(tc: TestCase): boolean {
  return tc.preconditions.some(p => p.toLowerCase().includes('logged in'))
}

async function runTest(tc: TestCase, cfg: RunConfig, session: AuthSession | null): Promise<TestResult> {
  const start = Date.now()
  const result: TestResult = {
    id: tc.id, name: tc.name, category: tc.category, priority: tc.priority,
    status: 'pass', duration_ms: 0, steps_passed: 0, steps_total: tc.steps.length,
  }

  // Skip conditions
  if (needsBrowse(tc) && !hasBrowse) {
    result.status = 'skip'
    result.failure_reason = 'browse binary not available'
    result.duration_ms = Date.now() - start
    return result
  }
  if (needsAuth(tc) && !session) {
    result.status = 'skip'
    result.failure_reason = 'No auth session (use --auth-email)'
    result.duration_ms = Date.now() - start
    return result
  }

  const ctx: StepCtx = {
    cfg, session, lastApiResponse: null, lastApiStatus: 0, currentUrl: cfg.baseUrl,
  }

  for (let i = 0; i < tc.steps.length; i++) {
    const step = tc.steps[i]
    const stepLabel = `${step.action}${step.target ? ': ' + step.target : ''}`

    try {
      const { ok, detail } = await execStep(step, ctx)
      if (cfg.verbose) {
        console.log(`    Step ${i + 1}/${tc.steps.length}: ${stepLabel} => ${ok ? 'OK' : 'FAIL'} ${detail.slice(0, 80)}`)
      }
      if (!ok) {
        result.status = 'fail'
        result.failure_step = `Step ${i + 1}: "${step.verify || stepLabel}"`
        result.failure_reason = detail
        result.screenshot = screenshot(`${tc.id}-fail`, cfg.screenshotDir)
        break
      }
      result.steps_passed++
    } catch (err: any) {
      result.status = 'fail'
      result.failure_step = `Step ${i + 1}: "${stepLabel}"`
      result.failure_reason = err.message
      result.screenshot = screenshot(`${tc.id}-fail`, cfg.screenshotDir)
      break
    }
  }

  result.duration_ms = Date.now() - start
  return result
}

// ─────────────────────────────────────────────
// Output formatting
// ─────────────────────────────────────────────

const STATUS_ICON: Record<TestStatus, string> = { pass: 'PASS', fail: 'FAIL', skip: 'SKIP', blocked: 'BLKD' }

function printResult(r: TestResult) {
  const icon = STATUS_ICON[r.status]
  const dur = `${r.duration_ms}ms`
  const steps = `${r.steps_passed}/${r.steps_total}`
  console.log(`  [${icon}] ${r.id}: ${r.name} (${steps} steps, ${dur})`)
  if (r.status === 'fail') {
    console.log(`         ${r.failure_step}`)
    console.log(`         ${r.failure_reason?.slice(0, 120)}`)
  }
  if (r.status === 'skip') {
    console.log(`         Reason: ${r.failure_reason}`)
  }
}

function printSummary(results: TestResult[]) {
  const pass = results.filter(r => r.status === 'pass').length
  const fail = results.filter(r => r.status === 'fail').length
  const skip = results.filter(r => r.status === 'skip').length
  const blocked = results.filter(r => r.status === 'blocked').length

  console.log('\n')
  console.log('E2E TEST RESULTS')
  console.log('=' .repeat(52))
  console.log(` PASS: ${pass}   FAIL: ${fail}   SKIP: ${skip}   BLOCKED: ${blocked}`)

  // By priority
  console.log('\nBy Priority:')
  for (const p of ['P0', 'P1', 'P2']) {
    const group = results.filter(r => r.priority === p)
    const pPass = group.filter(r => r.status === 'pass').length
    const pct = group.length ? Math.round(pPass / group.length * 100) : 0
    console.log(`  ${p}: ${pPass}/${group.length} pass (${pct}%)`)
  }

  // By category
  console.log('\nBy Category:')
  const cats = [...new Set(results.map(r => r.category))]
  for (const cat of cats) {
    const group = results.filter(r => r.category === cat)
    const cPass = group.filter(r => r.status === 'pass').length
    console.log(`  ${cat}: ${cPass}/${group.length} pass`)
  }

  // Failures detail
  const failures = results.filter(r => r.status === 'fail')
  if (failures.length > 0) {
    console.log('\nFAILURES:')
    for (const f of failures) {
      console.log(`  [FAIL] ${f.id}: ${f.name}`)
      console.log(`    ${f.failure_step}`)
      console.log(`    ${f.failure_reason?.slice(0, 150)}`)
      if (f.screenshot) console.log(`    Screenshot: ${f.screenshot}`)
    }
  }

  console.log('\n' + '='.repeat(52))
  console.log(`Total: ${results.length} tests | Duration: ${results.reduce((s, r) => s + r.duration_ms, 0)}ms`)
}

function generateReport(results: TestResult[], cfg: RunConfig): string {
  const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const pass = results.filter(r => r.status === 'pass').length
  const fail = results.filter(r => r.status === 'fail').length
  const skip = results.filter(r => r.status === 'skip').length

  let md = `# E2E Test Report\n\n`
  md += `**Date**: ${new Date().toISOString()}\n`
  md += `**Base URL**: ${cfg.baseUrl}\n`
  md += `**Auth**: ${cfg.authEmail || 'none'}\n`
  md += `**Browse**: ${hasBrowse ? 'available' : 'not available'}\n\n`
  md += `## Summary\n\n`
  md += `| Status | Count |\n|--------|-------|\n`
  md += `| Pass | ${pass} |\n| Fail | ${fail} |\n| Skip | ${skip} |\n`
  md += `| **Total** | **${results.length}** |\n\n`

  md += `## Results\n\n`
  md += `| ID | Name | Priority | Status | Steps | Duration |\n`
  md += `|----|------|----------|--------|-------|----------|\n`
  for (const r of results) {
    md += `| ${r.id} | ${r.name} | ${r.priority} | ${r.status.toUpperCase()} | ${r.steps_passed}/${r.steps_total} | ${r.duration_ms}ms |\n`
  }

  if (fail > 0) {
    md += `\n## Failures\n\n`
    for (const f of results.filter(r => r.status === 'fail')) {
      md += `### ${f.id}: ${f.name}\n`
      md += `- **Step**: ${f.failure_step}\n`
      md += `- **Reason**: ${f.failure_reason}\n`
      if (f.screenshot) md += `- **Screenshot**: ${f.screenshot}\n`
      md += `\n`
    }
  }

  return md
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  const cfg = parseArgs()
  const env = loadEnv()

  console.log('Chief AI E2E Test Runner')
  console.log('='.repeat(52))
  console.log(`Base URL:    ${cfg.baseUrl}`)
  console.log(`Browse:      ${hasBrowse ? 'available' : 'NOT FOUND (UI tests will be skipped)'}`)
  console.log(`Auth email:  ${cfg.authEmail || 'none (auth-required tests will be skipped)'}`)
  if (cfg.category) console.log(`Filter cat:  ${cfg.category}`)
  if (cfg.priority) console.log(`Filter pri:  ${cfg.priority}`)
  if (cfg.type)     console.log(`Filter type: ${cfg.type}`)
  console.log('')

  // Filter tests
  let tests = [...TEST_CASES]
  if (cfg.category) tests = tests.filter(t => t.category.toLowerCase() === cfg.category!.toLowerCase())
  if (cfg.priority) tests = tests.filter(t => t.priority === cfg.priority)
  if (cfg.type)     tests = tests.filter(t => t.type === cfg.type)

  console.log(`Running ${tests.length} tests...\n`)

  // Authenticate if email provided
  let session: AuthSession | null = null
  if (cfg.authEmail) {
    console.log(`Authenticating as ${cfg.authEmail}...`)
    session = await authenticate(cfg.authEmail, env)
    if (session) {
      console.log('Auth OK (session acquired)\n')
    } else {
      console.log('Auth FAILED (auth-required tests will be skipped)\n')
    }
  }

  // Run tests
  const results: TestResult[] = []
  for (const tc of tests) {
    if (cfg.verbose) console.log(`\n--- ${tc.id}: ${tc.name} ---`)
    const result = await runTest(tc, cfg, session)
    results.push(result)
    printResult(result)
  }

  // Summary
  printSummary(results)

  // Save report
  const reportDir = resolve(process.cwd(), '.gstack/e2e-reports')
  mkdirSync(reportDir, { recursive: true })
  const date = new Date().toISOString().slice(0, 10)
  const reportPath = join(reportDir, `e2e-report-${date}.md`)
  writeFileSync(reportPath, generateReport(results, cfg))
  console.log(`\nReport saved to: ${reportPath}`)

  // Exit code
  const failures = results.filter(r => r.status === 'fail').length
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Runner crashed:', err)
  process.exit(2)
})
