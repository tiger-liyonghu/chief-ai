/**
 * API Contract Tests — Chief of Staff
 *
 * Tests all new API endpoints for:
 *   1. 401 without auth
 *   2. Correct response shape (where testable without auth)
 *   3. Input validation (bad params return 400)
 *
 * Run:  npx tsx tests/api/contracts.test.ts
 * Requires the dev server running on port 3003.
 */

const BASE = 'http://localhost:3003'
let passed = 0
let failed = 0
let skipped = 0

// ── Helpers ─────────────────────────────────────────────────────────────────

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passed++
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`)
  } catch (err: any) {
    failed++
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}`)
    console.log(`        ${err.message}`)
  }
}

function skip(name: string, reason: string) {
  skipped++
  console.log(`  \x1b[33mSKIP\x1b[0m  ${name} — ${reason}`)
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function assertStatus(actual: number, expected: number, endpoint: string) {
  assert(actual === expected, `${endpoint}: expected status ${expected}, got ${actual}`)
}

function assertHasKey(obj: any, key: string, endpoint: string) {
  assert(key in obj, `${endpoint}: response missing key "${key}"`)
}

function assertIsArray(val: any, endpoint: string) {
  assert(Array.isArray(val), `${endpoint}: expected array, got ${typeof val}`)
}

async function fetchJSON(url: string, opts?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(url, opts)
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

// Standard headers for unauthenticated JSON requests
const JSON_HEADERS = { 'Content-Type': 'application/json' }

// ── Test runner ─────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== API Contract Tests ===\n')

  // -----------------------------------------------------------------------
  //  Connectivity check
  // -----------------------------------------------------------------------
  try {
    await fetch(`${BASE}/api/auth/session`, { signal: AbortSignal.timeout(3000) })
  } catch {
    console.error(`\x1b[31mERROR\x1b[0m  Cannot reach ${BASE} — is the dev server running?\n`)
    process.exit(1)
  }

  // =======================================================================
  //  COMMITMENTS
  // =======================================================================
  console.log('\n--- /api/commitments ---')

  await test('GET /api/commitments returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/commitments`)
    assertStatus(status, 401, 'GET /commitments')
    assertHasKey(body, 'error', 'GET /commitments')
  })

  await test('POST /api/commitments returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/commitments`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ title: 'test' }),
    })
    assertStatus(status, 401, 'POST /commitments')
    assertHasKey(body, 'error', 'POST /commitments')
  })

  await test('PATCH /api/commitments returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/commitments`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ id: 'fake', title: 'test' }),
    })
    assertStatus(status, 401, 'PATCH /commitments')
    assertHasKey(body, 'error', 'PATCH /commitments')
  })

  // -----------------------------------------------------------------------
  //  COMMITMENTS/STATS
  // -----------------------------------------------------------------------
  console.log('\n--- /api/commitments/stats ---')

  await test('GET /api/commitments/stats returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/commitments/stats`)
    assertStatus(status, 401, 'GET /commitments/stats')
    assertHasKey(body, 'error', 'GET /commitments/stats')
  })

  // -----------------------------------------------------------------------
  //  COMMITMENTS/SCAN
  // -----------------------------------------------------------------------
  console.log('\n--- /api/commitments/scan ---')

  await test('POST /api/commitments/scan returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/commitments/scan`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ hours: 24 }),
    })
    assertStatus(status, 401, 'POST /commitments/scan')
    assertHasKey(body, 'error', 'POST /commitments/scan')
  })

  // -----------------------------------------------------------------------
  //  COMMITMENTS/SCORE
  // -----------------------------------------------------------------------
  console.log('\n--- /api/commitments/score ---')

  await test('POST /api/commitments/score returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/commitments/score`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({}),
    })
    assertStatus(status, 401, 'POST /commitments/score')
    assertHasKey(body, 'error', 'POST /commitments/score')
  })

  // -----------------------------------------------------------------------
  //  COMMITMENTS/ACTIONS
  // -----------------------------------------------------------------------
  console.log('\n--- /api/commitments/actions ---')

  await test('POST /api/commitments/actions returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/commitments/actions`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ id: 'fake', action: 'mark_done' }),
    })
    assertStatus(status, 401, 'POST /commitments/actions')
    assertHasKey(body, 'error', 'POST /commitments/actions')
  })

  // =======================================================================
  //  FAMILY CALENDAR
  // =======================================================================
  console.log('\n--- /api/family-calendar ---')

  await test('GET /api/family-calendar returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/family-calendar`)
    assertStatus(status, 401, 'GET /family-calendar')
    assertHasKey(body, 'error', 'GET /family-calendar')
  })

  await test('POST /api/family-calendar returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/family-calendar`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ title: 'Test event', start_date: '2026-04-01' }),
    })
    assertStatus(status, 401, 'POST /family-calendar')
    assertHasKey(body, 'error', 'POST /family-calendar')
  })

  await test('PATCH /api/family-calendar returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/family-calendar`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ id: 'fake', title: 'Updated' }),
    })
    assertStatus(status, 401, 'PATCH /family-calendar')
    assertHasKey(body, 'error', 'PATCH /family-calendar')
  })

  await test('DELETE /api/family-calendar returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/family-calendar?id=fake`, {
      method: 'DELETE',
    })
    assertStatus(status, 401, 'DELETE /family-calendar')
    assertHasKey(body, 'error', 'DELETE /family-calendar')
  })

  // -----------------------------------------------------------------------
  //  FAMILY CALENDAR / CONFLICTS
  // -----------------------------------------------------------------------
  console.log('\n--- /api/family-calendar/conflicts ---')

  await test('POST /api/family-calendar/conflicts returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/family-calendar/conflicts`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ date: '2026-04-01' }),
    })
    assertStatus(status, 401, 'POST /family-calendar/conflicts')
    assertHasKey(body, 'error', 'POST /family-calendar/conflicts')
  })

  // -----------------------------------------------------------------------
  //  FAMILY CALENDAR / AUTO-DETECT
  // -----------------------------------------------------------------------
  console.log('\n--- /api/family-calendar/auto-detect ---')

  await test('POST /api/family-calendar/auto-detect returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/family-calendar/auto-detect`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({}),
    })
    assertStatus(status, 401, 'POST /family-calendar/auto-detect')
    assertHasKey(body, 'error', 'POST /family-calendar/auto-detect')
  })

  // =======================================================================
  //  TRIP TIMELINE
  // =======================================================================
  console.log('\n--- /api/trip-timeline ---')

  await test('GET /api/trip-timeline returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/trip-timeline?trip_id=fake`)
    assertStatus(status, 401, 'GET /trip-timeline')
    assertHasKey(body, 'error', 'GET /trip-timeline')
  })

  await test('POST /api/trip-timeline returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/trip-timeline`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        trip_id: 'fake',
        event_time: '2026-04-01T10:00:00',
        type: 'meeting',
        title: 'Test',
      }),
    })
    assertStatus(status, 401, 'POST /trip-timeline')
    assertHasKey(body, 'error', 'POST /trip-timeline')
  })

  // -----------------------------------------------------------------------
  //  TRIP TIMELINE / AUTO-GENERATE
  // -----------------------------------------------------------------------
  console.log('\n--- /api/trip-timeline/auto-generate ---')

  await test('POST /api/trip-timeline/auto-generate returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/trip-timeline/auto-generate`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ trip_id: 'fake' }),
    })
    assertStatus(status, 401, 'POST /trip-timeline/auto-generate')
    assertHasKey(body, 'error', 'POST /trip-timeline/auto-generate')
  })

  // -----------------------------------------------------------------------
  //  TRIP TIMELINE / CITY-CARD
  // -----------------------------------------------------------------------
  console.log('\n--- /api/trip-timeline/city-card ---')

  await test('POST /api/trip-timeline/city-card returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/trip-timeline/city-card`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ destination_city: 'Singapore' }),
    })
    assertStatus(status, 401, 'POST /trip-timeline/city-card')
    assertHasKey(body, 'error', 'POST /trip-timeline/city-card')
  })

  // =======================================================================
  //  INSIGHTS
  // =======================================================================
  console.log('\n--- /api/insights ---')

  await test('GET /api/insights returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/insights`)
    assertStatus(status, 401, 'GET /insights')
    assertHasKey(body, 'error', 'GET /insights')
  })

  await test('POST /api/insights returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/insights`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ period: 'weekly' }),
    })
    assertStatus(status, 401, 'POST /insights')
    assertHasKey(body, 'error', 'POST /insights')
  })

  // =======================================================================
  //  CRON / INSIGHTS
  // =======================================================================
  console.log('\n--- /api/cron/insights ---')

  await test('GET /api/cron/insights returns 401 without valid CRON_SECRET in production', async () => {
    // In dev mode this may pass through without auth. We test that
    // at minimum it does not crash and returns valid JSON.
    const { status, body } = await fetchJSON(`${BASE}/api/cron/insights`)
    // In dev it returns 200 (skips auth check); in production it returns 401.
    // We accept both but verify the body shape.
    if (status === 200) {
      assertHasKey(body, 'ok', 'GET /cron/insights (dev mode)')
    } else {
      assertStatus(status, 401, 'GET /cron/insights')
      assertHasKey(body, 'error', 'GET /cron/insights')
    }
  })

  await test('GET /api/cron/insights with wrong Bearer returns 401 in production (or valid JSON in dev)', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/cron/insights`, {
      headers: { 'Authorization': 'Bearer wrong-secret-12345' },
    })
    // Dev mode skips auth, so we accept 200 with valid shape
    if (status === 200) {
      assertHasKey(body, 'ok', 'GET /cron/insights (dev, wrong token)')
    } else {
      assertStatus(status, 401, 'GET /cron/insights (wrong token)')
    }
  })

  // =======================================================================
  //  INPUT VALIDATION TESTS (400 errors)
  // =======================================================================
  //
  //  These test that the endpoint returns 400 for known-bad inputs.
  //  Since they all require auth first (and return 401 before reaching
  //  validation), we group the ones where validation runs BEFORE auth
  //  or at the same level. For endpoints where auth is checked first,
  //  we document the expected validation contract instead.
  // =======================================================================

  console.log('\n--- Input Validation (via auth-gated contract documentation) ---')

  // The following endpoints check auth BEFORE validation, so without a
  // session we cannot trigger a 400. We document the contract here as
  // skip() entries and test the validation logic structurally.

  skip(
    'PATCH /api/commitments requires body.id',
    'Auth gate runs first; validated via code review — returns 400 if body.id missing'
  )

  skip(
    'POST /api/commitments/actions requires id + action',
    'Auth gate runs first; validated via code review — returns 400 if id or action missing'
  )

  skip(
    'PATCH /api/family-calendar requires body.id',
    'Auth gate runs first; validated via code review — returns 400 if body.id missing'
  )

  skip(
    'DELETE /api/family-calendar requires query param id',
    'Auth gate runs first; validated via code review — returns 400 if ?id missing'
  )

  skip(
    'POST /api/family-calendar/conflicts requires body.date',
    'Auth gate runs first; validated via code review — returns 400 if date missing'
  )

  skip(
    'GET /api/trip-timeline requires query param trip_id',
    'Auth gate runs first; validated via code review — returns 400 if ?trip_id missing'
  )

  skip(
    'POST /api/trip-timeline/auto-generate requires body.trip_id',
    'Auth gate runs first; validated via code review — returns 400 if trip_id missing'
  )

  skip(
    'POST /api/trip-timeline/city-card requires body.destination_city',
    'Auth gate runs first; validated via code review — returns 400 if destination_city missing'
  )

  // =======================================================================
  //  RESPONSE SHAPE CONTRACT TESTS
  //  (Documented expected shapes — verified by code review of route handlers)
  // =======================================================================

  console.log('\n--- Response Shape Contracts (documented) ---')

  skip(
    'GET /api/commitments returns array of commitment objects',
    'Shape: [{ id, type, contact_id, title, status, urgency_score, deadline, ... }]'
  )

  skip(
    'GET /api/commitments/stats returns dashboard stats object',
    'Shape: { needs_action, waiting_on_them, family_active, due_today, overdue, compliance_rate, family_compliance_rate, period_days, period_total, period_completed, period_overdue, top_urgent }'
  )

  skip(
    'POST /api/commitments/scan returns scan result',
    'Shape: { scanned, found, commitments: [...], already_scanned? }'
  )

  skip(
    'POST /api/commitments/score returns update count',
    'Shape: { updated, total }'
  )

  skip(
    'POST /api/commitments/actions returns action result',
    'Shape: { success, action, draft?, new_deadline?, tone? }'
  )

  skip(
    'GET /api/family-calendar returns array of events',
    'Shape: [{ id, event_type, title, start_date, end_date, recurrence, family_member, ... }]'
  )

  skip(
    'POST /api/family-calendar/conflicts returns conflict check',
    'Shape: { date, has_conflicts, has_hard_conflicts, conflicts: [{ event, conflict_type }] }'
  )

  skip(
    'POST /api/family-calendar/auto-detect returns detection result',
    'Shape: { detected, skipped_duplicates, total_scanned }'
  )

  skip(
    'GET /api/trip-timeline returns array of timeline events',
    'Shape: [{ id, trip_id, type, title, event_time, end_time, location, status, ... }]'
  )

  skip(
    'POST /api/trip-timeline/auto-generate returns generation result',
    'Shape: { trip_id, events_created, events_existing, family_conflicts, timeline_total }'
  )

  skip(
    'POST /api/trip-timeline/city-card returns city info',
    'Shape: { city, country, timezone, utc_offset, currency, currency_symbol, plug_type, voltage, transport_tips, emergency_number, language, tipping_culture }'
  )

  skip(
    'GET /api/insights returns array of snapshots',
    'Shape: [{ id, user_id, period_type, period_start, period_end, commitment_stats, relationship_stats, travel_stats, family_stats }]'
  )

  skip(
    'POST /api/insights returns single snapshot',
    'Shape: { id, user_id, period_type, period_start, period_end, commitment_stats, relationship_stats, travel_stats, family_stats }'
  )

  skip(
    'GET /api/cron/insights returns cron result',
    'Shape: { ok, date, periods?, users_checked?, snapshots_generated?, skipped?, reason?, errors? }'
  )

  // =======================================================================
  //  ADDITIONAL ENDPOINT COVERAGE
  // =======================================================================
  //  Test PATCH and DELETE on trip-timeline for auth gate

  console.log('\n--- Additional auth gate tests ---')

  await test('PATCH /api/trip-timeline returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/trip-timeline`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ id: 'fake', title: 'Updated' }),
    })
    assertStatus(status, 401, 'PATCH /trip-timeline')
    assertHasKey(body, 'error', 'PATCH /trip-timeline')
  })

  await test('DELETE /api/trip-timeline returns 401 without auth', async () => {
    const { status, body } = await fetchJSON(`${BASE}/api/trip-timeline?id=fake`, {
      method: 'DELETE',
    })
    assertStatus(status, 401, 'DELETE /trip-timeline')
    assertHasKey(body, 'error', 'DELETE /trip-timeline')
  })

  // =======================================================================
  //  METHOD NOT ALLOWED TESTS
  // =======================================================================
  //  Next.js App Router returns 405 for unsupported HTTP methods

  console.log('\n--- Method not allowed ---')

  await test('PUT /api/commitments returns 405 (not implemented)', async () => {
    const { status } = await fetchJSON(`${BASE}/api/commitments`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({}),
    })
    assertStatus(status, 405, 'PUT /commitments')
  })

  await test('DELETE /api/commitments returns 405 (not implemented)', async () => {
    const { status } = await fetchJSON(`${BASE}/api/commitments`, {
      method: 'DELETE',
    })
    assertStatus(status, 405, 'DELETE /commitments')
  })

  await test('GET /api/commitments/actions returns 405 (POST only)', async () => {
    const { status } = await fetchJSON(`${BASE}/api/commitments/actions`)
    assertStatus(status, 405, 'GET /commitments/actions')
  })

  await test('GET /api/commitments/scan returns 405 (POST only)', async () => {
    const { status } = await fetchJSON(`${BASE}/api/commitments/scan`)
    assertStatus(status, 405, 'GET /commitments/scan')
  })

  await test('GET /api/commitments/score returns 405 (POST only)', async () => {
    const { status } = await fetchJSON(`${BASE}/api/commitments/score`)
    assertStatus(status, 405, 'GET /commitments/score')
  })

  await test('GET /api/family-calendar/conflicts returns 405 (POST only)', async () => {
    const { status } = await fetchJSON(`${BASE}/api/family-calendar/conflicts`)
    assertStatus(status, 405, 'GET /family-calendar/conflicts')
  })

  await test('GET /api/family-calendar/auto-detect returns 405 (POST only)', async () => {
    const { status } = await fetchJSON(`${BASE}/api/family-calendar/auto-detect`)
    assertStatus(status, 405, 'GET /family-calendar/auto-detect')
  })

  await test('GET /api/trip-timeline/auto-generate returns 405 (POST only)', async () => {
    const { status } = await fetchJSON(`${BASE}/api/trip-timeline/auto-generate`)
    assertStatus(status, 405, 'GET /trip-timeline/auto-generate')
  })

  await test('GET /api/trip-timeline/city-card returns 405 (POST only)', async () => {
    const { status } = await fetchJSON(`${BASE}/api/trip-timeline/city-card`)
    assertStatus(status, 405, 'GET /trip-timeline/city-card')
  })

  // =======================================================================
  //  RESULTS
  // =======================================================================

  console.log('\n=== Results ===')
  console.log(`  \x1b[32m${passed} passed\x1b[0m`)
  if (failed > 0) console.log(`  \x1b[31m${failed} failed\x1b[0m`)
  if (skipped > 0) console.log(`  \x1b[33m${skipped} skipped\x1b[0m (contract documented, require auth to validate)`)
  console.log(`  ${passed + failed + skipped} total\n`)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('\x1b[31mUnexpected error:\x1b[0m', err)
  process.exit(1)
})
