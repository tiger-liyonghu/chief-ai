import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken } from '@/lib/google/tokens'
import { sendMessage } from '@/lib/google/gmail'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { BRIEFING_SYSTEM, buildBriefingUserPrompt } from '@/lib/ai/prompts/briefing'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatTime(isoStr: string, timezone: string): string {
  return new Date(isoStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  })
}

function buildDigestHtml(opts: {
  briefing: string
  greeting: string
  dateStr: string
  todayEvents: any[]
  pendingTasks: any[]
  emailsNeedReply: any[]
  overdueFollowUps: any[]
  timezone: string
  dashboardUrl: string
}): string {
  const { briefing, greeting, dateStr, todayEvents, pendingTasks, emailsNeedReply, overdueFollowUps, timezone, dashboardUrl } = opts

  const priorityLabel: Record<number, string> = { 1: 'Urgent', 2: 'This week', 3: 'Later' }
  const priorityColor: Record<number, string> = { 1: '#dc2626', 2: '#d97706', 3: '#2563eb' }

  let meetingsHtml = ''
  if (todayEvents.length > 0) {
    meetingsHtml = todayEvents.map(e => {
      const attendees = Array.isArray(e.attendees) ? e.attendees.map((a: any) => a.displayName || a.email || a).join(', ') : ''
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#6b7280;white-space:nowrap;vertical-align:top;">${formatTime(e.start_time, timezone)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">
            <strong>${escapeHtml(e.title)}</strong>
            ${attendees ? `<br><span style="color:#9ca3af;font-size:13px;">${escapeHtml(attendees)}</span>` : ''}
          </td>
        </tr>`
    }).join('')
  }

  let tasksHtml = ''
  if (pendingTasks.length > 0) {
    tasksHtml = pendingTasks.map(t => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">
          <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;color:white;background:${priorityColor[t.priority] || '#6b7280'};">${priorityLabel[t.priority] || 'Normal'}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">
          ${escapeHtml(t.title)}
          ${t.due_reason ? `<br><span style="color:#9ca3af;font-size:13px;">${escapeHtml(t.due_reason)}</span>` : ''}
        </td>
      </tr>`
    ).join('')
  }

  let emailsHtml = ''
  if (emailsNeedReply.length > 0) {
    emailsHtml = emailsNeedReply.map(e => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:500;">${escapeHtml(e.from_name || e.from_address)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#6b7280;">${escapeHtml(e.subject)}</td>
      </tr>`
    ).join('')
  }

  let followUpsHtml = ''
  if (overdueFollowUps.length > 0) {
    followUpsHtml = overdueFollowUps.map(f => {
      const days = f.due_date ? Math.max(0, Math.floor((Date.now() - new Date(f.due_date).getTime()) / 86400000)) : 0
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:500;">${escapeHtml(f.contact_name || f.contact_email)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#6b7280;">${escapeHtml(f.subject)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#dc2626;font-weight:600;white-space:nowrap;">${days}d overdue</td>
        </tr>`
    }).join('')
  }

  const section = (title: string, icon: string, tableContent: string) => tableContent ? `
    <div style="margin-bottom:24px;">
      <h2 style="font-size:16px;font-weight:600;color:#1f2937;margin:0 0 12px 0;">${icon} ${title}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${tableContent}</table>
    </div>` : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1,#a855f7);border-radius:16px;padding:28px;color:white;margin-bottom:24px;">
      <p style="margin:0 0 4px 0;font-size:14px;opacity:0.9;">${escapeHtml(dateStr)}</p>
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;">${escapeHtml(greeting)}</h1>
      <p style="margin:0;font-size:15px;line-height:1.6;opacity:0.95;">${escapeHtml(briefing)}</p>
    </div>

    <!-- Content -->
    <div style="background:white;border-radius:16px;padding:24px;border:1px solid #e5e7eb;">
      ${section("Today's Meetings", "\u{1F4C5}", meetingsHtml)}
      ${section('Pending Tasks', '\u2705', tasksHtml)}
      ${section('Emails Needing Reply', '\u{1F4E7}', emailsHtml)}
      ${section('Overdue Follow-ups', '\u{1F6A8}', followUpsHtml)}

      ${!meetingsHtml && !tasksHtml && !emailsHtml && !followUpsHtml ? '<p style="color:#9ca3af;text-align:center;padding:24px 0;">All clear today. Enjoy your day!</p>' : ''}
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-top:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;padding:12px 32px;background:#6366f1;color:white;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;">Open Chief</a>
    </div>

    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:24px;">Sent by your AI Chief of Staff</p>
  </div>
</body>
</html>`
}

function createRawHtmlEmail(to: string, subject: string, htmlBody: string): string {
  const boundary = `boundary_${Date.now()}`
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]
  // Plain text fallback
  const plainText = htmlBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const email = headers.join('\r\n') + '\r\n\r\n'
    + `--${boundary}\r\n`
    + `Content-Type: text/plain; charset=utf-8\r\n\r\n`
    + plainText + '\r\n'
    + `--${boundary}\r\n`
    + `Content-Type: text/html; charset=utf-8\r\n\r\n`
    + htmlBody + '\r\n'
    + `--${boundary}--`
  return Buffer.from(email).toString('base64url')
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get profile
  const { data: profile } = await admin
    .from('profiles')
    .select('email, full_name, timezone')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const timezone = profile.timezone || 'Asia/Singapore'
  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  // Gather context (same queries as briefing)
  const [eventsRes, tasksRes, emailsRes, followUpsRes] = await Promise.all([
    admin.from('calendar_events')
      .select('title, start_time, end_time, attendees, location')
      .eq('user_id', user.id)
      .gte('start_time', `${todayISO}T00:00:00`)
      .lte('start_time', `${todayISO}T23:59:59`)
      .order('start_time', { ascending: true })
      .limit(10),
    admin.from('tasks')
      .select('title, priority, due_date, due_reason')
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress'])
      .order('priority', { ascending: true })
      .limit(5),
    admin.from('emails')
      .select('from_name, from_address, subject, reply_urgency')
      .eq('user_id', user.id)
      .eq('is_reply_needed', true)
      .order('reply_urgency', { ascending: false })
      .limit(5),
    admin.from('follow_ups')
      .select('contact_name, contact_email, subject, due_date')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .lt('due_date', todayISO)
      .limit(5),
  ])

  const todayEvents = eventsRes.data || []
  const pendingTasks = tasksRes.data || []
  const emailsNeedReply = emailsRes.data || []
  const overdueFollowUps = followUpsRes.data || []

  // Generate or reuse briefing
  let briefing = ''
  const { data: cached } = await admin
    .from('daily_briefings')
    .select('briefing')
    .eq('user_id', user.id)
    .gte('generated_at', `${todayISO}T00:00:00`)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  if (cached) {
    briefing = cached.briefing
  } else {
    // Also fetch recent emails for briefing generation
    const { data: recentEmails } = await admin.from('emails')
      .select('from_name, from_address, subject, received_at')
      .eq('user_id', user.id)
      .gte('received_at', yesterday)
      .order('received_at', { ascending: false })
      .limit(10)

    const context = {
      todayEvents, pendingTasks, emailsNeedReply, overdueFollowUps,
      recentEmails: recentEmails || [],
      todayDate: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: timezone }),
      timezone,
    }

    try {
      const { client, model } = await createUserAIClient(user.id)
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: BRIEFING_SYSTEM },
          { role: 'user', content: buildBriefingUserPrompt(context) },
        ],
        max_tokens: 300,
        temperature: 0.7,
      })
      briefing = completion.choices[0]?.message?.content?.trim() || 'Your briefing could not be generated. Check your dashboard for details.'

      // Cache it
      await admin.from('daily_briefings').insert({
        user_id: user.id,
        briefing,
        generated_at: now.toISOString(),
        context_snapshot: {
          events_count: todayEvents.length,
          tasks_count: pendingTasks.length,
          emails_needing_reply: emailsNeedReply.length,
          overdue_followups: overdueFollowUps.length,
        },
      })
    } catch (err: any) {
      console.error('Briefing generation failed for digest:', err)
      briefing = 'Briefing generation encountered an error. Please check your dashboard directly.'
    }
  }

  // Build email
  const hour = now.getHours()
  const greeting = hour < 12 ? `Good morning${profile.full_name ? ', ' + profile.full_name.split(' ')[0] : ''}` :
                   hour < 18 ? `Good afternoon${profile.full_name ? ', ' + profile.full_name.split(' ')[0] : ''}` :
                   `Good evening${profile.full_name ? ', ' + profile.full_name.split(' ')[0] : ''}`

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: timezone })
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000'

  const html = buildDigestHtml({
    briefing,
    greeting,
    dateStr,
    todayEvents,
    pendingTasks,
    emailsNeedReply,
    overdueFollowUps,
    timezone,
    dashboardUrl: `${dashboardUrl}/dashboard`,
  })

  const subject = `Your Chief Briefing \u2014 ${dateStr}`

  try {
    const accessToken = await getValidAccessToken(user.id)
    const raw = createRawHtmlEmail(profile.email, subject, html)
    await sendMessage(accessToken, raw)

    return NextResponse.json({ ok: true, sent_to: profile.email })
  } catch (err: any) {
    console.error('Failed to send digest:', err)
    return NextResponse.json(
      { error: 'Failed to send digest email', detail: err.message },
      { status: 500 }
    )
  }
}
