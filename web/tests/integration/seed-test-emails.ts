/**
 * Integration Test: Seed test emails directly into Supabase.
 *
 * Bypasses SMTP (163 can't forge sender addresses) and inserts emails
 * directly into the DB with realistic metadata. Then triggers AI processing.
 *
 * Two complex cases:
 *   Case 1: Shanghai business trip + client negotiation + family conflict
 *   Case 2: VIP investor + multi-party follow-ups
 *
 * Usage: npx tsx tests/integration/seed-test-emails.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://krxhyvixctwdoraulvlz.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGh5dml4Y3R3ZG9yYXVsdmx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYwNTIyMCwiZXhwIjoyMDkwMTgxMjIwfQ.IBh2XBnPRTtpVJTTusCfIRQN5I0ws1xfqnT4wyOKDl0'

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const TEST_RUN = `TEST-${Date.now()}`

interface SeedEmail {
  case_id: string
  desc: string
  from_address: string
  from_name: string
  to_addresses: string[]
  subject: string
  body: string                // stored as snippet for now; process will use it
  received_at: string
  is_outbound: boolean
  labels: string[]
  expected: string[]
}

const SEED_EMAILS: SeedEmail[] = [
  // ═══════════════════════════════════════════════════
  // CASE 1: Shanghai Business Trip + Client Negotiation
  // ═══════════════════════════════════════════════════

  {
    case_id: 'C1-flight',
    desc: 'Flight confirmation → Trip + Expense',
    from_address: 'booking@airchina.com',
    from_name: 'Air China Booking',
    to_addresses: ['nkliyonghu@163.com'],
    subject: `[${TEST_RUN}] E-Ticket Confirmation: Singapore → Shanghai CA968`,
    body: `Dear Mr. Li,

Your flight booking has been confirmed.

Booking Reference: CA-20260415-7829
Flight: CA968
Route: Singapore Changi (SIN) → Shanghai Pudong (PVG)
Date: April 15, 2026
Departure: 08:30 SGT
Arrival: 14:15 CST
Passenger: Li Yonghu
Class: Business
Total Amount: SGD 1,850.00
Payment: Visa ending 4521

Return Flight:
Flight: CA969
Route: Shanghai Pudong (PVG) → Singapore Changi (SIN)
Date: April 18, 2026
Departure: 16:00 CST
Arrival: 22:30 SGT

Please arrive at the airport at least 2 hours before departure.

Best regards,
Air China Reservations`,
    received_at: '2026-03-29T10:00:00Z',
    is_outbound: false,
    labels: ['INBOX'],
    expected: [
      'Trip: "Trip to Shanghai", Apr 15-18, upcoming',
      'Flight: CA968 SIN→PVG + CA969 PVG→SIN',
      'Expense: SGD 1850, flight',
    ],
  },

  {
    case_id: 'C1-client',
    desc: 'Client demands proposal → Commitment (i_promised) + Tasks + Urgent reply',
    from_address: 'zhangwei@huaxin-capital.com',
    from_name: 'Zhang Wei',
    to_addresses: ['nkliyonghu@163.com'],
    subject: `[${TEST_RUN}] Re: Insurance Product Partnership — Need proposal by Wednesday`,
    body: `Hi Tiger,

Thank you for the productive meeting last week. Our board is very interested in the insurance analytics platform.

However, I need to emphasize that our investment committee meets this Thursday morning. To include your project in the agenda, I need the following by Wednesday April 16th, 5pm Shanghai time:

1. Detailed product roadmap (Q2-Q4 2026)
2. Revenue projection model with assumptions
3. Technical architecture overview
4. Team composition and hiring plan

This is quite urgent as our committee only meets once a month. If we miss this window, the next review cycle would be in May.

Also, could you arrange a 30-minute call with your CTO before Wednesday? Our technical due diligence team has some architecture questions.

I've also asked my assistant Liu Mei (liumei@huaxin-capital.com) to coordinate the logistics.

Best regards,
Zhang Wei
Managing Director
Huaxin Capital Partners
+86 138 0013 8000`,
    received_at: '2026-03-29T14:30:00Z',
    is_outbound: false,
    labels: ['INBOX'],
    expected: [
      'Commitment (i_promised): proposal by Apr 16',
      'Commitment (i_promised): arrange CTO call',
      'Tasks: roadmap, revenue model, architecture, hiring plan',
      'Reply urgency: 3 (urgent)',
      'Contact: Zhang Wei → relationship: client/investor',
    ],
  },

  {
    case_id: 'C1-hotel',
    desc: 'Hotel confirmation → Trip merge + Expense',
    from_address: 'reservations@marriott.com',
    from_name: 'Marriott Reservations',
    to_addresses: ['nkliyonghu@163.com'],
    subject: `[${TEST_RUN}] Booking Confirmation: The Ritz-Carlton Shanghai Pudong`,
    body: `Dear Mr. Li Yonghu,

Thank you for choosing The Ritz-Carlton, Shanghai, Pudong.

Confirmation Number: RC-88234519
Check-in: April 15, 2026 (after 3:00 PM)
Check-out: April 18, 2026 (before 12:00 PM)
Room Type: Deluxe River View King
Rate: CNY 2,800 per night (3 nights)
Total: CNY 8,400 (approximately SGD 1,520)

Address: No. 8, Century Avenue, Pudong, Shanghai 200120, China

Special Arrangements:
- Airport transfer arranged (PVG → hotel, arriving CA968 at 14:15)
- Late checkout requested (subject to availability)

We look forward to welcoming you.

Warm regards,
Ritz-Carlton Shanghai Reservations Team`,
    received_at: '2026-03-29T11:00:00Z',
    is_outbound: false,
    labels: ['INBOX'],
    expected: [
      'Trip merged with Shanghai trip (same city, same dates)',
      'Hotel info: Ritz-Carlton, Apr 15-18',
      'Expense: SGD 1520, hotel',
    ],
  },

  {
    case_id: 'C1-colleague',
    desc: 'Colleague follow-up → they_promised commitments + task',
    from_address: 'sarah.chen@actuaryhelp.com',
    from_name: 'Sarah Chen',
    to_addresses: ['nkliyonghu@163.com'],
    subject: `[${TEST_RUN}] Re: Shanghai prep — deliverables update`,
    body: `Hi Tiger,

I've spoken with the data team. Here's the update:

1. The revenue model template is ready. I'll send you the completed version with real numbers by Monday April 14th EOD.
2. James is finishing the technical architecture diagram — he promised to have it on your desk by Monday morning.
3. I've also reached out to Dr. Wang at NUS for the actuarial validation letter. She said she'll email it directly to you by Tuesday.

For the CTO call with Huaxin, I suggest we block either Tuesday 2pm or Wednesday 9am SGT. Want me to send the calendar invite?

One thing — the hiring plan section might be tricky since we haven't finalized the Q3 headcount with HR yet. Can you check with Linda on that?

Cheers,
Sarah`,
    received_at: '2026-03-29T16:00:00Z',
    is_outbound: false,
    labels: ['INBOX'],
    expected: [
      'Commitment (they_promised): Sarah sends revenue model by Apr 14',
      'Commitment (they_promised): James delivers architecture diagram by Monday',
      'Commitment (they_promised): Dr. Wang sends validation letter by Tuesday',
      'Task: Check with Linda on Q3 headcount',
      'Reply needed: yes (CTO call scheduling)',
    ],
  },

  // ═══════════════════════════════════════════════════
  // CASE 2: VIP Investor + Multi-party Follow-ups
  // ═══════════════════════════════════════════════════

  {
    case_id: 'C2-investor',
    desc: 'VIP investor demands financials → Urgent commitment + tasks',
    from_address: 'david.tan@temasek.com.sg',
    from_name: 'David Tan',
    to_addresses: ['nkliyonghu@163.com'],
    subject: `[${TEST_RUN}] URGENT: Q1 financials needed before Friday board prep`,
    body: `Tiger,

Quick note — our board prep starts Friday morning and I need your Q1 actuals + updated forecast by Thursday 6pm at the latest.

Specifically:
- Q1 2026 P&L (actual vs budget)
- Updated full-year forecast reflecting the new pricing model
- Customer acquisition cost breakdown by channel
- Monthly recurring revenue trend (Jan-Mar)

This is for the portfolio review section. If the numbers look strong, I'm planning to recommend increasing our follow-on allocation at the board meeting.

Also — I noticed your burn rate jumped 40% in February. Can you explain what drove that? The board will definitely ask.

I need this in the standard reporting template I sent last quarter. If you can't find it, ask my EA Jessica (jessica.wong@temasek.com.sg) and she'll resend.

Thanks,
David

David Tan
Senior Vice President, Investments
Temasek Holdings
One Temasek Avenue, Singapore 039192`,
    received_at: '2026-03-30T08:00:00Z',
    is_outbound: false,
    labels: ['INBOX'],
    expected: [
      'Commitment (i_promised): Send Q1 financials by Thursday',
      'Task: Prepare Q1 P&L (priority 1)',
      'Task: Explain Feb burn rate increase (priority 1)',
      'Reply urgency: 3 (urgent)',
      'Contact: David Tan, temasek.com.sg → VIP',
    ],
  },

  {
    case_id: 'C2-lawyer',
    desc: 'Lawyer — contract timeline → they_promised + i_promised commitments',
    from_address: 'rachel.lim@allenandgledhill.com',
    from_name: 'Rachel Lim',
    to_addresses: ['nkliyonghu@163.com'],
    subject: `[${TEST_RUN}] Re: Series A Term Sheet — Draft SPA timeline`,
    body: `Dear Tiger,

Following our call today, here is the updated timeline for the Series A documentation:

1. Draft Share Purchase Agreement (SPA) — our team will have this ready by Monday April 14th.
2. Shareholders' Agreement amendments — by Wednesday April 16th.
3. Board resolutions — we need your company secretary to prepare these. Please have them ready by April 17th.

Key issue flagged: The non-compete clause in Section 8.3 needs your review. The current draft restricts founders from any insurance-related activities for 3 years post-exit. We recommend negotiating this down to 18 months and limiting the geographic scope to Singapore only.

I'll also need the following from your side by April 15th:
- Updated cap table (fully diluted)
- List of all existing IP assignments
- Employee stock option pool details

Please confirm you've received this and can meet these deadlines.

Best regards,
Rachel Lim
Partner, Corporate & M&A
Allen & Gledhill LLP`,
    received_at: '2026-03-30T09:30:00Z',
    is_outbound: false,
    labels: ['INBOX'],
    expected: [
      'Commitment (they_promised): Rachel delivers SPA by Apr 14',
      'Commitment (they_promised): SHA amendments by Apr 16',
      'Commitment (i_promised): Board resolutions by Apr 17',
      'Commitment (i_promised): Cap table + IP + ESOP by Apr 15',
      'Task: Review non-compete clause Section 8.3',
      'Reply urgency: 2-3',
      'Contact: Rachel Lim → importance: high',
    ],
  },
]

async function main() {
  // Find the user who owns the 163 IMAP account
  const { data: imapOwner } = await admin
    .from('google_accounts')
    .select('user_id')
    .eq('google_email', 'nkliyonghu@163.com')
    .eq('provider', 'imap')
    .single()

  if (!imapOwner) {
    console.error('❌ No IMAP account found for nkliyonghu@163.com')
    process.exit(1)
  }

  const user = { id: imapOwner.user_id }
  console.log(`👤 User ID: ${user.id}`)
  console.log(`🧪 Test Run: ${TEST_RUN}\n`)

  // Get the 163 account ID
  const { data: accounts } = await admin
    .from('google_accounts')
    .select('id, google_email')
    .eq('user_id', user.id)
    .eq('provider', 'imap')

  const imapAccount = accounts?.find(a => a.google_email === 'nkliyonghu@163.com')
  const accountId = imapAccount?.id || 'test-account'

  console.log(`📧 IMAP Account: ${imapAccount?.google_email || 'not found'} (${accountId})\n`)

  // Add a family event that conflicts with the Shanghai trip (Case 1)
  console.log('📅 Seeding family calendar conflict...')
  const { error: familyErr } = await admin.from('family_calendar').insert({
    user_id: user.id,
    event_type: 'hard_constraint',
    title: 'Emily钢琴比赛 (Piano Competition)',
    start_date: '2026-04-16',
    end_date: '2026-04-16',
    start_time: '14:00',
    end_time: '16:30',
    recurrence: 'none',
    family_member: 'Emily',
    is_active: true,
    source: 'manual',
  })
  if (familyErr) {
    console.warn(`   ⚠️ Family event insert: ${familyErr.message}`)
  } else {
    console.log('   ✅ Emily钢琴比赛 — April 16 14:00-16:30 (conflicts with Shanghai trip)\n')
  }

  // Seed emails
  let seeded = 0
  for (const email of SEED_EMAILS) {
    const messageId = `test-${TEST_RUN}-${email.case_id}`

    const { error } = await admin.from('emails').upsert({
      user_id: user.id,
      gmail_message_id: messageId,
      thread_id: messageId,
      subject: email.subject,
      from_address: email.from_address,
      from_name: email.from_name,
      to_addresses: email.to_addresses,
      received_at: email.received_at,
      snippet: email.body.slice(0, 200),
      body_text: email.body,              // full body for AI processing
      labels: email.labels,

      body_processed: false,
      is_reply_needed: false,
      source_account_email: 'nkliyonghu@163.com',
    }, { onConflict: 'user_id,gmail_message_id' })

    if (error) {
      console.error(`❌ [${email.case_id}] ${email.desc}: ${error.message}`)
    } else {
      console.log(`✅ [${email.case_id}] ${email.desc}`)
      console.log(`   From: ${email.from_name} <${email.from_address}>`)
      seeded++
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`📊 Seeded: ${seeded}/${SEED_EMAILS.length} emails + 1 family event`)
  console.log(`${'═'.repeat(60)}`)

  console.log(`\n📋 Next steps:`)
  console.log(`   1. Trigger process: open browser console and run:`)
  console.log(`      fetch('/api/sync/process', {method:'POST'}).then(r=>r.json()).then(console.log)`)
  console.log(`   2. Run it 2-3 times (processes 10 emails per call)`)
  console.log(`   3. Check dashboard for results`)
  console.log(`   4. Check briefing — should mention Shanghai trip + family conflict`)

  console.log(`\n🎯 Expected outcomes:`)
  console.log(`   ─ Trips: 1 (Shanghai, Apr 15-18)`)
  console.log(`   ─ Expenses: 2 (flight SGD 1850 + hotel SGD 1520)`)
  console.log(`   ─ Commitments (i_promised): ~5`)
  console.log(`   ─ Commitments (they_promised): ~5`)
  console.log(`   ─ Tasks: ~6-8`)
  console.log(`   ─ Contacts: ~5 new (Zhang Wei, Sarah, David Tan, Rachel Lim, etc.)`)
  console.log(`   ─ Reply urgency 3: 2 emails (Zhang Wei, David Tan)`)
  console.log(`   ─ Briefing: mentions Shanghai trip ⚠️ Emily piano conflict`)
}

main().catch(console.error)
