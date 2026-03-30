/**
 * Integration Test: Send complex test emails to 163 mailbox via SMTP.
 *
 * Two test cases designed to exercise multiple processing pipelines:
 *   Case 1: Shanghai business trip + client negotiation + family conflict
 *   Case 2: VIP investor + multi-party follow-ups + WhatsApp commitment
 *
 * Usage: npx tsx tests/integration/send-test-emails.ts
 *
 * After sending, trigger sync+process via the app, then run verify-test-results.ts
 */

import nodemailer from 'nodemailer'

// 163 SMTP config — uses the same credentials as the IMAP account
const SMTP_CONFIG = {
  host: 'smtp.163.com',
  port: 465,
  secure: true,
  auth: {
    user: 'nkliyonghu@163.com',
    pass: '', // Will be filled from env or prompt
  },
}

const TARGET_EMAIL = 'nkliyonghu@163.com'

// Unique test run ID to identify test emails later
const TEST_RUN_ID = `TEST-${Date.now()}`

interface TestEmail {
  case: string
  description: string
  from: string      // Display name <email> — all sent FROM 163 to itself
  subject: string
  body: string
  expectedResults: string[]
}

const TEST_EMAILS: TestEmail[] = [
  // ═══════════════════════════════════════════
  // CASE 1: Shanghai Business Trip
  // ═══════════════════════════════════════════
  {
    case: 'Case 1',
    description: 'Flight booking confirmation → Trip Detection + Expense',
    from: 'Air China Booking <booking@airchina.com>',
    subject: `[${TEST_RUN_ID}] E-Ticket Confirmation: Singapore → Shanghai CA968`,
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
    expectedResults: [
      'Trip created: "Trip to Shanghai"',
      'Trip dates: Apr 15-18',
      'Flight info extracted (CA968, CA969)',
      'Expense: SGD 1850 (flight category)',
      'Trip status: upcoming',
    ],
  },
  {
    case: 'Case 1',
    description: 'Client demands proposal by Wednesday → Commitment + Task + Reply Urgency',
    from: 'Zhang Wei <zhangwei@huaxin-capital.com>',
    subject: `[${TEST_RUN_ID}] Re: Insurance Product Partnership — Need proposal by Wednesday`,
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
    expectedResults: [
      'Commitment (i_promised): "Deliver proposal package by Apr 16"',
      'Commitment (i_promised): "Arrange CTO call before Wednesday"',
      'Task: "Prepare product roadmap" (priority 1)',
      'Task: "Revenue projection model" (priority 1)',
      'Reply urgency: 3 (urgent)',
      'Contact created: Zhang Wei, huaxin-capital.com',
      'Contact created: Liu Mei (mentioned)',
    ],
  },
  {
    case: 'Case 1',
    description: 'Hotel booking confirmation → Trip merge + Expense',
    from: 'Marriott Reservations <reservations@marriott.com>',
    subject: `[${TEST_RUN_ID}] Booking Confirmation: The Ritz-Carlton Shanghai Pudong`,
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
    expectedResults: [
      'Trip merged with existing Shanghai trip (same city, same dates)',
      'Hotel info extracted (Ritz-Carlton, check-in/out)',
      'Expense: SGD 1520 (hotel category)',
      'No new trip created (merged)',
    ],
  },
  {
    case: 'Case 1',
    description: 'Colleague follow-up on deliverables → they_promised commitment',
    from: 'Sarah Chen <sarah.chen@actuaryhelp.com>',
    subject: `[${TEST_RUN_ID}] Re: Shanghai prep — data pack ready by Monday`,
    body: `Hi Tiger,

I've spoken with the data team. Here's the update:

1. The revenue model template is ready. I'll send you the completed version with real numbers by Monday April 14th EOD.
2. James is finishing the technical architecture diagram — he promised to have it on your desk by Monday morning.
3. I've also reached out to Dr. Wang at NUS for the actuarial validation letter. She said she'll email it directly to you by Tuesday.

For the CTO call with Huaxin, I suggest we block either Tuesday 2pm or Wednesday 9am SGT. Want me to send the calendar invite?

One thing — the hiring plan section might be tricky since we haven't finalized the Q3 headcount with HR yet. Can you check with Linda on that?

Cheers,
Sarah`,
    expectedResults: [
      'Commitment (they_promised): "Sarah sends revenue model by Apr 14"',
      'Commitment (they_promised): "James delivers architecture diagram by Monday"',
      'Commitment (they_promised): "Dr. Wang sends validation letter by Tuesday"',
      'Task: "Check with Linda on Q3 headcount"',
      'Reply needed: yes (about CTO call scheduling)',
      'Contact: Sarah Chen, actuaryhelp.com (team relationship)',
    ],
  },

  // ═══════════════════════════════════════════
  // CASE 2: VIP Investor + Multi-party
  // ═══════════════════════════════════════════
  {
    case: 'Case 2',
    description: 'VIP investor demands financials by Friday → Urgent commitment',
    from: 'David Tan <david.tan@temasek.com.sg>',
    subject: `[${TEST_RUN_ID}] URGENT: Q1 financials needed before Friday board prep`,
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
    expectedResults: [
      'Commitment (i_promised): "Send Q1 financials by Thursday 6pm"',
      'Task: "Prepare Q1 P&L actual vs budget" (priority 1)',
      'Task: "Explain February burn rate increase" (priority 1)',
      'Reply urgency: 3 (urgent)',
      'Contact: David Tan, temasek.com.sg → importance: vip',
      'Contact: Jessica Wong (mentioned)',
    ],
  },
  {
    case: 'Case 2',
    description: 'Lawyer email — contract delivery promise → they_promised',
    from: 'Rachel Lim <rachel.lim@allenandgledhill.com>',
    subject: `[${TEST_RUN_ID}] Re: Series A Term Sheet — Draft SPA timeline`,
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
    expectedResults: [
      'Commitment (they_promised): "Rachel delivers draft SPA by Apr 14"',
      'Commitment (they_promised): "Rachel delivers SHA amendments by Apr 16"',
      'Commitment (i_promised): "Prepare board resolutions by Apr 17"',
      'Commitment (i_promised): "Send cap table, IP assignments, ESOP details by Apr 15"',
      'Task: "Review non-compete clause Section 8.3"',
      'Reply urgency: 2-3 (needs confirmation)',
      'Contact: Rachel Lim, allenandgledhill.com → importance: high',
    ],
  },
]

async function main() {
  // Get IMAP password from the add-imap API's stored credentials
  // For testing, we need it passed via env
  const password = process.env.IMAP_163_PASSWORD
  if (!password) {
    console.error('❌ Set IMAP_163_PASSWORD environment variable (163 authorization code)')
    console.error('   Usage: IMAP_163_PASSWORD=your_code npx tsx tests/integration/send-test-emails.ts')
    process.exit(1)
  }

  SMTP_CONFIG.auth.pass = password

  const transporter = nodemailer.createTransport(SMTP_CONFIG)

  // Verify connection
  try {
    await transporter.verify()
    console.log('✅ SMTP connection verified\n')
  } catch (err: any) {
    console.error('❌ SMTP connection failed:', err.message)
    process.exit(1)
  }

  console.log(`🧪 Test Run ID: ${TEST_RUN_ID}`)
  console.log(`📧 Sending ${TEST_EMAILS.length} test emails to ${TARGET_EMAIL}\n`)

  for (const email of TEST_EMAILS) {
    try {
      const info = await transporter.sendMail({
        from: `${email.from.split('<')[0].trim()} <${TARGET_EMAIL}>`, // 163 requires from=auth user
        replyTo: email.from, // Keep original sender in reply-to
        to: TARGET_EMAIL,
        subject: email.subject,
        text: email.body,
        headers: {
          'X-Test-Run': TEST_RUN_ID,
          'X-Test-Case': email.case,
          'X-Original-From': email.from,
        },
      })

      console.log(`✅ [${email.case}] ${email.description}`)
      console.log(`   Subject: ${email.subject.replace(TEST_RUN_ID, '...')}`)
      console.log(`   MessageId: ${info.messageId}\n`)
    } catch (err: any) {
      console.error(`❌ [${email.case}] ${email.description}`)
      console.error(`   Error: ${err.message}\n`)
    }

    // Small delay between sends to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log('─'.repeat(60))
  console.log('\n📋 Next steps:')
  console.log('   1. Wait 30 seconds for 163 to deliver emails')
  console.log('   2. Trigger sync: browser console → fetch("/api/sync", {method:"POST"}).then(r=>r.json()).then(console.log)')
  console.log('   3. Trigger process: fetch("/api/sync/process", {method:"POST"}).then(r=>r.json()).then(console.log)')
  console.log('   4. Run verification: npx tsx tests/integration/verify-test-results.ts')
  console.log(`\n🔑 Test Run ID: ${TEST_RUN_ID} (use this to filter test data)\n`)

  // Print expected results summary
  console.log('═'.repeat(60))
  console.log('Expected Results Summary:')
  console.log('═'.repeat(60))
  for (const email of TEST_EMAILS) {
    console.log(`\n[${email.case}] ${email.description}`)
    for (const result of email.expectedResults) {
      console.log(`   ☐ ${result}`)
    }
  }
}

main().catch(console.error)
