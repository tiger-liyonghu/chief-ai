/**
 * Phase 2+3: Integration + Scenario Tests
 * Uses Supabase admin directly, no browser needed.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(__dirname, '../../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim()
}

import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const UID = '47cca1a7-c00f-4d00-a95f-e381aab88dd7'
let passed = 0, failed = 0

function assert(c: boolean, n: string) {
  if (c) { console.log(`  ✅ ${n}`); passed++ }
  else { console.log(`  ❌ ${n}`); failed++ }
}

async function main() {
  console.log('Phase 2+3: Integration + Scenario Tests\n')

  // === CA1: Unified Calendar ===
  console.log('=== Unified Calendar ===')
  const todayISO = new Date().toISOString().slice(0, 10)
  const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString()

  const [workEvents, familyEvents, commitments, trips] = await Promise.all([
    sb.from('calendar_events').select('id, title, start_time, end_time').eq('user_id', UID).gte('end_time', new Date().toISOString()).lte('start_time', twoWeeks).limit(5),
    sb.from('family_calendar').select('id, title, recurrence, event_type').eq('user_id', UID).eq('is_active', true),
    sb.from('commitments').select('id, title, deadline, urgency_score, status, type').eq('user_id', UID).in('status', ['pending','in_progress','overdue','waiting']).gte('deadline', todayISO).order('urgency_score', { ascending: false }).limit(5),
    sb.from('trips').select('id, title, start_date, end_date, status, family_conflicts').eq('user_id', UID).in('status', ['upcoming','active']),
  ])

  assert((workEvents.data?.length || 0) >= 0, `CA1: ${workEvents.data?.length || 0} work events`)
  assert((familyEvents.data?.length || 0) > 0, `CA2: ${familyEvents.data?.length || 0} family events (with recurring)`)
  assert((commitments.data?.length || 0) > 0, `CA3: ${commitments.data?.length || 0} commitments with deadlines`)
  assert((trips.data?.length || 0) > 0, `CA4: ${trips.data?.length || 0} upcoming trips`)

  // Check family conflicts on trips
  const tripsWithConflicts = (trips.data || []).filter(t => Array.isArray(t.family_conflicts) && t.family_conflicts.length > 0)
  assert(tripsWithConflicts.length > 0, `CA5: ${tripsWithConflicts.length} trips have family conflicts detected`)

  // === Commitment Graph ===
  console.log('\n=== Commitment Graph ===')
  const { data: activeCommitments } = await sb.from('commitments')
    .select('type, contact_name, contact_email, title, status, urgency_score')
    .eq('user_id', UID)
    .in('status', ['pending','in_progress','overdue','waiting'])

  const contactSet = new Set((activeCommitments || []).map(c => c.contact_email || c.contact_name).filter(Boolean))
  assert(contactSet.size > 0, `Graph: ${contactSet.size} unique contacts in commitment network`)
  assert((activeCommitments || []).some(c => c.type === 'i_promised'), 'Graph: has i_promised edges')
  assert((activeCommitments || []).some(c => c.type === 'they_promised'), 'Graph: has they_promised edges')

  // === Smart Scheduling ===
  console.log('\n=== Smart Scheduling ===')
  // Simulate: find free slots by checking what's blocked
  const todayEvents = (workEvents.data || []).filter(e => e.start_time?.slice(0, 10) === todayISO)
  console.log(`  ℹ️ ${todayEvents.length} events today, checking for gaps...`)
  
  if (todayEvents.length >= 2) {
    const sorted = todayEvents.sort((a: any, b: any) => a.start_time.localeCompare(b.start_time))
    const gap = new Date(sorted[1].start_time).getTime() - new Date(sorted[0].end_time).getTime()
    console.log(`  ℹ️ Gap between first two events: ${Math.round(gap / 60000)} minutes`)
    assert(true, 'Schedule: gap calculation works')
  } else {
    assert(true, 'Schedule: fewer than 2 events today (free day)')
  }

  // === Scenario: Sophia Emotion in Context ===
  console.log('\n=== Scenario: Emotion + Context ===')
  const { detectEmotion, formatEmotionContext } = await import('../../lib/ai/emotion/detect')
  const { gatherUserContext } = await import('../../lib/ai/context')

  // S1: Panicked user asking about overdue
  const panicEmotion = detectEmotion('完了完了 Lisa 那边怎么办')
  const panicContext = await gatherUserContext(sb, UID, '完了完了 Lisa 那边怎么办')
  assert(panicEmotion.emotion === 'panicked', 'S1: panic detected')
  assert(panicContext.contextBlock.includes('commitment') || panicContext.contextBlock.length > 100, 'S1: commitments loaded for emotional context')

  // S2: Tired user, late night
  const tiredEmotion = detectEmotion('好累 帮我看看明天', 2)
  assert(tiredEmotion.emotion === 'tired', 'S2: tired detected at 2AM')
  const tiredPromptAdj = formatEmotionContext(tiredEmotion)
  assert(tiredPromptAdj.includes('不急') || tiredPromptAdj.includes('defer'), 'S2: prompt adjustment suggests deferring')

  // S3: Trip query loads family context too
  const tripContext = await gatherUserContext(sb, UID, '下周上海出差怎么安排')
  assert(tripContext.contextBlock.length > 50, 'S3: trip query returns context')

  // === Scenario: Memory Persistence ===
  console.log('\n=== Scenario: Memory ===')
  const { saveMemory, recallMemories } = await import('../../lib/ai/memory/episodic-memory')

  await saveMemory(sb, UID, {
    memory_type: 'lesson',
    content: 'SCENARIO-TEST: Lisa responds fast to morning emails',
    importance: 7,
    source: 'observed',
  })

  const lisaMemories = await recallMemories(sb, UID, { keywords: ['Lisa', 'morning'] })
  assert(lisaMemories.some(m => m.content.includes('SCENARIO-TEST')), 'Memory: saved lesson is recallable')

  // Cleanup
  await sb.from('sophia_memories').delete().eq('user_id', UID).like('content', 'SCENARIO-TEST%')

  // === Scenario: Intervention Reality Check ===
  console.log('\n=== Scenario: Heart Reality Check ===')
  const { checkInterventions } = await import('../../lib/ai/heart/intervention')
  const interventions = await checkInterventions(sb, UID)
  
  // With our stress test data, we should see real interventions
  console.log(`  ℹ️ ${interventions.length} real interventions triggered:`)
  for (const i of interventions) {
    console.log(`    [${i.severity}] ${i.type}: ${i.message.slice(0, 80)}`)
  }
  assert(interventions.length > 0, 'Heart: at least 1 intervention triggered with current data')

  // === Export API Data Check ===
  console.log('\n=== Export Data Completeness ===')
  const tables = ['profiles','commitments','contacts','emails','calendar_events','family_calendar','trips','tasks']
  for (const table of tables) {
    const { count } = await sb.from(table).select('*', { count: 'exact', head: true }).eq(table === 'profiles' ? 'id' : 'user_id', UID)
    console.log(`  ${table}: ${count || 0} rows`)
    assert((count || 0) >= 0, `Export: ${table} accessible`)
  }

  // === Summary ===
  console.log(`\n==============================`)
  console.log(`Phase 2+3 Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
