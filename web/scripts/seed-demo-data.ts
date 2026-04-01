/**
 * Seed demo data: send real emails and calendar invites from sophie@actuaryhelp.com to aiat.actuaryhelp@gmail.com
 * Run: npx tsx scripts/seed-demo-data.ts
 */
import crypto from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY!

const TO = 'aiat.actuaryhelp@gmail.com'
const FROM = 'sophie@actuaryhelp.com'

function decrypt(encrypted: string): string {
  const key = Buffer.from(TOKEN_ENCRYPTION_KEY, 'hex')
  const buf = Buffer.from(encrypted, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(data, undefined, 'utf8') + decipher.final('utf8')
}

async function getAccessToken(): Promise<string> {
  const { createClient } = await import('@supabase/supabase-js')
  const c = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data: acc } = await c.from('google_accounts')
    .select('refresh_token_encrypted')
    .eq('google_email', FROM)
    .single()
  if (!acc) throw new Error('No Sophie account found')

  const refreshToken = decrypt(acc.refresh_token_encrypted)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(data))
  return data.access_token
}

// ─── Email sending via Gmail API ───
async function sendEmail(token: string, to: string, subject: string, body: string) {
  const raw = [
    `From: Sophie Li <${FROM}>`,
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n')

  const encoded = Buffer.from(raw).toString('base64url')
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encoded }),
  })
  const data = await res.json()
  if (data.error) console.error('  ✗ Email failed:', subject, data.error.message)
  else console.log('  ✓ Email sent:', subject)
  return data
}

// ─── Calendar event via Google Calendar API ───
async function createCalendarEvent(token: string, event: {
  summary: string
  description?: string
  start: string // ISO datetime
  end: string
  location?: string
  attendees?: string[]
}) {
  const body: any = {
    summary: event.summary,
    description: event.description || '',
    start: { dateTime: event.start, timeZone: 'Asia/Singapore' },
    end: { dateTime: event.end, timeZone: 'Asia/Singapore' },
    location: event.location || '',
    attendees: [{ email: TO }],
  }
  if (event.attendees) {
    body.attendees = event.attendees.map(e => ({ email: e }))
    body.attendees.push({ email: TO })
  }

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.error) console.error('  ✗ Event failed:', event.summary, data.error.message)
  else console.log('  ✓ Event created:', event.summary, event.start)
  return data
}

// ─── Helper: date offset from today (SGT) ───
function dayOffset(days: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(hour).padStart(2, '0')
  const min = String(minute).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}:00+08:00`
}

// ─────────────────────────────────────
// MAIN
// ─────────────────────────────────────
async function main() {
  console.log('🔑 Refreshing Sophie access token...')
  const token = await getAccessToken()
  console.log('✅ Token ready\n')

  // ═══════════════════════════════════
  // TODAY's emails & events (让今日部分有很多信息)
  // ═══════════════════════════════════
  console.log('📧 Sending TODAY emails...')

  await sendEmail(token, TO, 'Q2 Revenue Report - Need Your Sign-off by EOD',
    `Hi,\n\nThe Q2 revenue report is ready for your review. Finance needs your sign-off by end of day today.\n\nKey highlights:\n- Revenue up 12% YoY\n- APAC grew 23%, fastest region\n- Two large deals still pending close\n\nPlease review the attached deck and confirm. David from Finance has been waiting since last Thursday.\n\nBest,\nSophie`)

  await sendEmail(token, TO, 'RE: Partnership Proposal - Prudential Singapore',
    `Hi,\n\nJust following up on the Prudential partnership proposal I sent last week. Their BD team is expecting our response by Wednesday.\n\nThey're offering:\n- Co-branded product for HNW clients\n- Revenue share 60/40\n- Exclusive distribution in SG for 12 months\n\nShould I schedule a call with their VP next week?\n\nSophie`)

  await sendEmail(token, TO, 'URGENT: Client Escalation - Manulife',
    `Hi,\n\nManulife's Head of Digital just called. They're unhappy with the delivery timeline on Project Phoenix. They expected the first milestone last Friday.\n\nI've drafted a response acknowledging the delay and proposing a revised timeline (pushing delivery to April 15).\n\nCan you review the draft and approve? They want to hear from us TODAY.\n\nSophie`)

  await sendEmail(token, TO, 'David Chen asking about dinner tonight',
    `Hi,\n\nDavid Chen (CEO, InsurTech Capital) texted asking if you're free for dinner tonight at 7pm. He mentioned wanting to discuss their Series B fund and potential co-investment opportunities.\n\nHe suggested CUT by Wolfgang Puck at Marina Bay Sands.\n\nShould I confirm? He's a key relationship.\n\nSophie`)

  await sendEmail(token, TO, '女儿钢琴比赛提醒 - 本周六',
    `Hi,\n\n提醒一下，Emma 本周六（4月5日）下午2点在 Victoria Concert Hall 有钢琴比赛。\n\n她已经练了两个月的肖邦夜曲，很紧张。老师说发挥好的话有机会进决赛。\n\n你上次答应会去看的，记得留出时间。\n\n另外，太太说周六晚上全家一起去吃饭庆祝，不管结果如何。\n\nSophie`)

  await sendEmail(token, TO, 'RE: Tokyo Trip Next Week - Itinerary Draft',
    `Hi,\n\nHere's the draft itinerary for your Tokyo trip (Apr 7-10):\n\nMon Apr 7: Fly SQ638 (8:25am-4:25pm), check in Aman Tokyo, dinner with Nomura team\nTue Apr 8: Full day meetings at Tokio Marine HQ, evening free\nWed Apr 9: Morning: Sony Financial presentation, Afternoon: free for shopping/sightseeing\nThu Apr 10: Breakfast meeting with Dai-ichi Life, Fly SQ637 back (1:30pm-7:30pm)\n\nHotel: Aman Tokyo (confirmed, Deluxe Room)\nPlease review and let me know if you want to adjust anything.\n\nSophie`)

  await sendEmail(token, TO, 'Board Meeting Prep - Materials Due Thursday',
    `Hi,\n\nReminder: Board meeting is next Monday (April 7). Materials need to be submitted to the board secretary by Thursday.\n\nStill outstanding:\n1. CEO update slides (your section on APAC strategy)\n2. Financial projections for Q3-Q4\n3. Headcount plan approval\n\nI've drafted the CEO update slides. Please review and add your commentary on the competitive landscape section.\n\nSophie`)

  await sendEmail(token, TO, 'Team Birthday - Sarah\'s Surprise Party Friday',
    `Hi,\n\nQuick reminder - Sarah from the product team turns 30 this Friday. The team is planning a surprise lunch at Odette (12:30pm). \n\nYou mentioned you'd say a few words. Also, we collected $500 for a gift (Dyson hair dryer, her wish list item).\n\nPlease don't mention it if you see her before Friday!\n\nSophie`)

  // ═══════════════════════════════════
  // TODAY's calendar events
  // ═══════════════════════════════════
  console.log('\n📅 Creating TODAY calendar events...')

  await createCalendarEvent(token, {
    summary: 'Morning Standup - Product Team',
    start: dayOffset(0, 9, 0),
    end: dayOffset(0, 9, 30),
    description: 'Daily standup. Focus: Q2 launch timeline review.',
  })

  await createCalendarEvent(token, {
    summary: 'Manulife Escalation Call',
    start: dayOffset(0, 10, 30),
    end: dayOffset(0, 11, 30),
    description: 'URGENT: Discuss Project Phoenix delay. Review revised timeline. Attendees: VP Digital, PM lead.',
    attendees: ['david.wong@manulife.com', 'pm@company.com'],
  })

  await createCalendarEvent(token, {
    summary: '1:1 with CFO - Q2 Sign-off',
    start: dayOffset(0, 14, 0),
    end: dayOffset(0, 14, 45),
    description: 'Review Q2 revenue report. Finance needs sign-off today.',
  })

  await createCalendarEvent(token, {
    summary: 'Interview - Senior Engineer Candidate',
    start: dayOffset(0, 15, 0),
    end: dayOffset(0, 16, 0),
    description: 'Final round interview. Candidate: James Liu, ex-Google, 8 YOE. Focus: system design + culture fit.',
  })

  await createCalendarEvent(token, {
    summary: '🍽️ Dinner with David Chen - MBS',
    start: dayOffset(0, 19, 0),
    end: dayOffset(0, 21, 0),
    description: 'CUT by Wolfgang Puck, Marina Bay Sands. Discuss Series B fund and co-investment.',
    location: 'CUT by Wolfgang Puck, Marina Bay Sands, 10 Bayfront Ave',
  })

  // ═══════════════════════════════════
  // THIS WEEK (remaining days)
  // ═══════════════════════════════════
  console.log('\n📧 Sending THIS WEEK emails...')

  await sendEmail(token, TO, 'Legal Review: New Client Contract - AIA',
    `Hi,\n\nLegal has flagged two clauses in the AIA contract that need your attention:\n\n1. Liability cap: They want unlimited, we proposed $5M\n2. Data residency: They require all data in Singapore, our current infra is multi-region\n\nLegal recommends we push back on unlimited liability but accommodate data residency.\n\nCan you make a call on this by Wednesday? AIA wants to sign by end of week.\n\nSophie`)

  await sendEmail(token, TO, '太太的生日 - 4月12日别忘了',
    `Hi,\n\n提醒你，太太的生日是4月12日（下周六）。\n\n你去年说今年要带她去 Capella Sentosa 过周末。我查了一下还有房，要不要我帮你订？\n\n另外，Emma 说想给妈妈画一幅画当礼物，问你能不能带她去买画框。\n\nSophie`)

  await sendEmail(token, TO, 'HR: Performance Review Deadline April 10',
    `Hi,\n\nReminder that all director-level performance reviews are due by April 10.\n\nYou still need to submit reviews for:\n- Sarah Wong (Product)\n- Michael Tan (Engineering)\n- Lisa Chen (Marketing)\n\nHR says late submissions will delay the promotion cycle.\n\nSophie`)

  console.log('\n📅 Creating THIS WEEK events...')

  await createCalendarEvent(token, {
    summary: 'Prudential Partnership Call',
    start: dayOffset(1, 10, 0),
    end: dayOffset(1, 11, 0),
    description: 'Discuss co-branded product proposal. Revenue share negotiation.',
    attendees: ['bd@prudential.com.sg'],
  })

  await createCalendarEvent(token, {
    summary: 'All-Hands Meeting',
    start: dayOffset(1, 14, 0),
    end: dayOffset(1, 15, 0),
    description: 'Monthly all-hands. You present Q2 roadmap and announce new hires.',
  })

  await createCalendarEvent(token, {
    summary: 'AIA Contract Review with Legal',
    start: dayOffset(2, 11, 0),
    end: dayOffset(2, 12, 0),
    description: 'Review liability cap and data residency clauses. Decision needed.',
  })

  await createCalendarEvent(token, {
    summary: 'Emma 钢琴课 (接送)',
    start: dayOffset(2, 16, 30),
    end: dayOffset(2, 17, 30),
    description: '比赛前最后一次练习课。Yamaha Music School, Orchard.',
    location: 'Yamaha Music School, 391 Orchard Rd',
  })

  await createCalendarEvent(token, {
    summary: 'Board Materials Submission Deadline',
    start: dayOffset(3, 9, 0),
    end: dayOffset(3, 9, 30),
    description: 'DEADLINE: Submit CEO update slides, financial projections, headcount plan to board secretary.',
  })

  await createCalendarEvent(token, {
    summary: '🎂 Sarah\'s Surprise Birthday Lunch',
    start: dayOffset(4, 12, 30),
    end: dayOffset(4, 14, 0),
    description: 'Surprise party at Odette. You\'re saying a few words. Don\'t spoil it!',
    location: 'Odette, 1 St Andrew\'s Rd, National Gallery Singapore',
  })

  await createCalendarEvent(token, {
    summary: '🎹 Emma 钢琴比赛',
    start: dayOffset(5, 14, 0),
    end: dayOffset(5, 16, 0),
    description: '肖邦夜曲。你答应过会去看。比赛后全家晚饭。',
    location: 'Victoria Concert Hall, 11 Empress Pl',
  })

  await createCalendarEvent(token, {
    summary: '全家晚饭庆祝 Emma 比赛',
    start: dayOffset(5, 18, 30),
    end: dayOffset(5, 20, 30),
    description: '不管比赛结果如何，全家一起庆祝。',
    location: 'Imperial Treasure, Great World, 1 Kim Seng Promenade',
  })

  // ═══════════════════════════════════
  // NEXT WEEK (Tokyo trip + more)
  // ═══════════════════════════════════
  console.log('\n📧 Sending NEXT WEEK emails...')

  await sendEmail(token, TO, 'FYI: Competitor Launch - Great Eastern AI Platform',
    `Hi,\n\nHeads up - Great Eastern just announced their AI-powered insurance advisory platform at InsurTech Asia today. Initial coverage looks positive.\n\nKey features they announced:\n- AI underwriting assistant\n- Real-time risk scoring\n- Multi-language support (EN/ZH/MS/TA)\n\nThis is directly in our space. Should we prepare a competitive response? Happy to brief the team.\n\nSophie`)

  await sendEmail(token, TO, 'Tokyo Trip: Nomura Dinner Confirmed',
    `Hi,\n\nNomura confirmed dinner for Monday April 7 at Sukiyabashi Jiro (Roppongi Hills location). Party of 4.\n\nAttendees:\n- Tanaka-san (MD, Insurance Division)\n- Yamamoto-san (VP, Digital Innovation)\n- You\n- Me (taking notes)\n\nDress code: Business casual. Tanaka-san prefers omakase, I've pre-ordered.\n\nAlso, I booked a pocket wifi for the trip. Pick up at Changi T3.\n\nSophie`)

  await sendEmail(token, TO, 'Investor Update Draft - Q1 2026',
    `Hi,\n\nI've drafted the Q1 investor update letter. Key metrics:\n\n- ARR: $4.2M (+18% QoQ)\n- Net Revenue Retention: 127%\n- Runway: 18 months at current burn\n- New logos: 7 (including AIA and Prudential in pipeline)\n\nInvestors will want to know about the APAC expansion plan and when we expect breakeven. I've added a section but need your strategic commentary.\n\nTarget send date: April 15.\n\nSophie`)

  console.log('\n📅 Creating NEXT WEEK events (Tokyo trip)...')

  await createCalendarEvent(token, {
    summary: '✈️ Fly to Tokyo - SQ638',
    start: dayOffset(6, 8, 25),
    end: dayOffset(6, 16, 25),
    description: 'Singapore → Tokyo Narita. SQ638. Check in: Aman Tokyo.',
    location: 'Changi Airport Terminal 3',
  })

  await createCalendarEvent(token, {
    summary: 'Board Meeting (Remote from Tokyo)',
    start: dayOffset(6, 9, 0), // overlaps with flight - conflict!
    end: dayOffset(6, 11, 0),
    description: 'Q1 board meeting. You\'ll need to present CEO update remotely if in-flight WiFi works.',
  })

  await createCalendarEvent(token, {
    summary: '🍣 Dinner with Nomura Team',
    start: dayOffset(6, 19, 0),
    end: dayOffset(6, 21, 0),
    description: 'Sukiyabashi Jiro, Roppongi Hills. Tanaka-san + Yamamoto-san. Omakase pre-ordered.',
    location: 'Sukiyabashi Jiro, Roppongi Hills, Tokyo',
  })

  await createCalendarEvent(token, {
    summary: 'Tokio Marine HQ - Full Day Meetings',
    start: dayOffset(7, 9, 0),
    end: dayOffset(7, 17, 0),
    description: 'Strategy partnership discussion. Product demo at 2pm. Bring laptop.',
    location: 'Tokio Marine Holdings, 1-2-1 Marunouchi, Chiyoda, Tokyo',
  })

  await createCalendarEvent(token, {
    summary: 'Sony Financial Presentation',
    start: dayOffset(8, 9, 30),
    end: dayOffset(8, 11, 30),
    description: 'Present our platform capabilities to Sony Financial Group.',
    location: 'Sony City, 1-7-1 Konan, Minato, Tokyo',
  })

  await createCalendarEvent(token, {
    summary: '🛍️ Free Afternoon - Tokyo',
    start: dayOffset(8, 14, 0),
    end: dayOffset(8, 18, 0),
    description: 'Free time. Emma asked for a Pokémon plush from Pokémon Center Mega Tokyo.',
    location: 'Sunshine City, Ikebukuro, Tokyo',
  })

  await createCalendarEvent(token, {
    summary: 'Breakfast Meeting - Dai-ichi Life',
    start: dayOffset(9, 8, 0),
    end: dayOffset(9, 9, 30),
    description: 'Discuss distribution partnership for Japan market.',
    location: 'Aman Tokyo Lounge',
  })

  await createCalendarEvent(token, {
    summary: '✈️ Fly back to Singapore - SQ637',
    start: dayOffset(9, 13, 30),
    end: dayOffset(9, 19, 30),
    description: 'Tokyo → Singapore. SQ637. Land 7:30pm.',
    location: 'Narita International Airport',
  })

  // ═══════════════════════════════════
  // WEEK AFTER (post-trip)
  // ═══════════════════════════════════
  console.log('\n📧 Sending WEEK AFTER emails...')

  await sendEmail(token, TO, '太太生日 - Capella Sentosa 已预订',
    `Hi,\n\n已帮你订好 Capella Sentosa 4月12-13日，Manor Suite，含双人 Spa 和烛光晚餐。\n\n总费用 $1,850。你太太之前提过想去那里的 Cassia 餐厅吃粤菜。\n\nEmma 那天可以让外婆看一天。\n\nSophie`)

  await sendEmail(token, TO, 'Follow-up: Tokio Marine Partnership Terms',
    `Hi,\n\nAfter our meetings in Tokyo, Tokio Marine sent over their proposed partnership terms:\n\n- Joint venture for Japan market\n- Initial investment: $2M from each side\n- Revenue share: 50/50\n- Exclusivity: 3 years Japan market\n- They want an answer by April 20\n\nThis is a big decision. Should I set up a strategy session with the leadership team next week?\n\nSophie`)

  await sendEmail(token, TO, 'RE: Hiring Update - 3 Offers Pending',
    `Hi,\n\nRecruiting update:\n\n1. James Liu (Senior Engineer) - Offer sent, waiting for response. Competing offer from Grab.\n2. Amanda Koh (Product Manager) - Second round scheduled for April 14\n3. Kevin Ng (Data Scientist) - Reference checks complete, ready to extend offer\n\nJames is our top priority. His current package is $18K/month. Our offer is $20K. Grab is offering $22K + sign-on. Should we match?\n\nSophie`)

  console.log('\n📅 Creating WEEK AFTER events...')

  await createCalendarEvent(token, {
    summary: '💕 太太生日 - Capella Sentosa',
    start: dayOffset(11, 14, 0),
    end: dayOffset(12, 12, 0),
    description: 'Manor Suite. 包含 Spa + 烛光晚餐。Emma 在外婆家。',
    location: 'Capella Singapore, 1 The Knolls, Sentosa Island',
  })

  await createCalendarEvent(token, {
    summary: 'Leadership Strategy Session - Tokio Marine JV',
    start: dayOffset(13, 10, 0),
    end: dayOffset(13, 12, 0),
    description: 'Discuss Tokio Marine joint venture terms. $2M investment decision. Need answer by Apr 20.',
  })

  await createCalendarEvent(token, {
    summary: 'Investor Update Call - Series A Investors',
    start: dayOffset(13, 15, 0),
    end: dayOffset(13, 16, 0),
    description: 'Quarterly update call. Present Q1 metrics, APAC expansion, and Japan partnership opportunity.',
  })

  await createCalendarEvent(token, {
    summary: 'Performance Reviews Due',
    start: dayOffset(14, 9, 0),
    end: dayOffset(14, 9, 30),
    description: 'DEADLINE: Submit reviews for Sarah, Michael, Lisa. HR will delay promotions if late.',
  })

  await createCalendarEvent(token, {
    summary: 'Family Movie Night 🎬',
    start: dayOffset(14, 19, 0),
    end: dayOffset(14, 21, 30),
    description: 'Emma\'s pick this week. She wants to watch the new Pixar movie.',
    location: 'GV VivoCity, 1 HarbourFront Walk',
  })

  console.log('\n✅ All done! Emails and calendar events created.')
}

main().catch(console.error)
