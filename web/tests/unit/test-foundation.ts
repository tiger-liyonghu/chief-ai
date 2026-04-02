/**
 * Foundation module unit tests.
 * Tests pure functions that don't need DB or API.
 *
 * Run: npx tsx tests/unit/test-foundation.ts
 */

import { calculateTemperature, calculateTemperatureBatch } from '../../lib/contacts/temperature'
import { extractCityFromEmail } from '../../lib/contacts/extract-city'
import { detectReferral } from '../../lib/signals/referral-detect'
import { detectPolicySignal } from '../../lib/signals/policy-detect'
import { getBestContactWindow } from '../../lib/travel/timezone'

let passed = 0
let failed = 0
let total = 0

function assert(id: string, condition: boolean, msg: string) {
  total++
  if (condition) {
    passed++
    console.log(`  ✅ ${id}: ${msg}`)
  } else {
    failed++
    console.log(`  ❌ ${id}: ${msg}`)
  }
}

// ═══════════════════════════════════════
// A1. Temperature Algorithm
// ═══════════════════════════════════════

console.log('\n═══ A1. Temperature Algorithm ═══')

const a1_01 = calculateTemperature({
  lastInteractionAt: new Date(),
  recentInteractionCount: 5,
  activeCommitmentCount: 2,
  importance: 'vip',
})
assert('A1-01', a1_01.score >= 80 && a1_01.label === 'hot',
  `VIP just interacted: score=${a1_01.score}, label=${a1_01.label}`)

const a1_02 = calculateTemperature({
  lastInteractionAt: new Date(Date.now() - 14 * 86400000),
  recentInteractionCount: 0,
  activeCommitmentCount: 0,
  importance: 'normal',
})
assert('A1-02', a1_02.score >= 15 && a1_02.score <= 35 && a1_02.label === 'cooling',
  `Normal 14d no contact: score=${a1_02.score}, label=${a1_02.label}`)

const a1_03 = calculateTemperature({
  lastInteractionAt: new Date(Date.now() - 30 * 86400000),
  recentInteractionCount: 0,
  activeCommitmentCount: 0,
  importance: 'vip',
})
assert('A1-03', a1_03.score < 50 && a1_03.needsAttention === true,
  `VIP 30d no contact: score=${a1_03.score}, needsAttention=${a1_03.needsAttention}`)

const a1_04 = calculateTemperature({
  lastInteractionAt: null,
  recentInteractionCount: 0,
  activeCommitmentCount: 0,
  importance: 'normal',
})
assert('A1-04', a1_04.score <= 15 && a1_04.label === 'cold',
  `Never interacted: score=${a1_04.score}, label=${a1_04.label}`)

const a1_05 = calculateTemperature({
  lastInteractionAt: new Date(Date.now() - 60 * 86400000),
  recentInteractionCount: 0,
  activeCommitmentCount: 3,
  importance: 'normal',
})
assert('A1-05', a1_05.score > a1_04.score,
  `60d but 3 commitments: score=${a1_05.score} > cold=${a1_04.score}`)

const a1_06 = calculateTemperature({
  lastInteractionAt: new Date(),
  recentInteractionCount: 100,
  activeCommitmentCount: 100,
  importance: 'vip',
})
assert('A1-06', a1_06.score === 100,
  `Max values: score=${a1_06.score} capped at 100`)

const a1_07 = calculateTemperature({
  lastInteractionAt: new Date(Date.now() - 365 * 86400000),
  recentInteractionCount: 0,
  activeCommitmentCount: 0,
  importance: 'normal',
})
assert('A1-07', a1_07.score >= 0,
  `365d no contact: score=${a1_07.score} >= 0`)

const batch = calculateTemperatureBatch([
  { id: '1', lastInteractionAt: new Date(), recentInteractionCount: 5, activeCommitmentCount: 2, importance: 'vip' },
  { id: '2', lastInteractionAt: null, recentInteractionCount: 0, activeCommitmentCount: 0, importance: 'normal' },
])
assert('A1-08', batch.length === 2 && batch[0].id === '1' && batch[1].id === '2',
  `Batch: ${batch.length} results with correct ids`)

// ═══════════════════════════════════════
// A4. City Extraction
// ═══════════════════════════════════════

console.log('\n═══ A4. City Extraction ═══')

assert('A4-01', extractCityFromEmail('Best regards\n123 Orchard Road, Singapore 238858') === 'Singapore',
  'Singapore from signature')

assert('A4-02', extractCityFromEmail('Office: Level 20, Menara TM, Kuala Lumpur, Malaysia') === 'Kuala Lumpur',
  'KL from signature')

assert('A4-03', extractCityFromEmail('地址：上海市浦东新区陆家嘴环路999号') === 'Shanghai',
  'Shanghai from Chinese signature')

assert('A4-04', extractCityFromEmail('Suite 3201, Central Tower, HK') === 'Hong Kong',
  'HK abbreviation')

assert('A4-05', extractCityFromEmail('Best regards, John Smith') === null,
  'No city in plain signature')

// A4-06: Only last 500 chars matter
const longBody = 'A'.repeat(600) + 'Tokyo office' + 'B'.repeat(100) + '\nBest regards, John'
assert('A4-06', extractCityFromEmail(longBody) === null || extractCityFromEmail(longBody) === 'Tokyo',
  `Long body: city=${extractCityFromEmail(longBody)} (Tokyo in middle, may or may not be in last 500)`)

// ═══════════════════════════════════════
// A5. Referral Detection
// ═══════════════════════════════════════

console.log('\n═══ A5. Referral Detection ═══')

const r1 = detectReferral({
  id: '1', from_address: 'john@test.com', from_name: 'John',
  subject: 'Intro', body_text: 'My friend David is looking for insurance advisory services.'
})
assert('A5-01', r1 !== null && r1.confidence >= 0.7,
  `EN referral: ${r1 ? 'detected' : 'missed'}`)

const r2 = detectReferral({
  id: '2', from_address: 'zhang@test.com', from_name: '张总',
  subject: '介绍', body_text: '我朋友也需要保险，介绍给你认识一下。'
})
assert('A5-02', r2 !== null,
  `ZH referral: ${r2 ? 'detected' : 'missed'}`)

const r3 = detectReferral({
  id: '3', from_address: 'mike@test.com', from_name: 'Mike',
  subject: 'Introduction', body_text: 'Let me introduce you to Lisa, she runs a great startup.'
})
assert('A5-03', r3 !== null,
  `Introduction: ${r3 ? 'detected' : 'missed'}`)

const r4 = detectReferral({
  id: '4', from_address: 'bob@test.com', from_name: 'Bob',
  subject: 'Report', body_text: 'Please send the quarterly report by Friday.'
})
assert('A5-04', r4 === null,
  `Normal email: ${r4 === null ? 'correctly ignored' : 'false positive'}`)

// ═══════════════════════════════════════
// A6. Policy Detection
// ═══════════════════════════════════════

console.log('\n═══ A6. Policy Detection ═══')

const p1 = detectPolicySignal({
  id: '1', from_address: 'insurer@aia.com', from_name: 'AIA',
  subject: 'Policy Renewal Notice', body_text: 'Your medical insurance policy renewal is due on 2026-05-01. Policy number: MED-2026-001.'
})
assert('A6-01', p1 !== null && p1.signalType === 'renewal',
  `Renewal: type=${p1?.signalType}`)
assert('A6-01b', p1?.productType === 'medical',
  `Product: ${p1?.productType}`)

const p2 = detectPolicySignal({
  id: '2', from_address: 'insurer@pru.com',
  subject: 'New Policy Issued', body_text: 'Congratulations! Your life insurance policy number LIFE-2026-042 is now effective from 1 April 2026.'
})
assert('A6-02', p2 !== null && p2.signalType === 'new_policy',
  `New policy: type=${p2?.signalType}`)

const p3 = detectPolicySignal({
  id: '3', from_address: 'hr@company.com',
  subject: 'Meeting', body_text: 'Let us discuss the quarterly targets in tomorrow meeting at 3pm.'
})
assert('A6-04', p3 === null,
  `Normal email: ${p3 === null ? 'correctly ignored' : 'false positive'}`)

const p4 = detectPolicySignal({
  id: '4', from_address: 'billing@insurer.com',
  subject: 'Premium Due', body_text: 'Your premium payment is due by end of this month for your critical illness insurance plan.'
})
assert('A6-05', p4 !== null && p4.signalType === 'premium_due',
  `Premium due: type=${p4?.signalType}`)

// ═══════════════════════════════════════
// A7. Timezone Recommendation
// ═══════════════════════════════════════

console.log('\n═══ A7. Timezone Recommendation ═══')

const tz1 = getBestContactWindow('Tokyo', 'Singapore')
assert('A7-01', tz1 !== null && tz1.overlapHours > 0,
  `SG→Tokyo: ${tz1?.overlapHours}h overlap, ${tz1?.recommendation?.slice(0, 50)}`)

const tz2 = getBestContactWindow('Singapore', 'London')
assert('A7-02', tz2 !== null,
  `SG→London: ${tz2?.overlapHours}h overlap`)

const tz3 = getBestContactWindow('Singapore', 'San Francisco')
assert('A7-03', tz3 !== null,
  `SG→SF: ${tz3?.overlapHours}h overlap`)

const tz4 = getBestContactWindow('Singapore', 'Singapore')
assert('A7-04', tz4 !== null && tz4.overlapHours >= 8,
  `Same city: ${tz4?.overlapHours}h overlap`)

const tz5 = getBestContactWindow('Unknown', 'Singapore')
assert('A7-05', tz5 === null,
  `Unknown city: ${tz5 === null ? 'null' : 'unexpected result'}`)

// ═══════════════════════════════════════
// Summary
// ═══════════════════════════════════════

console.log(`\n${'═'.repeat(50)}`)
console.log(`Results: ${passed}/${total} passed, ${failed} failed`)
console.log(`${'═'.repeat(50)}`)

if (failed > 0) {
  process.exit(1)
}
