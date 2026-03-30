import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { BRIEFING_SYSTEM, buildBriefingUserPrompt } from '@/lib/ai/prompts/briefing'
import { detectAlerts, formatAlertsForPrompt } from '@/lib/alerts/detect'
import { resolveContext, contextToPrompt } from '@/lib/ontology/resolve-context'

/**
 * Gather all context needed for the daily briefing from multiple tables.
 * Uses adminClient to bypass RLS — we already verified user identity via auth.
 */
async function gatherBriefingContext(userId: string, timezone: string) {
  const admin = createAdminClient()
  const now = new Date()
  const todayStart = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setHours(23, 59, 59, 999)

  // Convert back to ISO for DB queries (approximate — good enough for briefing)
  const todayISO = now.toISOString().slice(0, 10)
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const [eventsRes, tasksRes, emailsRes, followUpsRes, recentEmailsRes, vipContactsRes, myCommitmentsRes, waMessagesRes, familyEventsRes] = await Promise.all([
    // Today's calendar events
    admin
      .from('calendar_events')
      .select('title, start_time, end_time, attendees, location')
      .eq('user_id', userId)
      .gte('start_time', `${todayISO}T00:00:00`)
      .lte('start_time', `${todayISO}T23:59:59`)
      .order('start_time', { ascending: true })
      .limit(10),

    // Pending tasks (top 5 by priority)
    admin
      .from('tasks')
      .select('title, priority, due_date, due_reason')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(5),

    // Emails needing reply
    admin
      .from('emails')
      .select('from_name, from_address, subject, reply_urgency')
      .eq('user_id', userId)
      .eq('is_reply_needed', true)
      .order('reply_urgency', { ascending: false })
      .order('received_at', { ascending: false })
      .limit(5),

    // Overdue commitments + today's due commitments
    admin
      .from('commitments')
      .select('contact_name, contact_email, title, deadline, type')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress', 'overdue'])
      .lte('deadline', todayISO)
      .order('due_date', { ascending: true })
      .limit(10),

    // Recent important emails (last 24 hours)
    admin
      .from('emails')
      .select('from_name, from_address, subject, received_at')
      .eq('user_id', userId)
      .gte('received_at', yesterday)
      .order('received_at', { ascending: false })
      .limit(10),

    // VIP/high-importance contacts for enrichment
    admin
      .from('contacts')
      .select('email, name, relationship, importance, company')
      .eq('user_id', userId)
      .in('importance', ['vip', 'high'])
      .limit(50),

    // My commitments due today or overdue (i_promised type)
    admin
      .from('commitments')
      .select('contact_name, contact_email, title, deadline, description')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress', 'overdue'])
      .eq('type', 'i_promised')
      .lte('deadline', todayISO)
      .order('due_date', { ascending: true })
      .limit(5),

    // Recent WhatsApp messages (last 24h, inbound only)
    admin
      .from('whatsapp_messages')
      .select('from_name, from_number, body, received_at')
      .eq('user_id', userId)
      .eq('direction', 'inbound')
      .gte('received_at', yesterday)
      .order('received_at', { ascending: false })
      .limit(10),

    // Family calendar events: today's date matches + recurring events active today
    admin
      .from('family_calendar')
      .select('id, event_type, title, start_date, end_date, start_time, end_time, recurrence, recurrence_day, family_member')
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`start_date.eq.${todayISO},and(start_date.lte.${todayISO},end_date.gte.${todayISO}),recurrence.neq.none`),
  ])

  // Build VIP contact lookup for enriching email/follow-up context
  const vipContacts = vipContactsRes.data || []
  const vipMap = new Map<string, { name: string; relationship: string; importance: string; company: string | null }>()
  for (const c of vipContacts) {
    vipMap.set(c.email.toLowerCase(), { name: c.name || c.email, relationship: c.relationship, importance: c.importance, company: c.company })
  }

  // Enrich emails needing reply with contact relationship context
  const enrichedEmails = (emailsRes.data || []).map((e: any) => {
    const vip = vipMap.get((e.from_address || '').toLowerCase())
    return { ...e, contact_relationship: vip?.relationship, contact_importance: vip?.importance, contact_company: vip?.company }
  })

  // Enrich follow-ups
  const enrichedFollowUps = (followUpsRes.data || []).map((f: any) => {
    const vip = vipMap.get((f.contact_email || '').toLowerCase())
    return { ...f, contact_relationship: vip?.relationship, contact_importance: vip?.importance }
  })

  // --- Family calendar: filter to events actually relevant today ---
  const todayDayOfWeek = new Date(todayISO).getDay() // 0=Sun..6=Sat
  const allFamilyEvents = familyEventsRes.data || []
  const todayFamilyEvents = allFamilyEvents.filter(fe => {
    // One-off or date-range events covering today
    if (fe.recurrence === 'none') {
      if (fe.start_date === todayISO) return true
      if (fe.start_date <= todayISO && fe.end_date && fe.end_date >= todayISO) return true
      return false
    }
    // Weekly recurring: match day of week
    if (fe.recurrence === 'weekly' && fe.recurrence_day === todayDayOfWeek) return true
    // Daily recurring
    if (fe.recurrence === 'daily') return true
    // Monthly: match day of month
    if (fe.recurrence === 'monthly') {
      const eventDay = new Date(fe.start_date).getDate()
      if (new Date(todayISO).getDate() === eventDay) return true
    }
    // Yearly: match month+day
    if (fe.recurrence === 'yearly') {
      const ed = new Date(fe.start_date)
      const td = new Date(todayISO)
      if (ed.getMonth() === td.getMonth() && ed.getDate() === td.getDate()) return true
    }
    return false
  })

  // --- Detect conflicts between work events and family events ---
  const familyReminders: Array<{ family_event: string; family_time: string; conflict_with?: string; conflict_time?: string; family_member?: string }> = []

  for (const fe of todayFamilyEvents) {
    const feTime = fe.start_time ? fe.start_time.slice(0, 5) : null // "HH:MM"
    const feEndTime = fe.end_time ? fe.end_time.slice(0, 5) : null

    let conflictEvent: { title: string; start_time: string } | null = null

    if (feTime) {
      // Check overlap with work calendar events
      for (const we of eventsRes.data || []) {
        const weStart = new Date(we.start_time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: timezone })
        const weEnd = new Date(we.end_time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: timezone })

        // Time overlap: family starts before work ends AND work starts before family ends
        const famEnd = feEndTime || feTime // if no end, treat as point-in-time
        if (feTime < weEnd && weStart < famEnd) {
          conflictEvent = { title: we.title, start_time: weStart }
          break
        }
      }
    }

    familyReminders.push({
      family_event: fe.title,
      family_time: feTime || 'all day',
      conflict_with: conflictEvent?.title,
      conflict_time: conflictEvent?.start_time,
      family_member: fe.family_member || undefined,
    })
  }

  return {
    todayEvents: eventsRes.data || [],
    pendingTasks: tasksRes.data || [],
    emailsNeedReply: enrichedEmails,
    overdueFollowUps: enrichedFollowUps,
    recentEmails: recentEmailsRes.data || [],
    myCommitmentsDue: (myCommitmentsRes.data || []).map((c: any) => {
      const vip = vipMap.get((c.contact_email || '').toLowerCase())
      return { ...c, contact_importance: vip?.importance }
    }),
    recentWhatsApp: (waMessagesRes.data || []).map((m: any) => ({
      from: m.from_name || m.from_number,
      snippet: (m.body || '').slice(0, 100),
      received_at: m.received_at,
    })),
    familyReminders,
    todayDate: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: timezone }),
    timezone,
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const forceRefresh = url.searchParams.get('refresh') === '1'

  const admin = createAdminClient()

  // Get user profile for timezone
  const { data: profile } = await admin
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single()

  const timezone = profile?.timezone || 'Asia/Singapore'

  // Check cache: look for a briefing generated today
  const todayISO = new Date().toISOString().slice(0, 10)
  const { data: cached } = await admin
    .from('daily_briefings')
    .select('briefing, generated_at')
    .eq('user_id', user.id)
    .gte('generated_at', `${todayISO}T00:00:00`)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  if (cached && !forceRefresh) {
    return NextResponse.json({
      briefing: cached.briefing,
      generated_at: cached.generated_at,
      cached: true,
    })
  }

  // Gather all context + alerts in parallel
  const [context, alertResult] = await Promise.all([
    gatherBriefingContext(user.id, timezone),
    detectAlerts(admin, user.id).catch(() => null),
  ])
  let userPrompt = buildBriefingUserPrompt(context)

  // Resolve ontology context for top contacts needing reply (max 3)
  const topContactEmails = context.emailsNeedReply
    .map((e: any) => e.from_address)
    .filter(Boolean)
    .slice(0, 3)

  if (topContactEmails.length > 0) {
    const ontologyParts: string[] = []
    for (const email of topContactEmails) {
      try {
        const { data: contact } = await admin
          .from('contacts')
          .select('id')
          .eq('user_id', user.id)
          .eq('email', email)
          .maybeSingle()
        if (!contact) continue
        const bundle = await resolveContext(admin, user.id, contact.id, {
          entityType: 'person',
          maxHops: 1,
          hydrateEntities: true,
        })
        const prompt = contextToPrompt(bundle, 1)
        if (prompt) ontologyParts.push(prompt)
      } catch { /* non-fatal */ }
    }
    if (ontologyParts.length > 0) {
      userPrompt += `\n\n--- Relationship context for key contacts ---\n${ontologyParts.join('\n---\n')}\n--- End relationship context ---`
    }
  }

  // Append detected issues so the AI naturally mentions conflicts/warnings
  if (alertResult && alertResult.alerts.length > 0) {
    userPrompt += `\n\n--- ${formatAlertsForPrompt(alertResult)} ---\nMention the most important issues naturally in the briefing.`
  }

  try {
    const { client, model } = await createUserAIClient(user.id)
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: BRIEFING_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 300,
      temperature: 0.7,
    })

    const briefing = completion.choices[0]?.message?.content?.trim() || ''
    const generated_at = new Date().toISOString()

    // Cache in database
    await admin.from('daily_briefings').insert({
      user_id: user.id,
      briefing,
      generated_at,
      context_snapshot: {
        events_count: context.todayEvents.length,
        tasks_count: context.pendingTasks.length,
        emails_needing_reply: context.emailsNeedReply.length,
        overdue_followups: context.overdueFollowUps.length,
      },
    })

    return NextResponse.json({ briefing, generated_at, cached: false })
  } catch (err: any) {
    console.error('Briefing generation failed:', err)
    return NextResponse.json(
      { error: 'Failed to generate briefing', detail: err.message },
      { status: 500 }
    )
  }
}
