export const BRIEFING_SYSTEM = `You are an AI Chief of Staff — a trusted executive assistant who delivers a concise, warm morning briefing.

Rules:
- Write 3-5 sentences maximum
- Be specific: mention names, subjects, deadlines, meeting titles
- Prioritize what matters most TODAY — urgent tasks first, then meetings, then emails
- If there are overdue follow-ups, flag them with urgency
- Write in the same language the user's emails/calendar are in (detect automatically)
- Be warm but efficient, like a trusted human assistant — not robotic
- Never say "Here is your briefing" or similar meta-commentary — just deliver the content
- If there is very little data, keep it shorter (1-2 sentences). Don't pad.
- Use natural time references ("your 10am call with Sarah", not "calendar_events[0]")
- When contact relationship info is available, use it naturally: "Priya (client, VIP) sent...", "Your boss Alex needs..."
- Prioritize VIP and high-importance contacts in the briefing`

export function buildBriefingUserPrompt(context: {
  todayEvents: Array<{ title: string; start_time: string; end_time: string; attendees?: any; location?: string }>
  pendingTasks: Array<{ title: string; priority: number; due_date?: string; due_reason?: string }>
  emailsNeedReply: Array<{ from_name?: string; from_address: string; subject: string; reply_urgency?: number; contact_relationship?: string; contact_importance?: string; contact_company?: string }>
  overdueFollowUps: Array<{ contact_name?: string; contact_email: string; subject: string; due_date?: string; contact_relationship?: string; contact_importance?: string }>
  recentEmails: Array<{ from_name?: string; from_address: string; subject: string; received_at: string }>
  todayDate: string
  timezone: string
}): string {
  const { todayEvents, pendingTasks, emailsNeedReply, overdueFollowUps, recentEmails, todayDate, timezone } = context

  const parts: string[] = [`Today is ${todayDate}. User timezone: ${timezone}.`]

  // Calendar
  if (todayEvents.length > 0) {
    parts.push(`\n--- Today's Meetings (${todayEvents.length}) ---`)
    for (const e of todayEvents) {
      const start = new Date(e.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone })
      const end = new Date(e.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone })
      const attendees = Array.isArray(e.attendees) ? e.attendees.map((a: any) => a.displayName || a.email || a).join(', ') : ''
      parts.push(`- ${start}–${end}: "${e.title}"${attendees ? ` with ${attendees}` : ''}${e.location ? ` at ${e.location}` : ''}`)
    }
  } else {
    parts.push('\n--- No meetings today ---')
  }

  // Tasks
  if (pendingTasks.length > 0) {
    parts.push(`\n--- Top Pending Tasks (${pendingTasks.length}) ---`)
    const priorityLabel: Record<number, string> = { 1: 'URGENT', 2: 'This week', 3: 'Later' }
    for (const t of pendingTasks) {
      parts.push(`- [${priorityLabel[t.priority] || 'Normal'}] ${t.title}${t.due_date ? ` (due: ${t.due_date})` : ''}${t.due_reason ? ` — ${t.due_reason}` : ''}`)
    }
  }

  // Emails needing reply
  if (emailsNeedReply.length > 0) {
    parts.push(`\n--- Emails Needing Reply (${emailsNeedReply.length}) ---`)
    for (const e of emailsNeedReply) {
      const contactCtx = e.contact_relationship
        ? ` [${e.contact_relationship}${e.contact_importance === 'vip' ? ', VIP' : e.contact_importance === 'high' ? ', important' : ''}${e.contact_company ? ` @ ${e.contact_company}` : ''}]`
        : ''
      parts.push(`- From ${e.from_name || e.from_address}${contactCtx}: "${e.subject}" (urgency: ${e.reply_urgency || 'normal'})`)
    }
  }

  // Overdue follow-ups
  if (overdueFollowUps.length > 0) {
    parts.push(`\n--- OVERDUE Follow-ups (${overdueFollowUps.length}) ---`)
    for (const f of overdueFollowUps) {
      const contactCtx = f.contact_relationship
        ? ` [${f.contact_relationship}${f.contact_importance === 'vip' ? ', VIP' : ''}]`
        : ''
      parts.push(`- ${f.contact_name || f.contact_email}${contactCtx}: "${f.subject}" (was due: ${f.due_date || 'no date'})`)
    }
  }

  // Recent important emails
  if (recentEmails.length > 0) {
    parts.push(`\n--- Recent Emails (last 24h, ${recentEmails.length}) ---`)
    for (const e of recentEmails.slice(0, 5)) {
      parts.push(`- From ${e.from_name || e.from_address}: "${e.subject}"`)
    }
  }

  // Edge case: completely empty
  if (todayEvents.length === 0 && pendingTasks.length === 0 && emailsNeedReply.length === 0 && overdueFollowUps.length === 0 && recentEmails.length === 0) {
    parts.push('\nNo data synced yet. Write a brief message encouraging the user to sync their Gmail and Calendar.')
  }

  return parts.join('\n')
}
