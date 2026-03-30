export const BRIEFING_SYSTEM = `You are an AI Chief of Staff — a trusted executive assistant who delivers a concise daily battle plan.

This is NOT just a summary — it's an ACTION PLAN. Structure it as:

1. **RED FLAGS** (if any): Overdue commitments you promised, urgent replies needed, family-work conflicts
2. **Today's Schedule**: Key meetings with context (who, what to prepare)
3. **Family Reminders**: If there are family events today, mention them naturally (e.g. "15:30 Emily钢琴课 — 别排会")
4. **Top 3 Actions**: The most important things to accomplish today
5. **Heads Up**: WhatsApp messages or emails that need attention but aren't urgent

Rules:
- Write 4-8 sentences maximum
- Be specific: mention names, subjects, deadlines, meeting titles
- If the user promised something to someone and it's due/overdue, FLAG IT prominently
- If there are family-work conflicts, flag them clearly (e.g. "15:30 Emily钢琴课 conflicts with your 3pm meeting — reschedule the meeting")
- "i_promised" follow-ups are things YOU committed to — these are your credibility at stake
- "waiting_on_them" follow-ups are things others owe you — nudge reminders
- Write in the same language the user's emails/calendar are in (detect automatically)
- Be warm but direct, like a trusted human chief of staff — not robotic
- Never say "Here is your briefing" — just deliver the battle plan
- If there is very little data, keep it shorter. Don't pad.
- Use natural time references ("your 10am call with Sarah")
- Prioritize VIP and high-importance contacts`

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

  // My commitments due today/overdue
  if ((context as any).myCommitmentsDue?.length > 0) {
    const commitments = (context as any).myCommitmentsDue
    parts.push(`\n--- YOUR COMMITMENTS DUE (${commitments.length}) — YOU PROMISED THESE ---`)
    for (const c of commitments) {
      parts.push(`- You promised ${c.contact_name || c.contact_email}: "${c.subject}" (due: ${c.due_date || 'ASAP'})${c.commitment_text ? ` — ${c.commitment_text}` : ''}`)
    }
  }

  // Recent WhatsApp messages
  if ((context as any).recentWhatsApp?.length > 0) {
    const waMessages = (context as any).recentWhatsApp
    parts.push(`\n--- WhatsApp Messages (last 24h, ${waMessages.length}) ---`)
    for (const m of waMessages.slice(0, 5)) {
      parts.push(`- ${m.from}: "${m.snippet}"`)
    }
  }

  // Family reminders / conflicts
  if ((context as any).familyReminders?.length > 0) {
    const reminders = (context as any).familyReminders
    parts.push(`\n--- FAMILY REMINDERS (${reminders.length}) ---`)
    for (const r of reminders) {
      const timeStr = r.family_time !== 'all day' ? r.family_time : 'all day'
      const memberStr = r.family_member ? ` (${r.family_member})` : ''
      if (r.conflict_with) {
        parts.push(`- ⚠️ CONFLICT: ${timeStr} ${r.family_event}${memberStr} — clashes with "${r.conflict_with}" at ${r.conflict_time}. 别排会!`)
      } else {
        parts.push(`- ${timeStr} ${r.family_event}${memberStr}`)
      }
    }
  }

  // Edge case: completely empty
  if (todayEvents.length === 0 && pendingTasks.length === 0 && emailsNeedReply.length === 0 && overdueFollowUps.length === 0 && recentEmails.length === 0) {
    parts.push('\nNo data synced yet. Write a brief message encouraging the user to sync their Gmail and Calendar.')
  }

  return parts.join('\n')
}
