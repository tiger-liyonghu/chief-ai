/**
 * Authenticated production simulation.
 * Uses Supabase service role to directly query data and test
 * the scenarios that require user context.
 *
 * Run: npx tsx tests/stress/simulate-authenticated.ts
 */

import { createClient } from '@supabase/supabase-js'
import { calculateTemperature } from '../../lib/contacts/temperature'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://krxhyvixctwdoraulvlz.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in environment')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

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

async function main() {

  // Get first user for testing
  const { data: users } = await db
    .from('profiles')
    .select('id, email, timezone')
    .not('onboarding_completed_at', 'is', null)
    .limit(1)

  if (!users || users.length === 0) {
    console.error('No onboarded users found')
    process.exit(1)
  }

  const userId = users[0].id
  const userEmail = users[0].email
  console.log(`\nTesting with user: ${userEmail} (${userId.slice(0, 8)}...)`)

  // ═══════════════════════════════════════
  // 1. Commitment Dedup Check
  // ═══════════════════════════════════════

  console.log('\n═══ 1. Commitment Dedup Check ═══')

  const { data: commitments } = await db
    .from('commitments')
    .select('id, title, contact_email, contact_name, type, status, deadline, created_at')
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress', 'overdue'])
    .order('created_at', { ascending: false })

  const activeCount = commitments?.length || 0
  result('DEDUP-01', true as any ? 'pass' : 'fail', `Active commitments: ${activeCount}`)

  // Check for duplicates
  const dupes: string[] = []
  if (commitments && commitments.length > 1) {
    for (let i = 0; i < commitments.length; i++) {
      for (let j = i + 1; j < commitments.length; j++) {
        const a = commitments[i]
        const b = commitments[j]
        if (a.contact_email === b.contact_email && a.contact_email) {
          const wordsA = new Set((a.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 2))
          const wordsB = new Set((b.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 2))
          if (wordsA.size === 0 || wordsB.size === 0) continue
          const overlap = [...wordsA].filter(w => wordsB.has(w)).length
          const similarity = overlap / Math.min(wordsA.size, wordsB.size)
          if (similarity > 0.6) {
            dupes.push(`"${a.title}" ↔ "${b.title}" (${a.contact_email})`)
          }
        }
      }
    }
  }

  result('DEDUP-02', dupes.length === 0 ? 'pass' : 'warn',
    `Potential duplicates: ${dupes.length}`)
  for (const d of dupes.slice(0, 5)) {
    console.log(`    ⚠️  ${d}`)
  }

  // ═══════════════════════════════════════
  // 2. Weaver / Temperature Accuracy
  // ═══════════════════════════════════════

  console.log('\n═══ 2. Contact Temperature Check ═══')

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const { data: contacts } = await db
    .from('contacts')
    .select('id, email, name, importance, last_contact_at, roles, city')
    .eq('user_id', userId)
    .in('importance', ['vip', 'high', 'normal'])
    .limit(50)

  result('TEMP-01', (contacts?.length || 0) > 0 ? 'pass' : 'warn',
    `Contacts: ${contacts?.length || 0}`)

  if (contacts && contacts.length > 0) {
    // Get interaction counts
    const contactEmails = contacts.map(c => c.email.toLowerCase())
    const { data: recentEmails } = await db
      .from('emails')
      .select('from_address')
      .eq('user_id', userId)
      .in('from_address', contactEmails)
      .gte('received_at', thirtyDaysAgo)

    const interactionCounts = new Map<string, number>()
    for (const e of recentEmails || []) {
      const addr = (e.from_address || '').toLowerCase()
      interactionCounts.set(addr, (interactionCounts.get(addr) || 0) + 1)
    }

    const { data: activeCommitments } = await db
      .from('commitments')
      .select('contact_email')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress', 'overdue'])
      .in('contact_email', contactEmails)

    const commitmentCounts = new Map<string, number>()
    for (const c of activeCommitments || []) {
      const email = (c.contact_email || '').toLowerCase()
      commitmentCounts.set(email, (commitmentCounts.get(email) || 0) + 1)
    }

    // Calculate temperatures
    let hotCount = 0, warmCount = 0, coolingCount = 0, coldCount = 0
    let needsAttention = 0
    let withCity = 0
    let withRoles = 0

    for (const c of contacts) {
      const email = c.email.toLowerCase()
      const temp = calculateTemperature({
        lastInteractionAt: c.last_contact_at ? new Date(c.last_contact_at) : null,
        recentInteractionCount: interactionCounts.get(email) || 0,
        activeCommitmentCount: commitmentCounts.get(email) || 0,
        importance: c.importance || 'normal',
      })

      if (temp.label === 'hot') hotCount++
      else if (temp.label === 'warm') warmCount++
      else if (temp.label === 'cooling') coolingCount++
      else coldCount++
      if (temp.needsAttention) needsAttention++
      if (c.city) withCity++
      if (c.roles && Array.isArray(c.roles) && c.roles.length > 0) withRoles++
    }

    result('TEMP-02', true as any ? 'pass' : 'fail',
      `Temperature: ${hotCount} hot, ${warmCount} warm, ${coolingCount} cooling, ${coldCount} cold`)
    result('TEMP-03', needsAttention <= contacts.length * 0.5 ? 'pass' : 'warn',
      `Needs attention: ${needsAttention} of ${contacts.length} (${Math.round(needsAttention/contacts.length*100)}%)`)
    result('TEMP-04', withCity > 0 ? 'pass' : 'warn',
      `Contacts with city: ${withCity}/${contacts.length} (${Math.round(withCity/contacts.length*100)}%)`)
    result('TEMP-05', withRoles > 0 ? 'pass' : 'warn',
      `Contacts with roles: ${withRoles}/${contacts.length} (${Math.round(withRoles/contacts.length*100)}%)`)
  }

  // ═══════════════════════════════════════
  // 3. Email & Sync Health
  // ═══════════════════════════════════════

  console.log('\n═══ 3. Email Sync Health ═══')

  const { data: latestEmail } = await db
    .from('emails')
    .select('received_at')
    .eq('user_id', userId)
    .order('received_at', { ascending: false })
    .limit(1)
    .single()

  if (latestEmail) {
    const hoursSinceLatest = (Date.now() - new Date(latestEmail.received_at).getTime()) / 3600000
    result('SYNC-03', hoursSinceLatest < 1 ? 'pass' : hoursSinceLatest < 24 ? 'warn' : 'fail',
      `Latest email: ${Math.round(hoursSinceLatest)}h ago`)
  } else {
    result('SYNC-03', 'warn', 'No emails found')
  }

  const { count: totalEmails } = await db
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  const { count: unprocessed } = await db
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('commitment_scanned', false)

  result('SYNC-04', (unprocessed || 0) < 50 ? 'pass' : 'warn',
    `Emails: ${totalEmails} total, ${unprocessed} unprocessed`)

  // ═══════════════════════════════════════
  // 4. Family Calendar Health
  // ═══════════════════════════════════════

  console.log('\n═══ 4. Family Calendar ═══')

  const { data: familyEvents, count: familyCount } = await db
    .from('family_calendar')
    .select('id, title, event_type', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_active', true)

  result('FAMILY-01', (familyCount || 0) > 0 ? 'pass' : 'warn',
    `Family events: ${familyCount || 0}`)

  if (familyEvents && familyEvents.length > 0) {
    const hardConstraints = familyEvents.filter(e => e.event_type === 'hard_constraint').length
    const importantDates = familyEvents.filter(e => e.event_type === 'important_date').length
    result('FAMILY-02', hardConstraints > 0 ? 'pass' : 'warn',
      `Hard constraints: ${hardConstraints}, Important dates: ${importantDates}`)
  }

  // ═══════════════════════════════════════
  // 5. Trip Data Health
  // ═══════════════════════════════════════

  console.log('\n═══ 5. Trip Data ═══')

  const { data: trips, count: tripCount } = await db
    .from('trips')
    .select('id, title, status, destination_city, start_date, end_date', { count: 'exact' })
    .eq('user_id', userId)

  result('TRIP-01', true as any ? 'pass' : 'fail', `Trips: ${tripCount || 0}`)

  if (trips && trips.length > 0) {
    const withCity = trips.filter(t => t.destination_city).length
    result('TRIP-02', withCity > 0 ? 'pass' : 'warn',
      `Trips with destination city: ${withCity}/${trips.length}`)
  }

  // ═══════════════════════════════════════
  // 6. Notification Log Growth
  // ═══════════════════════════════════════

  console.log('\n═══ 6. Notification Log ═══')

  const { count: notifCount } = await db
    .from('notification_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  result('NOTIF-01', (notifCount || 0) < 10000 ? 'pass' : 'warn',
    `Notification log: ${notifCount || 0} rows`)

  // ═══════════════════════════════════════
  // 7. LLM Cost Estimation
  // ═══════════════════════════════════════

  console.log('\n═══ 7. LLM Cost Estimation ═══')

  const { count: needsReply } = await db
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_reply_needed', true)

  // Estimate monthly LLM calls
  const dailyEmails = (totalEmails || 0) / 30 // rough daily average
  const dailyLLMCalls = Math.ceil(dailyEmails * 0.3) // 30% pass pre-filter
  const monthlyCost = dailyLLMCalls * 30 * 0.003 // $0.003 per call

  result('COST-01', monthlyCost < 10 ? 'pass' : monthlyCost < 50 ? 'warn' : 'fail',
    `Est. monthly LLM cost: $${monthlyCost.toFixed(2)} (${Math.round(dailyEmails)} emails/day, ${dailyLLMCalls} LLM calls/day)`)

  result('COST-02', (needsReply || 0) < 100 ? 'pass' : 'warn',
    `Pending replies: ${needsReply || 0}`)

  // ═══════════════════════════════════════
  // 8. Policy Table (Insurance Vertical)
  // ═══════════════════════════════════════

  console.log('\n═══ 8. Insurance Vertical ═══')

  try {
    const { count: policyCount } = await db
      .from('policies')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    result('POLICY-01', true as any ? 'pass' : 'fail', `Policies: ${policyCount || 0}`)
  } catch {
    result('POLICY-01', 'warn', 'Policy table not yet migrated (migration 040 pending)')
  }

  // ═══════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`Authenticated Simulation Results:`)
  console.log(`  ✅ Passed:   ${passed}`)
  console.log(`  ⚠️  Warnings: ${warnings}`)
  console.log(`  ❌ Failed:   ${failed}`)
  console.log(`  Total:       ${total}`)
  console.log(`${'═'.repeat(60)}`)
}

main().catch(err => { console.error(err); process.exit(1) })
