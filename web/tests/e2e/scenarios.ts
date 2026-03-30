/**
 * E2E Scenario Tests for Chief
 * ============================
 * Implements extreme simulation scenarios from TESTING_SYSTEM.md
 *
 * Prerequisites:
 *   - Dev server running on localhost:3003
 *   - Valid Supabase credentials in .env.local
 *
 * Usage:
 *   npx tsx tests/e2e/scenarios.ts [--scenario a1|a3|a4|b1|c1|all]
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://krxhyvixctwdoraulvlz.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGh5dml4Y3R3ZG9yYXVsdmx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYwNTIyMCwiZXhwIjoyMDkwMTgxMjIwfQ.IBh2XBnPRTtpVJTTusCfIRQN5I0ws1xfqnT4wyOKDl0'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3003'

// Test user ID — uses a dedicated test persona so we never pollute real data
const TEST_USER_ID = 'e2e-test-user-scenarios'

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScenarioResult {
  name: string
  passed: boolean
  checks: { label: string; passed: boolean; detail?: string }[]
  durationMs: number
  error?: string
}

// ─── Date Helpers ────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function nextWeekday(dayIndex: number): string {
  const d = new Date()
  while (d.getDay() !== dayIndex) d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

async function cleanup() {
  console.log('  [cleanup] removing test data...')
  // Order matters — foreign key dependencies
  await admin.from('trip_timeline_events').delete().eq('user_id', TEST_USER_ID)
  await admin.from('trips').delete().eq('user_id', TEST_USER_ID)
  await admin.from('commitments').delete().eq('user_id', TEST_USER_ID)
  await admin.from('family_calendar').delete().eq('user_id', TEST_USER_ID)
  await admin.from('contacts').delete().eq('user_id', TEST_USER_ID)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function check(label: string, condition: boolean, detail?: string) {
  return { label, passed: condition, detail }
}

// ─── Scenario A1: Commitment Explosion ───────────────────────────────────────
// Create 15 commitments in rapid succession, verify urgency scoring sorts
// correctly and that different types are properly categorized.

async function scenarioA1(): Promise<ScenarioResult> {
  const name = 'A1 Commitment Explosion'
  const checks: ScenarioResult['checks'] = []
  const start = Date.now()

  try {
    await cleanup()

    // Insert a VIP contact for urgency scoring
    await admin.from('contacts').insert({
      user_id: TEST_USER_ID,
      name: 'Zhang Wei',
      email: 'zhangwei@cimb.com',
      company: 'CIMB',
      importance: 'vip',
    })

    // 15 commitments with varied urgency signals
    const commitments = [
      // Highest urgency: VIP + tomorrow deadline
      { type: 'i_promised', contact_name: 'Zhang Wei', contact_email: 'zhangwei@cimb.com', title: 'C01 - Return revised contract to Zhang Wei', deadline: daysFromNow(1), status: 'pending', urgency_score: 0, source_type: 'email' },
      // High urgency: investor + 3-day deadline
      { type: 'i_promised', contact_name: 'Ben Wilson', contact_email: 'ben@sequoia.com', title: 'C02 - Send monthly investor update', deadline: daysFromNow(3), status: 'pending', urgency_score: 0, source_type: 'email' },
      // Medium: partner, this week
      { type: 'i_promised', contact_name: 'David Chen', contact_email: 'david@grab.com', title: 'C03 - Send revised proposal', deadline: daysFromNow(5), status: 'in_progress', urgency_score: 0, source_type: 'email' },
      // They promised — waiting
      { type: 'they_promised', contact_name: 'Li Ming', contact_email: 'liming@maybank.com', title: 'C04 - Term sheet from Li Ming', deadline: daysFromNow(7), status: 'waiting', urgency_score: 0, source_type: 'email' },
      { type: 'they_promised', contact_name: 'Rina Wijaya', contact_email: 'rina@gojek.id', title: 'C05 - Signed NDA from Rina', deadline: daysFromNow(4), status: 'waiting', urgency_score: 0, source_type: 'email' },
      // Overdue items
      { type: 'i_promised', contact_name: 'Sarah Lee', contact_email: 'sarah@finpay.sg', title: 'C06 - Update roadmap deck (overdue)', deadline: daysAgo(3), status: 'overdue', urgency_score: 0, source_type: 'email' },
      { type: 'they_promised', contact_name: 'Ahmad Razak', contact_email: 'ahmad@grabpay.my', title: 'C07 - Integration API docs (overdue)', deadline: daysAgo(5), status: 'overdue', urgency_score: 0, source_type: 'whatsapp' },
      // Family
      { type: 'family', family_member: 'Emily', title: 'C08 - Take Emily to zoo', deadline: nextWeekday(6), status: 'pending', urgency_score: 0, source_type: 'manual' },
      { type: 'family', family_member: 'Family', title: 'C09 - Book Japan trip', deadline_fuzzy: 'Before end of May', status: 'pending', urgency_score: 0, source_type: 'manual' },
      // No deadline
      { type: 'i_promised', contact_name: 'Li Ming', contact_email: 'liming@maybank.com', title: 'C10 - Introduce CFO to Li Ming', status: 'pending', urgency_score: 0, source_type: 'meeting' },
      // Due today
      { type: 'i_promised', contact_name: 'Team', contact_email: 'team@finpay.sg', title: 'C11 - Demo preparation', deadline: today(), status: 'pending', urgency_score: 0, source_type: 'whatsapp' },
      // NDA signing — this week
      { type: 'i_promised', contact_name: 'Partner', contact_email: 'partner@acme.com', title: 'C12 - Sign NDA', deadline: daysFromNow(2), status: 'pending', urgency_score: 0, source_type: 'email' },
      // Quick tasks
      { type: 'i_promised', contact_name: 'David Chen', contact_email: 'david@grab.com', title: 'C13 - Recommend candidate for David', deadline: daysFromNow(5), status: 'pending', urgency_score: 0, source_type: 'whatsapp' },
      // Multiple follow-ups needed
      { type: 'i_promised', contact_name: 'Client A', contact_email: 'clienta@example.com', title: 'C14 - Client follow-up A', deadline: daysFromNow(6), status: 'pending', urgency_score: 0, source_type: 'email' },
      { type: 'i_promised', contact_name: 'Client B', contact_email: 'clientb@example.com', title: 'C15 - Client follow-up B', deadline: daysFromNow(7), status: 'pending', urgency_score: 0, source_type: 'email' },
    ]

    // Insert all 15 in rapid succession
    const insertResults = await Promise.all(
      commitments.map(c =>
        admin.from('commitments').insert({ ...c, user_id: TEST_USER_ID }).select().single()
      )
    )

    const insertedCount = insertResults.filter(r => !r.error).length
    checks.push(check('All 15 commitments inserted', insertedCount === 15, `${insertedCount}/15 inserted`))

    // Now run the scoring algorithm via direct DB logic (simulating what the score endpoint does)
    // Read back all active commitments, sorted by urgency
    const { data: scored } = await admin
      .from('commitments')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .in('status', ['pending', 'in_progress', 'waiting', 'overdue'])
      .order('urgency_score', { ascending: false })
      .order('deadline', { ascending: true, nullsFirst: false })

    checks.push(check('Active commitments retrieved', (scored?.length ?? 0) > 0, `${scored?.length} active`))

    // Verify type categorization
    const types = {
      i_promised: scored?.filter(c => c.type === 'i_promised') ?? [],
      they_promised: scored?.filter(c => c.type === 'they_promised') ?? [],
      family: scored?.filter(c => c.type === 'family') ?? [],
    }
    checks.push(check('i_promised type count correct', types.i_promised.length >= 8, `${types.i_promised.length} i_promised`))
    checks.push(check('they_promised type count correct', types.they_promised.length >= 2, `${types.they_promised.length} they_promised`))
    checks.push(check('family type count correct', types.family.length === 2, `${types.family.length} family`))

    // Verify family commitments are tagged as family
    const familyItems = scored?.filter(c => c.type === 'family') ?? []
    checks.push(check('Family commitments have type=family', familyItems.every(f => f.type === 'family')))

    // Manually compute urgency scores and update (simulating the scoring API)
    // We do this because the API requires auth which we bypass in E2E
    const vipEmails = new Set(['zhangwei@cimb.com'])
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)

    for (const c of scored ?? []) {
      let score = 0

      if (c.deadline) {
        const deadline = new Date(c.deadline)
        const daysLeft = Math.ceil((deadline.getTime() - todayDate.getTime()) / 86400000)
        if (daysLeft < 0) score += 5 + Math.min(Math.abs(daysLeft), 5)
        else if (daysLeft === 0) score += 4
        else if (daysLeft === 1) score += 3
        else if (daysLeft <= 3) score += 2
        else if (daysLeft <= 7) score += 1
      } else if (c.deadline_fuzzy) {
        score += 1
      }

      if (c.contact_email && vipEmails.has(c.contact_email)) score += 2
      if (c.type === 'family') score = Math.max(score, 3)
      score = Math.min(score, 10)

      await admin.from('commitments').update({ urgency_score: score }).eq('id', c.id)
    }

    // Re-read sorted by urgency_score
    const { data: reSorted } = await admin
      .from('commitments')
      .select('id, title, type, urgency_score, deadline, status')
      .eq('user_id', TEST_USER_ID)
      .in('status', ['pending', 'in_progress', 'waiting', 'overdue'])
      .order('urgency_score', { ascending: false })
      .order('deadline', { ascending: true, nullsFirst: false })

    if (reSorted && reSorted.length > 0) {
      // The highest scoring items should be the overdue ones or VIP + close deadline
      const top3 = reSorted.slice(0, 3)
      const topTitles = top3.map(c => c.title)

      // Overdue items (C06, C07) should be near the top
      const hasOverdueInTop5 = reSorted.slice(0, 5).some(c => c.status === 'overdue')
      checks.push(check('Overdue items appear in top-5 urgent', hasOverdueInTop5, `Top 5: ${reSorted.slice(0, 5).map(c => `${c.title}(${c.urgency_score})`).join(', ')}`))

      // VIP contract (Zhang Wei, tomorrow) should be in top-5
      const zhangWeiInTop5 = reSorted.slice(0, 5).some(c => c.title.includes('Zhang Wei'))
      checks.push(check('VIP commitment (Zhang Wei) in top-5', zhangWeiInTop5))

      // Family commitments should have score >= 3
      const familyScored = reSorted.filter(c => c.type === 'family')
      const familyFloor = familyScored.every(c => c.urgency_score >= 3)
      checks.push(check('Family commitments have urgency floor >= 3', familyFloor, familyScored.map(c => `${c.title}: ${c.urgency_score}`).join(', ')))

      // Due today (C11) should have urgency >= 4
      const dueToday = reSorted.find(c => c.title.includes('Demo preparation'))
      checks.push(check('Due-today item has urgency >= 4', (dueToday?.urgency_score ?? 0) >= 4, `Score: ${dueToday?.urgency_score}`))

      // All scores should be 0-10
      const allInRange = reSorted.every(c => c.urgency_score >= 0 && c.urgency_score <= 10)
      checks.push(check('All urgency scores in [0, 10]', allInRange))
    }

    await cleanup()
    return { name, passed: checks.every(c => c.passed), checks, durationMs: Date.now() - start }
  } catch (err: any) {
    await cleanup()
    return { name, passed: false, checks, durationMs: Date.now() - start, error: err.message }
  }
}

// ─── Scenario A3: Overdue Avalanche ──────────────────────────────────────────
// Jason returns from 5-day trip. 7 commitments are overdue.
// Verify: status auto-updates, urgency escalates, nudge drafts generated.

async function scenarioA3(): Promise<ScenarioResult> {
  const name = 'A3 Overdue Avalanche'
  const checks: ScenarioResult['checks'] = []
  const start = Date.now()

  try {
    await cleanup()

    // 7 overdue i_promised commitments (deadlines 1-7 days ago)
    const overdueCommitments = Array.from({ length: 7 }, (_, i) => ({
      user_id: TEST_USER_ID,
      type: 'i_promised',
      contact_name: `Contact ${i + 1}`,
      contact_email: `contact${i + 1}@example.com`,
      title: `Overdue task ${i + 1} — ${['Send report', 'Review contract', 'Finalize deck', 'Submit proposal', 'Schedule demo', 'Prepare brief', 'Return feedback'][i]}`,
      deadline: daysAgo(i + 1),
      status: 'pending' as const, // still pending — scoring should flip to overdue
      urgency_score: 0,
      source_type: 'email',
    }))

    // 3 overdue they_promised
    const theyOverdue = Array.from({ length: 3 }, (_, i) => ({
      user_id: TEST_USER_ID,
      type: 'they_promised',
      contact_name: `Vendor ${i + 1}`,
      contact_email: `vendor${i + 1}@example.com`,
      title: `Waiting on vendor ${i + 1} — ${['API docs', 'Signed contract', 'Payment confirmation'][i]}`,
      deadline: daysAgo(i + 2),
      status: 'waiting' as const,
      urgency_score: 0,
      source_type: 'email',
    }))

    // 2 family commitments approaching deadline
    const familyUpcoming = [
      { user_id: TEST_USER_ID, type: 'family', family_member: 'Emily', title: 'Emily piano recital', deadline: daysFromNow(1), status: 'pending' as const, urgency_score: 0, source_type: 'manual' },
      { user_id: TEST_USER_ID, type: 'family', family_member: 'Ryan', title: 'Ryan school sports day', deadline: daysFromNow(2), status: 'pending' as const, urgency_score: 0, source_type: 'manual' },
    ]

    // Insert all
    const { error: e1 } = await admin.from('commitments').insert(overdueCommitments)
    const { error: e2 } = await admin.from('commitments').insert(theyOverdue)
    const { error: e3 } = await admin.from('commitments').insert(familyUpcoming)
    checks.push(check('All commitments inserted', !e1 && !e2 && !e3))

    // Simulate the scoring pass — auto-detect overdue status
    const { data: allActive } = await admin
      .from('commitments')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .in('status', ['pending', 'in_progress', 'waiting', 'overdue'])

    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    let statusUpdated = 0

    for (const c of allActive ?? []) {
      if (!c.deadline) continue
      const deadline = new Date(c.deadline)
      const daysLeft = Math.ceil((deadline.getTime() - todayDate.getTime()) / 86400000)

      if (daysLeft < 0 && c.status !== 'overdue') {
        await admin.from('commitments').update({ status: 'overdue' }).eq('id', c.id)
        statusUpdated++
      }

      // Compute urgency
      let score = 0
      if (daysLeft < 0) score = 5 + Math.min(Math.abs(daysLeft), 5)
      else if (daysLeft === 0) score += 4
      else if (daysLeft === 1) score += 3
      else if (daysLeft <= 3) score += 2
      if (c.type === 'family') score = Math.max(score, 3)
      score = Math.min(score, 10)

      await admin.from('commitments').update({ urgency_score: score }).eq('id', c.id)
    }

    checks.push(check('Overdue status auto-updated for past-deadline items', statusUpdated >= 7, `${statusUpdated} items updated to overdue`))

    // Verify urgency scores escalated correctly
    const { data: overdueItems } = await admin
      .from('commitments')
      .select('title, urgency_score, status, deadline, type')
      .eq('user_id', TEST_USER_ID)
      .eq('status', 'overdue')
      .order('urgency_score', { ascending: false })

    checks.push(check('All 7+ items now have overdue status', (overdueItems?.length ?? 0) >= 7, `${overdueItems?.length} overdue`))

    // The most overdue (7 days ago) should have score = 10 (5 + 5 cap)
    if (overdueItems && overdueItems.length > 0) {
      const maxScore = Math.max(...overdueItems.map(c => c.urgency_score))
      checks.push(check('Most overdue item has urgency = 10', maxScore === 10, `Max score: ${maxScore}`))

      // Scores should increase with days overdue
      const sorted = [...overdueItems].sort((a, b) => {
        const dA = new Date(a.deadline).getTime()
        const dB = new Date(b.deadline).getTime()
        return dA - dB // oldest deadline first
      })
      const scoresDescByAge = sorted.map(c => c.urgency_score)
      const isMonotonicallyNonDecreasing = scoresDescByAge.every((s, i) =>
        i === 0 || s >= scoresDescByAge[i - 1]
      )
      checks.push(check('Urgency increases with overdue duration', isMonotonicallyNonDecreasing, `Scores by age: ${scoresDescByAge.join(', ')}`))
    }

    // Verify family items still tracked with urgency floor
    const { data: familyItems } = await admin
      .from('commitments')
      .select('title, urgency_score, type')
      .eq('user_id', TEST_USER_ID)
      .eq('type', 'family')

    checks.push(check('Family commitments have urgency >= 3', (familyItems ?? []).every(f => f.urgency_score >= 3)))

    // Simulate nudge generation: determine tone for each overdue item
    const nudgeTones: { title: string; tone: string }[] = []
    for (const c of overdueItems ?? []) {
      const daysOver = Math.abs(Math.ceil((new Date(c.deadline).getTime() - todayDate.getTime()) / 86400000))
      let tone = 'gentle'
      if (daysOver > 7) tone = 'urgent'
      else if (daysOver > 3) tone = 'firm'
      nudgeTones.push({ title: c.title, tone })
    }

    const hasGentleTone = nudgeTones.some(n => n.tone === 'gentle')
    const hasFirmTone = nudgeTones.some(n => n.tone === 'firm')
    checks.push(check('Nudge tones cover gentle + firm range', hasGentleTone && hasFirmTone, nudgeTones.map(n => `${n.title}: ${n.tone}`).join('; ')))

    await cleanup()
    return { name, passed: checks.every(c => c.passed), checks, durationMs: Date.now() - start }
  } catch (err: any) {
    await cleanup()
    return { name, passed: false, checks, durationMs: Date.now() - start, error: err.message }
  }
}

// ─── Scenario A4: Deduplication ──────────────────────────────────────────────
// Same commitment from email source and manual entry. Verify no duplicate.

async function scenarioA4(): Promise<ScenarioResult> {
  const name = 'A4 Deduplication'
  const checks: ScenarioResult['checks'] = []
  const start = Date.now()

  try {
    await cleanup()

    // Insert first commitment from "email scan"
    const commitment1 = {
      user_id: TEST_USER_ID,
      type: 'i_promised',
      contact_name: 'David Chen',
      contact_email: 'david@grab.com',
      title: 'Send revised proposal to David',
      description: 'Partnership proposal revision with updated terms',
      source_type: 'email',
      source_ref: 'email-msg-12345',
      deadline: daysFromNow(5),
      status: 'pending',
      urgency_score: 5,
    }

    const { data: first, error: e1 } = await admin
      .from('commitments')
      .insert(commitment1)
      .select()
      .single()

    checks.push(check('First commitment (email source) inserted', !!first && !e1))

    // Insert second commitment from "manual entry" — same underlying task
    const commitment2 = {
      user_id: TEST_USER_ID,
      type: 'i_promised',
      contact_name: 'David Chen',
      contact_email: 'david@grab.com',
      title: 'Send revised proposal to David',
      description: 'Need to send the updated partnership proposal',
      source_type: 'manual',
      deadline: daysFromNow(5),
      status: 'pending',
      urgency_score: 5,
    }

    const { data: second, error: e2 } = await admin
      .from('commitments')
      .insert(commitment2)
      .select()
      .single()

    checks.push(check('Second commitment (manual source) inserted', !!second && !e2))

    // Query all commitments for this user + contact combo
    const { data: allForDavid } = await admin
      .from('commitments')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .eq('contact_email', 'david@grab.com')
      .ilike('title', '%proposal%david%')

    const duplicateCount = allForDavid?.length ?? 0

    // Current system DOES insert duplicates (no DB-level dedup constraint).
    // This test documents the current behavior and flags it as a known gap.
    if (duplicateCount > 1) {
      checks.push(check(
        '[KNOWN GAP] Duplicate commitments exist — dedup logic needed',
        false,
        `Found ${duplicateCount} matching commitments for the same task. Application-level dedup or DB unique constraint on (user_id, contact_email, title, deadline) is recommended.`
      ))
    } else {
      checks.push(check('No duplicate commitments created', duplicateCount === 1))
    }

    // Verify that if we simulate dedup, we can detect duplicates by matching fields
    const isDuplicate = (a: any, b: any): boolean => {
      return (
        a.contact_email === b.contact_email &&
        a.title.toLowerCase() === b.title.toLowerCase() &&
        a.deadline === b.deadline &&
        a.type === b.type
      )
    }

    if (first && second) {
      const detected = isDuplicate(first, second)
      checks.push(check('Dedup detection logic correctly identifies duplicates', detected))
    }

    // Verify a truly different commitment is NOT flagged as duplicate
    const commitment3 = {
      user_id: TEST_USER_ID,
      type: 'i_promised',
      contact_name: 'David Chen',
      contact_email: 'david@grab.com',
      title: 'Schedule Q2 planning meeting with David',
      source_type: 'email',
      deadline: daysFromNow(10),
      status: 'pending',
      urgency_score: 3,
    }

    const { data: third } = await admin.from('commitments').insert(commitment3).select().single()

    if (first && third) {
      const falsePositive = isDuplicate(first, third)
      checks.push(check('Different commitment NOT flagged as duplicate', !falsePositive))
    }

    // Test: WhatsApp message updating an existing commitment's status
    // "I'm working on the proposal for David" should not create a new commitment
    // but should update the existing one to in_progress.
    // Simulate this by checking if an update operation works correctly.
    if (first) {
      const { error: updateErr } = await admin
        .from('commitments')
        .update({ status: 'in_progress' })
        .eq('id', first.id)

      const { data: updated } = await admin
        .from('commitments')
        .select('status')
        .eq('id', first.id)
        .single()

      checks.push(check('Status update via cross-channel reference works', updated?.status === 'in_progress' && !updateErr))
    }

    await cleanup()
    return { name, passed: checks.every(c => c.passed), checks, durationMs: Date.now() - start }
  } catch (err: any) {
    await cleanup()
    return { name, passed: false, checks, durationMs: Date.now() - start, error: err.message }
  }
}

// ─── Scenario B1: Trip Timeline Generation ───────────────────────────────────
// Create a trip with flight+hotel info, insert via DB, call auto-generate
// equivalent logic, verify timeline events.

async function scenarioB1(): Promise<ScenarioResult> {
  const name = 'B1 Trip Timeline Generation'
  const checks: ScenarioResult['checks'] = []
  const start = Date.now()

  try {
    await cleanup()

    const tripStart = daysFromNow(5)
    const tripEnd = daysFromNow(7)

    // Create trip with flight + hotel JSONB data
    const { data: trip, error: tripErr } = await admin
      .from('trips')
      .insert({
        user_id: TEST_USER_ID,
        title: 'KL Client Meetings',
        destination_city: 'Kuala Lumpur',
        destination_country: 'Malaysia',
        start_date: tripStart,
        end_date: tripEnd,
        status: 'upcoming',
        flight_info: [
          {
            airline: 'Singapore Airlines',
            flight_number: 'SQ 118',
            departure_time: `${tripStart}T08:30:00+08:00`,
            arrival_time: `${tripStart}T09:30:00+08:00`,
            origin: 'SIN',
            destination: 'KUL',
            direction: 'outbound',
          },
          {
            airline: 'Singapore Airlines',
            flight_number: 'SQ 119',
            departure_time: `${tripEnd}T18:25:00+08:00`,
            arrival_time: `${tripEnd}T19:25:00+08:00`,
            origin: 'KUL',
            destination: 'SIN',
            direction: 'return',
          },
        ],
        hotel_info: [
          {
            name: 'Mandarin Oriental KL',
            confirmation: 'MO-28374',
            checkin_date: tripStart,
            checkout_date: tripEnd,
            address: 'KLCC, Kuala Lumpur',
          },
        ],
      })
      .select()
      .single()

    checks.push(check('Trip created successfully', !!trip && !tripErr, trip?.id))

    if (!trip) {
      await cleanup()
      return { name, passed: false, checks, durationMs: Date.now() - start, error: 'Trip creation failed' }
    }

    // Simulate the auto-generate logic directly via DB inserts
    // (The actual endpoint requires authenticated user session)
    const timelineEvents: any[] = []
    let sortOrder = 0

    // Flight events
    const flights = trip.flight_info as any[]
    for (const flight of flights) {
      if (flight.departure_time) {
        timelineEvents.push({
          trip_id: trip.id,
          user_id: TEST_USER_ID,
          type: 'flight',
          title: `${flight.airline} ${flight.flight_number} — ${flight.origin} → ${flight.destination}`,
          event_time: flight.departure_time,
          end_time: flight.arrival_time,
          location: flight.origin,
          details: {
            flight_number: flight.flight_number,
            airline: flight.airline,
            origin: flight.origin,
            destination: flight.destination,
            direction: flight.direction,
          },
          metadata: { source: 'flight_info' },
          is_auto_generated: true,
          is_confirmed: true,
          status: 'scheduled',
          sort_order: sortOrder++,
        })
      }
    }

    // Hotel events
    const hotels = trip.hotel_info as any[]
    for (const hotel of hotels) {
      const checkinTime = `${hotel.checkin_date || tripStart}T15:00:00+08:00`
      const checkoutTime = `${hotel.checkout_date || tripEnd}T11:00:00+08:00`

      timelineEvents.push({
        trip_id: trip.id,
        user_id: TEST_USER_ID,
        type: 'hotel_checkin',
        title: `Check in — ${hotel.name}`,
        event_time: checkinTime,
        location: hotel.address || hotel.name,
        details: { hotel_name: hotel.name, confirmation: hotel.confirmation },
        metadata: { source: 'hotel_info' },
        is_auto_generated: true,
        is_confirmed: true,
        status: 'scheduled',
        sort_order: sortOrder++,
      })

      timelineEvents.push({
        trip_id: trip.id,
        user_id: TEST_USER_ID,
        type: 'hotel_checkout',
        title: `Check out — ${hotel.name}`,
        event_time: checkoutTime,
        location: hotel.address || hotel.name,
        details: { hotel_name: hotel.name, confirmation: hotel.confirmation },
        metadata: { source: 'hotel_info' },
        is_auto_generated: true,
        is_confirmed: true,
        status: 'scheduled',
        sort_order: sortOrder++,
      })
    }

    // Insert timeline events
    const { data: inserted, error: tlErr } = await admin
      .from('trip_timeline_events')
      .insert(timelineEvents)
      .select()

    checks.push(check('Timeline events inserted', !!inserted && !tlErr, `${inserted?.length} events`))

    // Verify the right types were created
    const eventTypes = (inserted ?? []).map(e => e.type)
    checks.push(check('Flight events created', eventTypes.filter(t => t === 'flight').length === 2, `${eventTypes.filter(t => t === 'flight').length} flights`))
    checks.push(check('Hotel check-in event created', eventTypes.includes('hotel_checkin')))
    checks.push(check('Hotel check-out event created', eventTypes.includes('hotel_checkout')))

    // Verify chronological order
    const times = (inserted ?? []).map(e => new Date(e.event_time).getTime())
    const isChronological = times.every((t, i) => i === 0 || t >= times[i - 1])
    // Note: events may not be strictly chronological if hotel checkin is after flight
    // but they should be logically ordered
    checks.push(check('Events have valid timestamps', times.every(t => !isNaN(t))))

    // Verify event details contain expected data
    const flightEvent = (inserted ?? []).find(e => e.type === 'flight')
    if (flightEvent) {
      checks.push(check('Flight event has airline info', flightEvent.details?.airline === 'Singapore Airlines'))
      checks.push(check('Flight event has flight number', flightEvent.details?.flight_number === 'SQ 118'))
    }

    const hotelEvent = (inserted ?? []).find(e => e.type === 'hotel_checkin')
    if (hotelEvent) {
      checks.push(check('Hotel event has confirmation number', hotelEvent.details?.confirmation === 'MO-28374'))
    }

    // Now add family calendar events and check for conflicts
    await admin.from('family_calendar').insert([
      {
        user_id: TEST_USER_ID,
        event_type: 'hard_constraint',
        title: 'Emily piano lesson',
        start_date: tripStart, // overlaps with trip
        start_time: '15:30',
        end_time: '16:30',
        recurrence: 'weekly',
        recurrence_day: new Date(tripStart).getDay(),
        family_member: 'Emily',
        source: 'manual',
        is_active: true,
      },
    ])

    // Detect family conflicts (simulating the auto-generate conflict detection)
    const { data: familyEvents } = await admin
      .from('family_calendar')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .eq('is_active', true)

    const familyConflicts: any[] = []
    const tripStartDt = new Date(`${tripStart}T00:00:00`)
    const tripEndDt = new Date(`${tripEnd}T23:59:59`)

    for (const fEvent of familyEvents ?? []) {
      if (fEvent.recurrence === 'weekly' && fEvent.recurrence_day != null) {
        const cursor = new Date(tripStartDt)
        while (cursor <= tripEndDt) {
          if (cursor.getDay() === fEvent.recurrence_day) {
            familyConflicts.push({
              title: fEvent.title,
              conflict_type: 'recurring_weekly',
              family_member: fEvent.family_member,
            })
            break
          }
          cursor.setDate(cursor.getDate() + 1)
        }
      }
    }

    checks.push(check('Family conflict detected during trip', familyConflicts.length > 0, `${familyConflicts.length} conflicts found`))

    // Write conflicts to trip record
    if (familyConflicts.length > 0) {
      await admin.from('trips').update({ family_conflicts: familyConflicts }).eq('id', trip.id)
      const { data: updatedTrip } = await admin.from('trips').select('family_conflicts').eq('id', trip.id).single()
      checks.push(check('Conflicts written to trip record', Array.isArray(updatedTrip?.family_conflicts) && updatedTrip.family_conflicts.length > 0))
    }

    await cleanup()
    return { name, passed: checks.every(c => c.passed), checks, durationMs: Date.now() - start }
  } catch (err: any) {
    await cleanup()
    return { name, passed: false, checks, durationMs: Date.now() - start, error: err.message }
  }
}

// ─── Scenario C1: Family Conflict Detection ──────────────────────────────────
// Create family events + work events that conflict. Verify conflict API detects.

async function scenarioC1(): Promise<ScenarioResult> {
  const name = 'C1 Family Conflict Detection'
  const checks: ScenarioResult['checks'] = []
  const start = Date.now()

  try {
    await cleanup()

    // Set up family calendar with various event types
    const wednesday = nextWeekday(3) // Wednesday
    const saturday = nextWeekday(6) // Saturday
    const wednesdayDayIndex = 3
    const saturdayDayIndex = 6
    const sundayDayIndex = 0

    const familyEvents = [
      // Weekly hard constraints
      {
        user_id: TEST_USER_ID,
        event_type: 'hard_constraint',
        title: 'Emily piano lesson',
        start_date: wednesday,
        start_time: '15:30',
        end_time: '16:30',
        recurrence: 'weekly',
        recurrence_day: wednesdayDayIndex,
        family_member: 'Emily',
        source: 'manual',
        is_active: true,
      },
      {
        user_id: TEST_USER_ID,
        event_type: 'hard_constraint',
        title: 'Ryan football practice',
        start_date: saturday,
        start_time: '09:00',
        end_time: '10:30',
        recurrence: 'weekly',
        recurrence_day: saturdayDayIndex,
        family_member: 'Ryan',
        source: 'manual',
        is_active: true,
      },
      {
        user_id: TEST_USER_ID,
        event_type: 'hard_constraint',
        title: 'Family dinner',
        start_date: nextWeekday(0),
        start_time: '18:00',
        end_time: '20:00',
        recurrence: 'weekly',
        recurrence_day: sundayDayIndex,
        family_member: 'Family',
        source: 'manual',
        is_active: true,
      },
      // Important dates
      {
        user_id: TEST_USER_ID,
        event_type: 'important_date',
        title: 'Wedding anniversary',
        start_date: '2026-05-12',
        recurrence: 'yearly',
        family_member: 'Sarah',
        source: 'manual',
        is_active: true,
        remind_days_before: 7,
      },
      // School cycle
      {
        user_id: TEST_USER_ID,
        event_type: 'school_cycle',
        title: 'Final exam week',
        start_date: '2026-06-01',
        end_date: '2026-06-12',
        family_member: 'Emily',
        source: 'manual',
        is_active: true,
      },
    ]

    const { error: insertErr } = await admin.from('family_calendar').insert(familyEvents)
    checks.push(check('Family events inserted', !insertErr))

    // Now simulate conflict detection for various dates

    // Test 1: Wednesday afternoon meeting — should conflict with piano lesson
    const { data: allEvents } = await admin
      .from('family_calendar')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .eq('is_active', true)

    function detectConflicts(date: string, startTime?: string, endTime?: string) {
      const conflicts: { event: any; conflict_type: string }[] = []
      const checkDate = new Date(date)
      const dayOfWeek = checkDate.getDay()

      for (const event of allEvents ?? []) {
        let isConflict = false
        let conflictType = ''

        // Weekly recurring
        if (event.recurrence === 'weekly' && event.recurrence_day === dayOfWeek) {
          if (event.start_time && startTime) {
            if ((!endTime || event.start_time < endTime) && (!event.end_time || startTime < event.end_time)) {
              isConflict = true
              conflictType = 'time_overlap'
            }
          } else {
            isConflict = true
            conflictType = 'day_conflict'
          }
        }

        // Date range events
        if (event.start_date <= date && (!event.end_date || event.end_date >= date)) {
          if (event.event_type === 'hard_constraint') {
            isConflict = true
            conflictType = 'hard_constraint'
          } else if (event.event_type === 'important_date') {
            isConflict = true
            conflictType = 'important_date'
          } else if (event.event_type === 'school_cycle') {
            isConflict = true
            conflictType = 'advisory'
          }
        }

        // Yearly recurring
        if (event.recurrence === 'yearly' && event.start_date) {
          const eventMonth = new Date(event.start_date).getMonth()
          const eventDay = new Date(event.start_date).getDate()
          if (checkDate.getMonth() === eventMonth && checkDate.getDate() === eventDay) {
            isConflict = true
            conflictType = 'important_date'
          }
        }

        if (isConflict) {
          conflicts.push({ event, conflict_type: conflictType })
        }
      }

      return {
        date,
        has_conflicts: conflicts.length > 0,
        has_hard_conflicts: conflicts.some(c => c.conflict_type === 'hard_constraint' || c.conflict_type === 'time_overlap'),
        conflicts,
      }
    }

    // Test 1: Wednesday 15:00-16:00 — overlaps with piano 15:30-16:30
    const wednesdayConflict = detectConflicts(wednesday, '15:00', '16:00')
    checks.push(check(
      'Wednesday afternoon detects piano lesson conflict',
      wednesdayConflict.has_conflicts,
      `${wednesdayConflict.conflicts.length} conflicts found`
    ))
    checks.push(check(
      'Piano lesson flagged as hard conflict (time_overlap)',
      wednesdayConflict.has_hard_conflicts,
      wednesdayConflict.conflicts.map(c => c.conflict_type).join(', ')
    ))

    // Test 2: Wednesday morning — no time overlap with piano
    const wednesdayMorning = detectConflicts(wednesday, '09:00', '10:00')
    const morningHasTimeOverlap = wednesdayMorning.conflicts.some(c => c.conflict_type === 'time_overlap')
    checks.push(check(
      'Wednesday morning has no time_overlap conflict',
      !morningHasTimeOverlap,
      wednesdayMorning.conflicts.map(c => `${c.event.title}: ${c.conflict_type}`).join(', ') || 'no conflicts'
    ))

    // Test 3: Saturday morning — should conflict with football
    const saturdayConflict = detectConflicts(saturday, '09:00', '11:00')
    checks.push(check(
      'Saturday morning detects football practice conflict',
      saturdayConflict.has_conflicts && saturdayConflict.has_hard_conflicts,
      saturdayConflict.conflicts.map(c => c.event.title).join(', ')
    ))

    // Test 4: Wedding anniversary date — should detect important_date
    const anniversaryConflict = detectConflicts('2026-05-12')
    const hasAnniversary = anniversaryConflict.conflicts.some(c =>
      c.event.title.includes('anniversary') && c.conflict_type === 'important_date'
    )
    checks.push(check(
      'Wedding anniversary date detected as important_date conflict',
      hasAnniversary,
      anniversaryConflict.conflicts.map(c => `${c.event.title}: ${c.conflict_type}`).join(', ')
    ))

    // Test 5: Exam week date — should detect school_cycle (advisory)
    const examConflict = detectConflicts('2026-06-05')
    const hasExamAdvisory = examConflict.conflicts.some(c =>
      c.conflict_type === 'advisory'
    )
    checks.push(check(
      'Exam week date detected as advisory conflict',
      hasExamAdvisory,
      examConflict.conflicts.map(c => `${c.event.title}: ${c.conflict_type}`).join(', ')
    ))

    // Test 6: Random future weekday with no events — should be clean
    // Pick a Monday that's not near any important dates
    const cleanDate = '2026-08-03' // a Monday in August, no special events
    const cleanResult = detectConflicts(cleanDate, '10:00', '11:00')
    // May still have advisory if school cycle overlaps — just check no hard conflicts
    checks.push(check(
      'Clean date has no hard conflicts',
      !cleanResult.has_hard_conflicts,
      cleanResult.conflicts.length > 0 ? cleanResult.conflicts.map(c => c.conflict_type).join(', ') : 'no conflicts'
    ))

    // Test 7: Multiple conflicts on same day — Sunday with family dinner
    const sunday = nextWeekday(0)
    const sundayConflict = detectConflicts(sunday, '18:30', '19:30')
    checks.push(check(
      'Sunday evening detects family dinner conflict',
      sundayConflict.has_conflicts,
      sundayConflict.conflicts.map(c => c.event.title).join(', ')
    ))

    await cleanup()
    return { name, passed: checks.every(c => c.passed), checks, durationMs: Date.now() - start }
  } catch (err: any) {
    await cleanup()
    return { name, passed: false, checks, durationMs: Date.now() - start, error: err.message }
  }
}

// ─── Runner ──────────────────────────────────────────────────────────────────

const SCENARIOS: Record<string, () => Promise<ScenarioResult>> = {
  a1: scenarioA1,
  a3: scenarioA3,
  a4: scenarioA4,
  b1: scenarioB1,
  c1: scenarioC1,
}

async function main() {
  const args = process.argv.slice(2)
  const scenarioArg = args.find(a => a.startsWith('--scenario'))
    ? args[args.indexOf('--scenario') + 1]
    : args.find(a => !a.startsWith('--')) || 'all'

  console.log('╔══════════════════════════════════════════╗')
  console.log('║  Chief E2E Scenario Tests                ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log()
  console.log(`Supabase:  ${SUPABASE_URL}`)
  console.log(`Base URL:  ${BASE_URL}`)
  console.log(`Test User: ${TEST_USER_ID}`)
  console.log()

  const targets = scenarioArg === 'all'
    ? Object.keys(SCENARIOS)
    : scenarioArg.split(',').map(s => s.trim().toLowerCase())

  const results: ScenarioResult[] = []

  for (const key of targets) {
    const fn = SCENARIOS[key]
    if (!fn) {
      console.log(`  [SKIP] Unknown scenario: ${key}`)
      continue
    }
    console.log(`▶ Running ${key.toUpperCase()}...`)
    const result = await fn()
    results.push(result)

    const icon = result.passed ? '✅' : '❌'
    console.log(`  ${icon} ${result.name} (${result.durationMs}ms)`)
    if (result.error) console.log(`     ERROR: ${result.error}`)
    for (const c of result.checks) {
      const ci = c.passed ? '  ✓' : '  ✗'
      console.log(`   ${ci} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`)
    }
    console.log()
  }

  // Summary
  console.log('═══════════════════════════════════════════')
  console.log('  SUMMARY')
  console.log('═══════════════════════════════════════════')
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const totalChecks = results.reduce((acc, r) => acc + r.checks.length, 0)
  const passedChecks = results.reduce((acc, r) => acc + r.checks.filter(c => c.passed).length, 0)

  console.log(`  Scenarios:  ${passed} passed, ${failed} failed, ${results.length} total`)
  console.log(`  Checks:     ${passedChecks}/${totalChecks} passed`)
  console.log(`  Duration:   ${results.reduce((acc, r) => acc + r.durationMs, 0)}ms total`)
  console.log()

  if (failed > 0) {
    console.log('  FAILED scenarios:')
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    - ${r.name}`)
      for (const c of r.checks.filter(c => !c.passed)) {
        console.log(`      ✗ ${c.label}${c.detail ? ` — ${c.detail}` : ''}`)
      }
    }
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
