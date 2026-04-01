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
  const tomorrowISO = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const weekAheadISO = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const fourteenDaysAgoISO = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [eventsRes, tasksRes, emailsRes, followUpsRes, recentEmailsRes, vipContactsRes, myCommitmentsRes, waMessagesRes, familyEventsRes, pendingDecisionsRes, horizonEventsRes, staleVipRes, activeTripsRes] = await Promise.all([
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

    // Overdue commitments + today's due commitments (sorted by urgency, highest first)
    admin
      .from('commitments')
      .select('contact_name, contact_email, title, deadline, type, urgency_score, status')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress', 'overdue'])
      .lte('deadline', todayISO)
      .order('urgency_score', { ascending: false })
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

    // My commitments due today or overdue (i_promised type — credibility at stake)
    admin
      .from('commitments')
      .select('contact_name, contact_email, title, deadline, description, urgency_score')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress', 'overdue'])
      .eq('type', 'i_promised')
      .lte('deadline', todayISO)
      .order('urgency_score', { ascending: false })
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

    // Pending decisions — commitments due within 7 days, sorted by urgency
    admin
      .from('commitments')
      .select('contact_name, contact_email, title, deadline, type, urgency_score')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .lte('deadline', weekAheadISO)
      .order('urgency_score', { ascending: false })
      .limit(5),

    // Horizon items — calendar events 3-7 days out
    admin
      .from('calendar_events')
      .select('title, start_time')
      .eq('user_id', userId)
      .gte('start_time', `${tomorrowISO}T00:00:00`)
      .lte('start_time', `${weekAheadISO}T23:59:59`)
      .order('start_time', { ascending: true })
      .limit(5),

    // Stale VIP relationships — not contacted in 14+ days
    admin
      .from('contacts')
      .select('name, email, last_contact_at, importance')
      .eq('user_id', userId)
      .in('importance', ['vip', 'high'])
      .lt('last_contact_at', fourteenDaysAgoISO)
      .limit(3),

    // Active or upcoming trips (today falls within trip dates, or starting within 3 days)
    admin
      .from('trips')
      .select('id, title, destination_city, destination_country, start_date, end_date, status')
      .eq('user_id', userId)
      .in('status', ['planned', 'active', 'confirmed'])
      .lte('start_date', new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .gte('end_date', todayISO)
      .order('start_date', { ascending: true })
      .limit(3),
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

  // --- Phase 3: Memory Engine — historical patterns ---
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [completionTrendRes, recentCorrectionsRes] = await Promise.all([
    // Completion rate trend: last 30 days vs previous 30 days
    admin
      .from('commitments')
      .select('status, created_at')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo)
      .in('status', ['done', 'overdue', 'pending', 'in_progress']),

    // Recent self-review corrections (so Sophia can mention them)
    admin
      .from('alerts')
      .select('title, body, created_at')
      .eq('user_id', userId)
      .eq('type', 'self_review_correction')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  // Calculate completion rate trend
  const allRecent = completionTrendRes.data || []
  const done = allRecent.filter(c => c.status === 'done').length
  const overdue = allRecent.filter(c => c.status === 'overdue').length
  const completionRate = (done + overdue) > 0
    ? Math.round((done / (done + overdue)) * 100)
    : null
  const totalActive = allRecent.filter(c => ['pending', 'in_progress', 'overdue'].includes(c.status)).length

  const memoryPatterns = {
    completion_rate_30d: completionRate,
    total_active_commitments: totalActive,
    recent_corrections: (recentCorrectionsRes.data || []).map((a: any) => a.title),
    overcommit_warning: totalActive > 10, // Simple heuristic: > 10 active = overcommitted
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
    pendingDecisions: pendingDecisionsRes.data || [],
    horizonEvents: horizonEventsRes.data || [],
    staleVipContacts: staleVipRes.data || [],
    activeTrips: (activeTripsRes.data || []).map((t: any) => ({
      ...t,
      is_today: t.start_date <= todayISO && t.end_date >= todayISO,
      days_until: Math.max(0, Math.ceil((new Date(t.start_date).getTime() - now.getTime()) / 86400000)),
    })),
    memoryPatterns,
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
  const window = (['morning', 'midday', 'evening'].includes(url.searchParams.get('window') || '')
    ? url.searchParams.get('window')
    : 'morning') as 'morning' | 'midday' | 'evening'

  const admin = createAdminClient()

  // Get user profile for timezone
  const { data: profile } = await admin
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single()

  const timezone = profile?.timezone || 'Asia/Singapore'

  // Check cache: look for a briefing generated today for this window
  const todayISO = new Date().toISOString().slice(0, 10)
  const cacheKey = `${todayISO}_${window}`
  const { data: cached } = await admin
    .from('daily_briefings')
    .select('briefing, generated_at, score')
    .eq('user_id', user.id)
    .eq('window_key', cacheKey)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  if (cached && !forceRefresh) {
    // Extract verdict from cached briefing (starts with 🎯)
    const cachedVerdict = cached.briefing?.startsWith('🎯')
      ? cached.briefing.split('\n')[0].replace('🎯 ', '')
      : null
    return NextResponse.json({
      briefing: cached.briefing,
      verdict: cachedVerdict,
      generated_at: cached.generated_at,
      cached: true,
      score: cached.score || null,
    })
  }

  // Gather all context + alerts + emotion in parallel
  const [context, alertResult] = await Promise.all([
    gatherBriefingContext(user.id, timezone),
    detectAlerts(admin, user.id).catch(() => null),
  ])

  // 👂 Detect user's recent emotional state from WhatsApp messages
  const { detectEmotion } = await import('@/lib/ai/emotion/detect')
  const recentEmotions = (context.recentWhatsApp || [])
    .slice(0, 3)
    .map((m: any) => detectEmotion(m.snippet || ''))
    .filter((e: any) => e.emotion !== 'calm' && e.confidence >= 0.5)
  const dominantEmotion = recentEmotions.length > 0 ? recentEmotions[0] : null

  // --- Score calculation ---
  const thirtyDaysAgoISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [completedRes, overdueRes] = await Promise.all([
    admin.from('commitments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('status', 'done')
      .gte('completed_at', thirtyDaysAgoISO),
    admin.from('commitments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('status', 'overdue'),
  ])
  const completedCount = completedRes.count || 0
  const overdueCount = overdueRes.count || 0
  const totalForRate = completedCount + overdueCount
  const score = {
    meetings: context.todayEvents.length,
    actions_pending: (context.pendingDecisions || []).length,
    overdue: context.overdueFollowUps.length,
    compliance_rate: totalForRate > 0 ? Math.round((completedCount / totalForRate) * 100) : 100,
    trend: 'stable' as 'improving' | 'stable' | 'declining',
  }

  // --- Window-aware prompt modifiers ---
  let windowInstruction = ''
  if (window === 'midday') {
    windowInstruction = '\n\n[MIDDAY UPDATE] Keep this shorter. Focus on: remaining items for today, any new urgent items that appeared since morning, and quick status check. Skip completed items. 3-5 sentences max.'
  } else if (window === 'evening') {
    windowInstruction = '\n\n[EVENING WRAP-UP] Focus on: what was accomplished today, any items that slipped, and a quick preview of tomorrow. Tone should be reflective and forward-looking. 3-5 sentences max.'
  }

  let userPrompt = buildBriefingUserPrompt(context) + windowInstruction

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

  // 👂 Inject emotional context into prompt
  if (dominantEmotion) {
    const emotionGuide: Record<string, string> = {
      stressed: 'User is stressed. Be ruthlessly brief. Only show the ONE most critical item. Say what can wait.',
      tired: 'User is exhausted. Lead verdict with "没有紧急的事" if possible. Defer non-critical items. Do not add cognitive load.',
      anxious: 'User feels time pressure. Give certainty. Exact times, exact actions. No ambiguity in verdict.',
      panicked: 'User is panicking. Verdict must be calming: "先缓一下，最重要的一件事是X。" One step only.',
      angry: 'User is frustrated. Acknowledge briefly, then focus on actionable items. No cheerfulness.',
    }
    userPrompt += `\n\n--- Emotional State ---\nUser recently shows: ${dominantEmotion.emotion} (confidence: ${dominantEmotion.confidence.toFixed(1)})\n${emotionGuide[dominantEmotion.emotion] || 'Normal tone.'}`
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
      max_tokens: 500,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const rawContent = completion.choices[0]?.message?.content?.trim() || '{}'
    const generated_at = new Date().toISOString()

    // Parse structured briefing
    let structured: { verdict?: string; today?: any[]; action?: any[]; horizon?: any[] }
    try {
      structured = JSON.parse(rawContent)
    } catch {
      // Fallback: treat as plain text briefing (old format)
      structured = { verdict: rawContent, today: [], action: [], horizon: [] }
    }

    // Build display text from structured data (backwards compatible)
    const briefingParts: string[] = []
    if (structured.verdict) {
      briefingParts.push(`🎯 ${structured.verdict}`)
    }
    if (structured.today?.length) {
      briefingParts.push('\nTODAY')
      for (const t of structured.today) {
        briefingParts.push(`  ${t.time} ${t.event}${t.note ? ` — ${t.note}` : ''}`)
      }
    }
    if (structured.action?.length) {
      briefingParts.push('\nACTION')
      for (const a of structured.action) {
        const icon = a.level === 'red' ? '🔴' : a.level === 'yellow' ? '🟡' : '🟢'
        briefingParts.push(`  ${icon} ${a.person} ${a.item} — ${a.why}${a.suggestion ? `，${a.suggestion}` : ''}`)
      }
    }
    if (structured.horizon?.length) {
      briefingParts.push('\nHORIZON')
      briefingParts.push(`  ${structured.horizon.map((h: any) => `${h.day}: ${h.item}`).join(' · ')}`)
    }
    const briefing = briefingParts.join('\n')

    // Cache in database
    await admin.from('daily_briefings').insert({
      user_id: user.id,
      briefing,
      generated_at,
      window_key: cacheKey,
      score,
      context_snapshot: {
        events_count: context.todayEvents.length,
        tasks_count: context.pendingTasks.length,
        emails_needing_reply: context.emailsNeedReply.length,
        overdue_followups: context.overdueFollowUps.length,
        pending_decisions: context.pendingDecisions.length,
        horizon_events: context.horizonEvents.length,
        stale_vip_contacts: context.staleVipContacts.length,
      },
    })

    return NextResponse.json({
      briefing,
      verdict: structured.verdict || null,
      structured,
      generated_at,
      cached: false,
      score,
    })
  } catch (err: any) {
    console.error('Briefing generation failed:', err)
    return NextResponse.json(
      { error: 'Failed to generate briefing', detail: err.message },
      { status: 500 }
    )
  }
}
