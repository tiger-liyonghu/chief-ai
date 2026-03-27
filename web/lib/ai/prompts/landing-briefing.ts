export const LANDING_BRIEFING_SYSTEM = `You are an AI Chief of Staff delivering a "You've Landed" briefing to a busy executive who just arrived at their destination.

Rules:
- Write 3-5 sentences maximum
- Be warm, concise, and action-oriented — like a trusted human assistant greeting you at the airport
- Start with a welcome to the city and the local time + timezone difference from home
- Mention the next meeting with approximate travel time from the airport if available
- Highlight urgent items: emails that need replies, overdue follow-ups, critical tasks
- If there are meetings today, mention the first one prominently
- Use natural language: "You have 45 minutes before your 4:30 PM with Deepak" not "calendar_events[0]"
- Never say "Here is your briefing" or similar meta-commentary — just deliver the content
- When contact relationship info is available, use it naturally
- If little data is available, keep it to 1-2 sentences. Don't pad.
- Include practical info: timezone difference, any important cultural notes for the destination`

export const TRIP_REPORT_SYSTEM = `You are an AI Chief of Staff generating a structured post-trip report for a busy executive.

Rules:
- Write a concise executive summary (3-5 sentences) covering the trip's key outcomes
- Be specific: mention names, decisions, amounts, next steps
- Organize information clearly under structured headings
- For meetings, extract outcomes and action items where possible from context
- For follow-ups, be specific about who, what, and when
- Highlight any items that need immediate attention post-trip
- If expense data is available, summarize by category
- Write in a professional but warm tone
- Never pad content — if data is sparse, keep the report brief`

export function buildLandingBriefingPrompt(context: {
  destination_city: string | null
  destination_country: string | null
  trip_start: string
  trip_end: string
  home_timezone: string
  destination_timezone: string
  todayMeetings: Array<{ title: string; start_time: string; end_time: string; attendees?: any; location?: string }>
  emailsSinceDeparture: Array<{ from_name?: string; from_address: string; subject: string; is_reply_needed?: boolean; reply_urgency?: number }>
  pendingTasks: Array<{ title: string; priority: number; due_date?: string }>
  followUps: Array<{ contact_name?: string; contact_email: string; subject: string; due_date?: string }>
  currentLocalTime: string
}): string {
  const parts: string[] = []

  parts.push(`Destination: ${context.destination_city || 'Unknown'}${context.destination_country ? `, ${context.destination_country}` : ''}`)
  parts.push(`Trip dates: ${context.trip_start} to ${context.trip_end}`)
  parts.push(`Home timezone: ${context.home_timezone}`)
  parts.push(`Destination timezone: ${context.destination_timezone}`)
  parts.push(`Current local time at destination: ${context.currentLocalTime}`)

  // Today's meetings
  if (context.todayMeetings.length > 0) {
    parts.push(`\n--- Today's Meetings at Destination (${context.todayMeetings.length}) ---`)
    for (const m of context.todayMeetings) {
      const start = new Date(m.start_time).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
        timeZone: context.destination_timezone,
      })
      const attendees = Array.isArray(m.attendees)
        ? m.attendees.map((a: any) => a.displayName || a.email || a).join(', ')
        : ''
      parts.push(`- ${start}: "${m.title}"${attendees ? ` with ${attendees}` : ''}${m.location ? ` at ${m.location}` : ''}`)
    }
  } else {
    parts.push('\n--- No meetings scheduled today at destination ---')
  }

  // Emails since departure
  if (context.emailsSinceDeparture.length > 0) {
    const needReply = context.emailsSinceDeparture.filter(e => e.is_reply_needed)
    parts.push(`\n--- Emails Since Departure (${context.emailsSinceDeparture.length} total, ${needReply.length} need reply) ---`)
    for (const e of needReply.slice(0, 5)) {
      parts.push(`- From ${e.from_name || e.from_address}: "${e.subject}" (urgency: ${e.reply_urgency || 'normal'})`)
    }
    if (context.emailsSinceDeparture.length > needReply.length) {
      parts.push(`- Plus ${context.emailsSinceDeparture.length - needReply.length} other emails`)
    }
  } else {
    parts.push('\n--- No new emails since departure ---')
  }

  // Pending tasks
  if (context.pendingTasks.length > 0) {
    parts.push(`\n--- Pending Tasks (${context.pendingTasks.length}) ---`)
    const priorityLabel: Record<number, string> = { 1: 'URGENT', 2: 'This week', 3: 'Later' }
    for (const t of context.pendingTasks.slice(0, 5)) {
      parts.push(`- [${priorityLabel[t.priority] || 'Normal'}] ${t.title}${t.due_date ? ` (due: ${t.due_date})` : ''}`)
    }
  }

  // Follow-ups
  if (context.followUps.length > 0) {
    parts.push(`\n--- Follow-ups with Contacts (${context.followUps.length}) ---`)
    for (const f of context.followUps.slice(0, 5)) {
      parts.push(`- ${f.contact_name || f.contact_email}: "${f.subject}"${f.due_date ? ` (due: ${f.due_date})` : ''}`)
    }
  }

  return parts.join('\n')
}

export function buildTripReportPrompt(context: {
  destination_city: string | null
  destination_country: string | null
  trip_start: string
  trip_end: string
  meetings: Array<{ title: string; start_time: string; end_time: string; attendees?: any; location?: string }>
  tasks: Array<{ title: string; priority: number; status: string; due_date?: string }>
  followUps: Array<{ contact_name?: string; contact_email: string; subject: string; type: string; due_date?: string }>
  expenses: Array<{ category: string; merchant_name?: string; amount: number; currency: string }>
  emailsDuringTrip: Array<{ from_name?: string; from_address: string; subject: string; snippet?: string }>
}): string {
  const parts: string[] = []

  parts.push(`Trip: ${context.destination_city || 'Unknown'}${context.destination_country ? `, ${context.destination_country}` : ''}`)
  parts.push(`Dates: ${context.trip_start} to ${context.trip_end}`)

  // Meetings
  if (context.meetings.length > 0) {
    parts.push(`\n--- Meetings During Trip (${context.meetings.length}) ---`)
    for (const m of context.meetings) {
      const date = new Date(m.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      const time = new Date(m.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      const attendees = Array.isArray(m.attendees)
        ? m.attendees.map((a: any) => a.displayName || a.email || a).join(', ')
        : ''
      parts.push(`- ${date} ${time}: "${m.title}"${attendees ? ` with ${attendees}` : ''}${m.location ? ` at ${m.location}` : ''}`)
    }
  }

  // Tasks created during trip
  if (context.tasks.length > 0) {
    parts.push(`\n--- Tasks (${context.tasks.length}) ---`)
    for (const t of context.tasks) {
      parts.push(`- [${t.status}] ${t.title}${t.due_date ? ` (due: ${t.due_date})` : ''}`)
    }
  }

  // Follow-ups
  if (context.followUps.length > 0) {
    parts.push(`\n--- Follow-ups (${context.followUps.length}) ---`)
    for (const f of context.followUps) {
      parts.push(`- ${f.contact_name || f.contact_email}: "${f.subject}" [${f.type}]${f.due_date ? ` (due: ${f.due_date})` : ''}`)
    }
  }

  // Expenses
  if (context.expenses.length > 0) {
    const total = context.expenses.reduce((s, e) => s + e.amount, 0)
    const currency = context.expenses[0]?.currency || 'SGD'
    parts.push(`\n--- Expenses (${context.expenses.length} items, total: ${currency} ${total.toFixed(2)}) ---`)
    const byCategory: Record<string, number> = {}
    for (const e of context.expenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount
    }
    for (const [cat, amt] of Object.entries(byCategory)) {
      parts.push(`- ${cat}: ${currency} ${amt.toFixed(2)}`)
    }
  }

  // Key emails during trip
  if (context.emailsDuringTrip.length > 0) {
    parts.push(`\n--- Key Emails During Trip (${context.emailsDuringTrip.length}) ---`)
    for (const e of context.emailsDuringTrip.slice(0, 10)) {
      parts.push(`- From ${e.from_name || e.from_address}: "${e.subject}"`)
    }
  }

  return parts.join('\n')
}
