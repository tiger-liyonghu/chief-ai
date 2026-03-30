/**
 * Seed Data Generator for Chief Testing
 * 3 Virtual Personas with realistic data patterns
 */

// ─── Persona Definitions ───

export const PERSONAS = {
  jason: {
    id: 'test-jason-001',
    email: 'jason@finpay.sg',
    full_name: 'Jason Lee',
    timezone: 'Asia/Singapore',
    language: 'en',
    plan: 'pro',
  },
  priya: {
    id: 'test-priya-002',
    email: 'priya@cloudhq.in',
    full_name: 'Priya Sharma',
    timezone: 'Asia/Kolkata',
    language: 'en',
    plan: 'pro',
  },
  thomas: {
    id: 'test-thomas-003',
    email: 'thomas@consulting.de',
    full_name: 'Thomas Mueller',
    timezone: 'Europe/Berlin',
    language: 'en',
    plan: 'executive',
  },
} as const

// ─── Contacts ───

export function generateContacts(personaId: string) {
  const shared = [
    { name: 'Ben Wilson', email: 'ben@sequoia.com', company: 'Sequoia', role: 'Partner', relationship: 'investor', importance: 'vip' },
    { name: 'David Chen', email: 'david@grab.com', company: 'Grab', role: 'VP Engineering', relationship: 'partner', importance: 'high' },
  ]

  const perPersona: Record<string, Array<Record<string, string>>> = {
    'test-jason-001': [
      { name: 'Zhang Wei', email: 'zhangwei@cimb.com', company: 'CIMB', role: 'MD', relationship: 'client', importance: 'vip' },
      { name: 'Li Ming', email: 'liming@maybank.com', company: 'Maybank', role: 'MD Investment Banking', relationship: 'client', importance: 'vip' },
      { name: 'Sarah Lee', email: 'sarah@finpay.sg', company: 'FinPay', role: 'COO', relationship: 'team', importance: 'high' },
      { name: 'Ahmad Razak', email: 'ahmad@grabpay.my', company: 'GrabPay MY', role: 'Director', relationship: 'partner', importance: 'normal' },
      { name: 'Rina Wijaya', email: 'rina@gojek.id', company: 'Gojek', role: 'Head of Partnerships', relationship: 'partner', importance: 'normal' },
      { name: 'Emily Lee', email: '', company: '', role: '', relationship: 'personal', importance: 'vip' },
    ],
    'test-priya-002': [
      { name: 'Rajesh Gupta', email: 'rajesh@infosys.com', company: 'Infosys', role: 'CTO', relationship: 'client', importance: 'vip' },
      { name: 'Sanjay Patel', email: 'sanjay@tcs.com', company: 'TCS', role: 'VP', relationship: 'client', importance: 'high' },
      { name: 'Meera Singh', email: 'meera@cloudhq.in', company: 'CloudHQ', role: 'CEO', relationship: 'boss', importance: 'vip' },
      { name: 'Amir Khan', email: 'amir@dubaitech.ae', company: 'DubaiTech', role: 'Director', relationship: 'client', importance: 'normal' },
    ],
    'test-thomas-003': [
      { name: 'Hans Schmidt', email: 'hans@siemens.de', company: 'Siemens', role: 'SVP', relationship: 'client', importance: 'vip' },
      { name: 'Marie Dupont', email: 'marie@bnp.fr', company: 'BNP Paribas', role: 'MD', relationship: 'client', importance: 'vip' },
      { name: 'James Wright', email: 'james@mckinsey.com', company: 'McKinsey', role: 'Partner', relationship: 'team', importance: 'high' },
      { name: 'Katrin Mueller', email: 'katrin@gmail.com', company: '', role: '', relationship: 'personal', importance: 'vip' },
    ],
  }

  return [...shared, ...(perPersona[personaId] || [])].map(c => ({
    ...c,
    user_id: personaId,
    auto_detected: false,
    email_count: Math.floor(Math.random() * 50) + 5,
    last_contact_at: randomDate(30),
  }))
}

// ─── Emails (with commitment patterns) ───

export function generateEmails(personaId: string) {
  const emails: Array<Record<string, unknown>> = []

  // Commitment emails (should be extracted)
  const commitmentEmails = [
    // i_promised - explicit
    { subject: 'Re: Partnership proposal', from: 'david@grab.com', from_name: 'David Chen', snippet: "Thanks David, I'll send you the revised proposal by Friday. Let me also loop in Sarah for the technical details.", is_outbound: true, has_commitment: true, commitment_type: 'i_promised', commitment_title: 'Send revised proposal to David', deadline: fridayDate() },
    { subject: 'Re: Q2 Report', from: 'ben@sequoia.com', from_name: 'Ben Wilson', snippet: "Hi Ben, I will send you the monthly update by Wednesday. Numbers are looking good this quarter.", is_outbound: true, has_commitment: true, commitment_type: 'i_promised', commitment_title: 'Send monthly update to Ben', deadline: wednesdayDate() },
    { subject: 'Contract review', from: 'zhangwei@cimb.com', from_name: 'Zhang Wei', snippet: "Zhang Zong, I'll get the revised contract back to you by end of tomorrow. My legal team is reviewing the indemnity clause.", is_outbound: true, has_commitment: true, commitment_type: 'i_promised', commitment_title: 'Return revised contract to Zhang Wei', deadline: tomorrowDate() },

    // i_promised - implicit
    { subject: 'Re: Demo setup', from: 'ahmad@grabpay.my', from_name: 'Ahmad Razak', snippet: "Got it Ahmad, I'm on it. Will have the demo environment ready before our call.", is_outbound: true, has_commitment: true, commitment_type: 'i_promised', commitment_title: 'Prepare demo environment for Ahmad', deadline: null },

    // they_promised
    { subject: 'Re: Term sheet', from: 'liming@maybank.com', from_name: 'Li Ming', snippet: "Jason, we will get the term sheet to you by next Tuesday. Our legal team is finalizing the terms. Looking forward to working together.", is_outbound: false, has_commitment: true, commitment_type: 'they_promised', commitment_title: 'Li Ming to send term sheet', deadline: nextTuesdayDate() },
    { subject: 'Re: Introduction to CFO', from: 'liming@maybank.com', from_name: 'Li Ming', snippet: "Sure, I'll introduce you to our CFO next week. Let me check her calendar and get back to you.", is_outbound: false, has_commitment: true, commitment_type: 'they_promised', commitment_title: 'Li Ming to introduce CFO', deadline: null },
    { subject: 'NDA status', from: 'rina@gojek.id', from_name: 'Rina Wijaya', snippet: "Hi Jason, our legal will send the signed NDA back by Thursday. Sorry for the delay.", is_outbound: false, has_commitment: true, commitment_type: 'they_promised', commitment_title: 'Rina to return signed NDA', deadline: thursdayDate() },

    // i_promised - Chinese
    { subject: 'Re: 合作方案', from: 'zhangwei@cimb.com', from_name: 'Zhang Wei', snippet: "张总放心，方案我周三前发给您。上次讨论的几个点我都加进去了。", is_outbound: true, has_commitment: true, commitment_type: 'i_promised', commitment_title: 'Send proposal to Zhang Wei', deadline: wednesdayDate() },

    // i_promised - mixed language
    { subject: 'Re: Project timeline', from: 'sarah@finpay.sg', from_name: 'Sarah Lee', snippet: "Sarah, the roadmap deck 我 Friday 前 update 好发给你，今天先把 sprint planning 搞完。", is_outbound: true, has_commitment: true, commitment_type: 'i_promised', commitment_title: 'Update roadmap deck for Sarah', deadline: fridayDate() },

    // family
    { subject: '', from: '', from_name: 'WhatsApp', snippet: "Emily asked if we can go to the zoo this Saturday. I said yes!", is_outbound: false, has_commitment: true, commitment_type: 'family', commitment_title: 'Take Emily to zoo on Saturday', deadline: saturdayDate() },
  ]

  // Non-commitment emails (should NOT be extracted)
  const nonCommitmentEmails = [
    { subject: 'FYI: Board meeting notes', from: 'sarah@finpay.sg', from_name: 'Sarah Lee', snippet: "Hi team, attached are the board meeting notes from yesterday. Key decisions highlighted in yellow.", is_outbound: false, has_commitment: false },
    { subject: 'Thank you!', from: 'ahmad@grabpay.my', from_name: 'Ahmad Razak', snippet: "Thanks for the great meeting yesterday Jason. Really appreciate your insights on the payment flow.", is_outbound: false, has_commitment: false },
    { subject: 'FinTech Asia Newsletter', from: 'newsletter@fintechasia.com', from_name: 'FinTech Asia', snippet: "This week in FinTech: New regulations in Singapore, Grab's Q3 results, and more.", is_outbound: false, has_commitment: false },
    { subject: 'Out of Office', from: 'liming@maybank.com', from_name: 'Li Ming', snippet: "I am currently out of the office and will return on Monday. For urgent matters, please contact my assistant.", is_outbound: false, has_commitment: false },
    { subject: 'Happy Birthday!', from: 'david@grab.com', from_name: 'David Chen', snippet: "Happy birthday Jason! Hope you have a great day. Let's catch up soon over coffee.", is_outbound: false, has_commitment: false },
    { subject: 'Meeting confirmed', from: 'calendar@google.com', from_name: 'Google Calendar', snippet: "Your meeting with Li Ming on Tuesday at 10:00 AM has been confirmed.", is_outbound: false, has_commitment: false },
    { subject: 'AWS billing alert', from: 'no-reply@aws.com', from_name: 'AWS', snippet: "Your estimated charges for this billing period are $1,234.56.", is_outbound: false, has_commitment: false },

    // Tricky non-commitments (might cause false positives)
    { subject: 'Re: Collaboration', from: 'david@grab.com', from_name: 'David Chen', snippet: "I would be happy to help if you ever need anything. Just let me know!", is_outbound: false, has_commitment: false },
    { subject: 'Re: Catch up', from: 'rina@gojek.id', from_name: 'Rina Wijaya', snippet: "Looking forward to hearing from you. Let me know if you need anything else.", is_outbound: false, has_commitment: false },
    { subject: 'Summary of discussion', from: 'sarah@finpay.sg', from_name: 'Sarah Lee', snippet: "As discussed in today's meeting, here's a summary of the key points we covered.", is_outbound: false, has_commitment: false },
  ]

  // Generate email records
  const allEmails = [...commitmentEmails, ...nonCommitmentEmails]
  for (let i = 0; i < allEmails.length; i++) {
    const e = allEmails[i]
    emails.push({
      user_id: personaId,
      from_address: e.is_outbound ? PERSONAS.jason.email : e.from,
      from_name: e.is_outbound ? PERSONAS.jason.full_name : e.from_name,
      to_address: e.is_outbound ? e.from : PERSONAS.jason.email,
      subject: e.subject,
      snippet: e.snippet,
      date: randomDate(7),
      is_outbound: e.is_outbound || false,
      is_read: true,
      commitment_scanned: false,
      // Test metadata (not stored in DB, used for evaluation)
      _test_has_commitment: e.has_commitment || false,
      _test_commitment_type: (e as Record<string, unknown>).commitment_type || null,
      _test_commitment_title: (e as Record<string, unknown>).commitment_title || null,
      _test_deadline: (e as Record<string, unknown>).deadline || null,
    })
  }

  return emails
}

// ─── Commitments (various states) ───

export function generateCommitments(personaId: string) {
  return [
    // Active - I promised
    { type: 'i_promised', contact_name: 'Ben Wilson', contact_email: 'ben@sequoia.com', title: 'Send monthly investor update', deadline: wednesdayDate(), status: 'pending', urgency_score: 7, source_type: 'email' },
    { type: 'i_promised', contact_name: 'David Chen', contact_email: 'david@grab.com', title: 'Send revised partnership proposal', deadline: fridayDate(), status: 'in_progress', urgency_score: 5, source_type: 'email' },
    { type: 'i_promised', contact_name: 'Zhang Wei', contact_email: 'zhangwei@cimb.com', title: 'Return revised contract', deadline: tomorrowDate(), status: 'pending', urgency_score: 8, source_type: 'email' },

    // Active - They promised
    { type: 'they_promised', contact_name: 'Li Ming', contact_email: 'liming@maybank.com', title: 'Send term sheet', deadline: nextTuesdayDate(), status: 'waiting', urgency_score: 4, source_type: 'email' },
    { type: 'they_promised', contact_name: 'Rina Wijaya', contact_email: 'rina@gojek.id', title: 'Return signed NDA', deadline: thursdayDate(), status: 'waiting', urgency_score: 3, source_type: 'email' },

    // Overdue
    { type: 'i_promised', contact_name: 'Sarah Lee', contact_email: 'sarah@finpay.sg', title: 'Update roadmap deck', deadline: pastDate(3), status: 'overdue', urgency_score: 9, source_type: 'email' },
    { type: 'they_promised', contact_name: 'Ahmad Razak', contact_email: 'ahmad@grabpay.my', title: 'Send integration API docs', deadline: pastDate(5), status: 'overdue', urgency_score: 6, source_type: 'whatsapp' },

    // Family
    { type: 'family', family_member: 'Emily', title: 'Take Emily to zoo on Saturday', deadline: saturdayDate(), status: 'pending', urgency_score: 6, source_type: 'manual' },
    { type: 'family', family_member: 'Family', title: 'Book Japan trip for summer holiday', deadline_fuzzy: 'Before end of May', status: 'pending', urgency_score: 3, source_type: 'manual' },

    // Done (for stats)
    { type: 'i_promised', contact_name: 'David Chen', contact_email: 'david@grab.com', title: 'Send Q1 metrics', status: 'done', urgency_score: 0, source_type: 'email', completed_at: pastDate(2) },
    { type: 'they_promised', contact_name: 'Ben Wilson', contact_email: 'ben@sequoia.com', title: 'Wire seed funding', status: 'done', urgency_score: 0, source_type: 'email', completed_at: pastDate(7) },
    { type: 'family', family_member: 'Ryan', title: 'Buy birthday present for Ryan', status: 'done', urgency_score: 0, source_type: 'manual', completed_at: pastDate(5) },
  ].map(c => ({ ...c, user_id: personaId }))
}

// ─── Family Calendar ───

export function generateFamilyCalendar(personaId: string) {
  return [
    // Hard constraints
    { event_type: 'hard_constraint', title: 'Emily piano lesson', description: 'Pick up Emily from piano', start_date: nextWeekday(3), start_time: '15:30', end_time: '16:30', recurrence: 'weekly', recurrence_day: 3, family_member: 'Emily', source: 'manual' },
    { event_type: 'hard_constraint', title: 'Ryan football practice', start_date: nextWeekday(6), start_time: '09:00', end_time: '10:30', recurrence: 'weekly', recurrence_day: 6, family_member: 'Ryan', source: 'manual' },
    { event_type: 'hard_constraint', title: 'Family dinner', start_date: nextWeekday(0), start_time: '18:00', recurrence: 'weekly', recurrence_day: 0, family_member: 'Family', source: 'manual' },

    // Important dates
    { event_type: 'important_date', title: 'Wedding anniversary', start_date: '2026-05-12', recurrence: 'yearly', family_member: 'Sarah', source: 'manual', remind_days_before: 7 },
    { event_type: 'important_date', title: "Ryan's birthday", start_date: '2026-07-15', recurrence: 'yearly', family_member: 'Ryan', source: 'manual', remind_days_before: 14 },
    { event_type: 'important_date', title: 'Dragon Boat Festival', start_date: '2026-06-19', family_member: 'Family', source: 'manual' },

    // School cycles
    { event_type: 'school_cycle', title: 'Summer holiday', start_date: '2026-06-15', end_date: '2026-08-15', family_member: 'Emily', source: 'manual', description: 'No long trips during school time, flexible during holidays' },
    { event_type: 'school_cycle', title: 'Final exam week', start_date: '2026-06-01', end_date: '2026-06-12', family_member: 'Emily', source: 'manual', description: 'Need quiet environment at home' },

    // Family commitments (from commitments table, mirrored here for conflict detection)
    { event_type: 'family_commitment', title: 'Zoo trip with Emily', start_date: saturdayDate(), family_member: 'Emily', source: 'manual' },
  ].map(fc => ({ ...fc, user_id: personaId, is_active: true }))
}

// ─── Trips ───

export function generateTrips(personaId: string) {
  return [
    {
      user_id: personaId,
      title: 'KL Client Meetings',
      destination_city: 'Kuala Lumpur',
      destination_country: 'Malaysia',
      start_date: futureDate(5),
      end_date: futureDate(7),
      status: 'upcoming',
      flight_info: JSON.stringify([
        { airline: 'Singapore Airlines', flight_no: 'SQ 118', departure: '08:30', arrival: '09:30', origin: 'SIN', destination: 'KUL', seat: '12C' },
        { airline: 'Singapore Airlines', flight_no: 'SQ 119', departure: '18:25', arrival: '19:25', origin: 'KUL', destination: 'SIN', seat: '12A' },
      ]),
      hotel_info: JSON.stringify([
        { name: 'Mandarin Oriental KL', confirmation: 'MO-28374', checkin: futureDate(5), checkout: futureDate(7), address: 'KLCC, Kuala Lumpur' },
      ]),
    },
    {
      user_id: personaId,
      title: 'Jakarta Investor Day',
      destination_city: 'Jakarta',
      destination_country: 'Indonesia',
      start_date: futureDate(14),
      end_date: futureDate(16),
      status: 'upcoming',
      flight_info: JSON.stringify([
        { airline: 'Singapore Airlines', flight_no: 'SQ 956', departure: '07:30', arrival: '08:25', origin: 'SIN', destination: 'CGK' },
      ]),
      hotel_info: JSON.stringify([
        { name: 'Mandarin Oriental Jakarta', confirmation: 'MO-39281' },
      ]),
    },
  ]
}

// ─── Date Helpers ───

function randomDate(withinDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() - Math.floor(Math.random() * withinDays))
  return d.toISOString()
}

function tomorrowDate(): string {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]
}

function wednesdayDate(): string { return nextWeekday(3) }
function thursdayDate(): string { return nextWeekday(4) }
function fridayDate(): string { return nextWeekday(5) }
function saturdayDate(): string { return nextWeekday(6) }

function nextTuesdayDate(): string {
  const d = new Date(); d.setDate(d.getDate() + 7); // next week
  while (d.getDay() !== 2) d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function nextWeekday(day: number): string {
  const d = new Date()
  while (d.getDay() !== day) d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function pastDate(daysAgo: number): string {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().split('T')[0]
}

function futureDate(daysAhead: number): string {
  const d = new Date(); d.setDate(d.getDate() + daysAhead); return d.toISOString().split('T')[0]
}
