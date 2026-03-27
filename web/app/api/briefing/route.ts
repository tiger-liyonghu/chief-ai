import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { BRIEFING_SYSTEM, buildBriefingUserPrompt } from '@/lib/ai/prompts/briefing'
import { detectAlerts, formatAlertsForPrompt } from '@/lib/alerts/detect'

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

  const [eventsRes, tasksRes, emailsRes, followUpsRes, recentEmailsRes, vipContactsRes] = await Promise.all([
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

    // Overdue follow-ups
    admin
      .from('follow_ups')
      .select('contact_name, contact_email, subject, due_date')
      .eq('user_id', userId)
      .eq('status', 'active')
      .lt('due_date', todayISO)
      .order('due_date', { ascending: true })
      .limit(5),

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

  return {
    todayEvents: eventsRes.data || [],
    pendingTasks: tasksRes.data || [],
    emailsNeedReply: enrichedEmails,
    overdueFollowUps: enrichedFollowUps,
    recentEmails: recentEmailsRes.data || [],
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
