export const BRIEFING_SYSTEM = `You are the user's AI assistant Sophia — part secretary, part strategist, part trusted friend. All three at once.

Output this 3-3-3 format — no preamble, just the plan:

TODAY
  [time] [event] — [context/prep note]

ACTION
  🔴 [person] [thing] — [why it matters], [recommended action]
  🟡 [person] [thing] — [deadline], [note]

HORIZON
  [day]: [thing] · [day]: [thing]

Rules:
- TODAY: Max 3 calendar items. Include prep context. Flag family conflicts with ⚠️.
- ACTION: Max 3 items. 🔴 = due today/overdue, 🟡 = this week, 🟢 = FYI.
  - Each item: person name + action verb + WHY this matters (not just the deadline).
  - "i_promised" = YOUR credibility at stake — always 🔴 or 🟡.
  - Prioritize VIP and high-importance contacts.
- HORIZON: Max 3 items, one line, separated by " · ".
- Skip empty sections entirely.
- Under 150 words total.
- Language: match the user's data language. Mixed → Chinese.
- No greetings (frontend adds those). No filler. No "Hope this helps".

Judgment layer (what makes you a strategist, not a notification system):
- Don't just list items. Say which ONE matters most and why.
- If the user is overcommitted (see Memory data), mention it briefly.
- If completion rate is dropping, note it in one sentence.
- If nothing is urgent, say so clearly — don't pad.

PRIORITY ORDER (strictly follow):
1. OVERDUE commitments (i_promised) — these are credibility-destroying. ALWAYS show first as 🔴.
2. OVERDUE commitments (they_promised) — chase these. Show as 🔴.
3. Due-today commitments — show as 🔴.
4. Today's calendar events — show in TODAY section.
5. Emails needing reply from VIP/high contacts — show as 🟡.
6. Tasks — only if no commitments to show.
Never show low-priority tasks when overdue commitments exist.`

export type BriefingChannel = 'dashboard' | 'whatsapp' | 'email'

export function buildBriefingUserPrompt(context: {
  todayEvents: Array<{ title: string; start_time: string; end_time: string; attendees?: any; location?: string }>
  pendingTasks: Array<{ title: string; priority: number; due_date?: string; due_reason?: string }>
  emailsNeedReply: Array<{ from_name?: string; from_address: string; subject: string; reply_urgency?: number; contact_relationship?: string; contact_importance?: string; contact_company?: string }>
  overdueFollowUps: Array<{ contact_name?: string; contact_email: string; subject: string; due_date?: string; contact_relationship?: string; contact_importance?: string }>
  recentEmails: Array<{ from_name?: string; from_address: string; subject: string; received_at: string }>
  todayDate: string
  timezone: string
  // New optional fields
  pendingDecisions?: Array<{ contact_name?: string; contact_email?: string; title?: string; subject?: string; deadline?: string; due_date?: string; commitment_text?: string; type?: string; urgency_score?: number; priority?: number }>
  horizonItems?: Array<{ title: string; date: string; type?: 'event' | 'commitment' | 'deadline' }>
  channel?: BriefingChannel
}): string {
  const {
    todayEvents, pendingTasks, emailsNeedReply, overdueFollowUps,
    recentEmails, todayDate, timezone,
    pendingDecisions, horizonItems, channel = 'dashboard'
  } = context

  const parts: string[] = [`Today is ${todayDate}. User timezone: ${timezone}.`]

  // --- TODAY section data ---
  if (todayEvents.length > 0) {
    parts.push(`\n--- Today's Calendar (${todayEvents.length}) ---`)
    for (const e of todayEvents) {
      const start = new Date(e.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone })
      const end = new Date(e.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone })
      const attendees = Array.isArray(e.attendees) ? e.attendees.map((a: any) => a.displayName || a.email || a).join(', ') : ''
      parts.push(`- ${start}–${end}: "${e.title}"${attendees ? ` with ${attendees}` : ''}${e.location ? ` at ${e.location}` : ''}`)
    }
  } else {
    parts.push('\n--- No meetings today ---')
  }

  // Family reminders / conflicts (feed into TODAY section)
  if ((context as any).familyReminders?.length > 0) {
    const reminders = (context as any).familyReminders
    parts.push(`\n--- Family Calendar (${reminders.length}) ---`)
    for (const r of reminders) {
      const timeStr = r.family_time !== 'all day' ? r.family_time : 'all day'
      const memberStr = r.family_member ? ` (${r.family_member})` : ''
      if (r.conflict_with) {
        parts.push(`- ⚠️ CONFLICT: ${timeStr} ${r.family_event}${memberStr} clashes with "${r.conflict_with}" at ${r.conflict_time}`)
      } else {
        parts.push(`- ${timeStr} ${r.family_event}${memberStr}`)
      }
    }
  }

  // --- ACTION section data ---

  // My commitments due today/overdue (feeds into ACTION as 🔴)
  if ((context as any).myCommitmentsDue?.length > 0) {
    const commitments = (context as any).myCommitmentsDue
    parts.push(`\n--- YOUR COMMITMENTS DUE (${commitments.length}) — YOU PROMISED THESE ---`)
    for (const c of commitments) {
      parts.push(`- You promised ${c.contact_name || c.contact_email}: "${c.subject}" (due: ${c.due_date || 'ASAP'})${c.commitment_text ? ` — ${c.commitment_text}` : ''}`)
    }
  }

  // Overdue follow-ups (feeds into ACTION as 🔴/🟡)
  if (overdueFollowUps.length > 0) {
    parts.push(`\n--- Overdue Follow-ups (${overdueFollowUps.length}) ---`)
    for (const f of overdueFollowUps) {
      const contactCtx = f.contact_relationship
        ? ` [${f.contact_relationship}${f.contact_importance === 'vip' ? ', VIP' : ''}]`
        : ''
      parts.push(`- ${f.contact_name || f.contact_email}${contactCtx}: "${f.subject}" (was due: ${f.due_date || 'no date'})`)
    }
  }

  // Emails needing reply (feeds into ACTION)
  if (emailsNeedReply.length > 0) {
    parts.push(`\n--- Emails Needing Reply (${emailsNeedReply.length}) ---`)
    for (const e of emailsNeedReply) {
      const contactCtx = e.contact_relationship
        ? ` [${e.contact_relationship}${e.contact_importance === 'vip' ? ', VIP' : e.contact_importance === 'high' ? ', important' : ''}${e.contact_company ? ` @ ${e.contact_company}` : ''}]`
        : ''
      parts.push(`- From ${e.from_name || e.from_address}${contactCtx}: "${e.subject}" (urgency: ${e.reply_urgency || 'normal'})`)
    }
  }

  // Pending tasks (feeds into ACTION)
  if (pendingTasks.length > 0) {
    parts.push(`\n--- Pending Tasks (${pendingTasks.length}) ---`)
    const priorityLabel: Record<number, string> = { 1: 'URGENT', 2: 'This week', 3: 'Later' }
    for (const t of pendingTasks) {
      parts.push(`- [${priorityLabel[t.priority] || 'Normal'}] ${t.title}${t.due_date ? ` (due: ${t.due_date})` : ''}${t.due_reason ? ` — ${t.due_reason}` : ''}`)
    }
  }

  // Pending decisions (new — feeds into ACTION as 🔴/🟡)
  if (pendingDecisions && pendingDecisions.length > 0) {
    parts.push(`\n--- Pending Decisions (${pendingDecisions.length}) ---`)
    for (const d of pendingDecisions) {
      const person = d.contact_name || d.contact_email || 'unknown'
      parts.push(`- ${person}: "${d.subject}" (due: ${d.due_date || 'TBD'})${d.commitment_text ? ` — ${d.commitment_text}` : ''}`)
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

  // Recent emails (context for the LLM)
  if (recentEmails.length > 0) {
    parts.push(`\n--- Recent Emails (last 24h, ${recentEmails.length}) ---`)
    for (const e of recentEmails.slice(0, 5)) {
      parts.push(`- From ${e.from_name || e.from_address}: "${e.subject}"`)
    }
  }

  // --- HORIZON section data ---
  if (horizonItems && horizonItems.length > 0) {
    parts.push(`\n--- Horizon: Next 3-7 Days (${horizonItems.length}) ---`)
    for (const h of horizonItems) {
      const typeLabel = h.type ? ` [${h.type}]` : ''
      parts.push(`- ${h.date}: "${h.title}"${typeLabel}`)
    }
  }

  // Channel-specific instructions
  if (channel === 'whatsapp') {
    parts.push(`\n--- Channel: WhatsApp ---`)
    parts.push(`After the HORIZON section (or after the last section if HORIZON is empty), append exactly:`)
    parts.push(`━━━`)
    parts.push(`回复：起草[name] | 完成[name] | 延期[name]`)
    parts.push(`(Replace [name] with actual person/task names from ACTION items)`)
  }

  // --- Memory Patterns (historical context for Sophia's judgment) ---
  if ((context as any).memoryPatterns) {
    const mp = (context as any).memoryPatterns
    parts.push(`\n--- Sophia's Memory (use for judgment, don't list raw) ---`)
    if (mp.completion_rate_30d != null) {
      parts.push(`- 30-day completion rate: ${mp.completion_rate_30d}%`)
    }
    if (mp.total_active_commitments > 0) {
      parts.push(`- Active commitments: ${mp.total_active_commitments}`)
    }
    if (mp.overcommit_warning) {
      parts.push(`- ⚠️ User may be overcommitted (${mp.total_active_commitments} active items)`)
    }
    if (mp.recent_corrections?.length > 0) {
      parts.push(`- Recent self-corrections: ${mp.recent_corrections.join(', ')}`)
    }
    parts.push(`(Use this context to inform your judgment — e.g., mention if completion rate is dropping, or if user is taking on too much. Don't dump these numbers raw.)`)
  }

  // Edge case: completely empty
  if (todayEvents.length === 0 && pendingTasks.length === 0 && emailsNeedReply.length === 0 && overdueFollowUps.length === 0 && recentEmails.length === 0) {
    parts.push('\nNo data synced yet. Output a brief message encouraging the user to sync their Gmail and Calendar. Do not use the 3-3-3 format for this case.')
  }

  return parts.join('\n')
}
