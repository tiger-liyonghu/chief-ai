/**
 * Core digest logic — shared between the authenticated POST /api/digest
 * and the Vercel cron job at /api/cron/digest.
 *
 * Accepts a userId (no session required) so it can be called from cron context.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken } from '@/lib/google/tokens'
import { sendMessage } from '@/lib/google/gmail'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { BRIEFING_SYSTEM, buildBriefingUserPrompt } from '@/lib/ai/prompts/briefing'

/* ─── Helpers ─── */

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

/* ─── Polished HTML Email Template ─── */

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
  const {
    briefing, greeting, dateStr, todayEvents, pendingTasks,
    emailsNeedReply, overdueFollowUps, timezone, dashboardUrl,
  } = opts

  const priorityLabel: Record<number, string> = { 1: 'Urgent', 2: 'This week', 3: 'Later' }
  const priorityColor: Record<number, string> = { 1: '#dc2626', 2: '#d97706', 3: '#2563eb' }

  /* ── Section builders ── */

  let meetingsHtml = ''
  if (todayEvents.length > 0) {
    const rows = todayEvents.slice(0, 5).map(e => {
      const attendees = Array.isArray(e.attendees)
        ? e.attendees.map((a: any) => a.displayName || a.email || a).join(', ')
        : ''
      return `<tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;color:#6b7280;white-space:nowrap;vertical-align:top;font-size:14px;">${formatTime(e.start_time, timezone)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;">
          <span style="font-weight:600;color:#111827;">${escapeHtml(e.title)}</span>
          ${attendees ? `<br><span style="color:#9ca3af;font-size:12px;">${escapeHtml(attendees)}</span>` : ''}
        </td>
      </tr>`
    }).join('')
    meetingsHtml = rows
  }

  let tasksHtml = ''
  if (pendingTasks.length > 0) {
    const rows = pendingTasks.slice(0, 5).map(t => `<tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;vertical-align:top;">
        <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;color:white;background:${priorityColor[t.priority] || '#6b7280'};letter-spacing:0.02em;">${priorityLabel[t.priority] || 'Normal'}</span>
      </td>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;">
        <span style="color:#111827;">${escapeHtml(t.title)}</span>
        ${t.due_reason ? `<br><span style="color:#9ca3af;font-size:12px;">${escapeHtml(t.due_reason)}</span>` : ''}
      </td>
    </tr>`).join('')
    tasksHtml = rows
  }

  let emailsHtml = ''
  if (emailsNeedReply.length > 0) {
    const rows = emailsNeedReply.slice(0, 5).map(e => `<tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-weight:600;font-size:14px;color:#111827;">${escapeHtml(e.from_name || e.from_address)}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;">${escapeHtml(e.subject)}</td>
    </tr>`).join('')
    emailsHtml = rows
  }

  let alertsHtml = ''
  if (overdueFollowUps.length > 0) {
    const rows = overdueFollowUps.slice(0, 5).map(f => {
      const days = f.due_date ? Math.max(0, Math.floor((Date.now() - new Date(f.due_date).getTime()) / 86400000)) : 0
      return `<tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-weight:600;font-size:14px;color:#111827;">${escapeHtml(f.contact_name || f.contact_email)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;">${escapeHtml(f.subject)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;color:#dc2626;font-weight:700;white-space:nowrap;font-size:13px;">${days}d overdue</td>
      </tr>`
    }).join('')
    alertsHtml = rows
  }

  const section = (title: string, icon: string, tableContent: string, emptyMsg?: string) => {
    if (!tableContent && !emptyMsg) return ''
    return `
    <div style="margin-bottom:28px;">
      <table role="presentation" style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:0 0 12px 0;">
            <span style="font-size:16px;font-weight:700;color:#111827;">${icon}&nbsp;&nbsp;${title}</span>
          </td>
        </tr>
      </table>
      ${tableContent
        ? `<table role="presentation" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #f3f4f6;border-radius:12px;overflow:hidden;">${tableContent}</table>`
        : `<p style="color:#9ca3af;font-size:14px;margin:0;">${emptyMsg}</p>`
      }
    </div>`
  }

  const preferencesUrl = `${dashboardUrl}/settings`

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Your Chief Briefing</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  <!-- Wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;">

          <!-- Logo / Brand -->
          <tr>
            <td style="padding:0 0 20px 0;text-align:center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="padding:8px 16px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;">
                    <span style="font-size:14px;font-weight:800;color:#ffffff;letter-spacing:0.05em;">CHIEF</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero: AI Briefing -->
          <tr>
            <td style="padding:0 0 24px 0;">
              <!--[if mso]>
              <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;">
              <v:fill type="gradient" color="#6366f1" color2="#7c3aed" angle="135"/>
              <v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">
              <![endif]-->
              <div style="background:linear-gradient(135deg,#6366f1 0%,#7c3aed 50%,#8b5cf6 100%);border-radius:20px;overflow:hidden;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="padding:32px 28px 28px 28px;">
                      <p style="margin:0 0 4px 0;font-size:13px;color:rgba(255,255,255,0.7);font-weight:500;">${escapeHtml(dateStr)}</p>
                      <h1 style="margin:0 0 20px 0;font-size:24px;font-weight:800;color:#ffffff;line-height:1.3;">${escapeHtml(greeting)}</h1>
                      <div style="background:rgba(255,255,255,0.12);border-radius:14px;padding:20px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="width:28px;vertical-align:top;padding-right:12px;">
                              <span style="font-size:18px;">&#10024;</span>
                            </td>
                            <td>
                              <p style="margin:0;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.95);font-weight:400;">${escapeHtml(briefing)}</p>
                            </td>
                          </tr>
                        </table>
                      </div>
                    </td>
                  </tr>
                </table>
              </div>
              <!--[if mso]></v:textbox></v:rect><![endif]-->
            </td>
          </tr>

          <!-- Content Sections -->
          <tr>
            <td style="background:#ffffff;border-radius:20px;border:1px solid #e5e7eb;overflow:hidden;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding:28px 24px 8px 24px;">
                    ${section("Today's Meetings", "&#128197;", meetingsHtml, todayEvents.length === 0 ? 'No meetings scheduled today.' : undefined)}
                    ${section('Priority Tasks', "&#9989;", tasksHtml, pendingTasks.length === 0 ? 'No pending tasks. Nice work!' : undefined)}
                    ${section('Emails Needing Reply', "&#128231;", emailsHtml, emailsNeedReply.length === 0 ? 'Inbox zero on replies!' : undefined)}
                    ${alertsHtml ? section('Alerts', "&#9888;&#65039;", alertsHtml) : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:28px 0;text-align:center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:14px;background:#6366f1;">
                    <a href="${dashboardUrl}" target="_blank" style="display:inline-block;padding:14px 40px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">Open Chief Dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 0 24px 0;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:12px;color:#9ca3af;line-height:1.5;">
                You're receiving this because you enabled Daily Digest in Chief.
              </p>
              <a href="${preferencesUrl}" style="font-size:12px;color:#6366f1;text-decoration:underline;">Manage preferences</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
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

/* ─── Main export: send digest for a given userId ─── */

export async function sendDigestForUser(userId: string): Promise<{ ok: boolean; sent_to?: string; error?: string }> {
  const admin = createAdminClient()

  // Get profile
  const { data: profile } = await admin
    .from('profiles')
    .select('email, full_name, timezone')
    .eq('id', userId)
    .single()

  if (!profile) return { ok: false, error: 'Profile not found' }

  const timezone = profile.timezone || 'Asia/Singapore'
  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  // Gather context
  const [eventsRes, tasksRes, emailsRes, followUpsRes] = await Promise.all([
    admin.from('calendar_events')
      .select('title, start_time, end_time, attendees, location')
      .eq('user_id', userId)
      .gte('start_time', `${todayISO}T00:00:00`)
      .lte('start_time', `${todayISO}T23:59:59`)
      .order('start_time', { ascending: true })
      .limit(10),
    admin.from('tasks')
      .select('title, priority, due_date, due_reason')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .order('priority', { ascending: true })
      .limit(5),
    admin.from('emails')
      .select('from_name, from_address, subject, reply_urgency')
      .eq('user_id', userId)
      .eq('is_reply_needed', true)
      .order('reply_urgency', { ascending: false })
      .limit(5),
    admin.from('follow_ups')
      .select('contact_name, contact_email, subject, due_date')
      .eq('user_id', userId)
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
    .eq('user_id', userId)
    .gte('generated_at', `${todayISO}T00:00:00`)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  if (cached) {
    briefing = cached.briefing
  } else {
    const { data: recentEmails } = await admin.from('emails')
      .select('from_name, from_address, subject, received_at')
      .eq('user_id', userId)
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
      const { client, model } = await createUserAIClient(userId)
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

      await admin.from('daily_briefings').insert({
        user_id: userId,
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
  const hour = parseInt(now.toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }))
  const firstName = profile.full_name ? profile.full_name.split(' ')[0] : ''
  const greeting = hour < 12
    ? `Good morning${firstName ? ', ' + firstName : ''}`
    : hour < 18
    ? `Good afternoon${firstName ? ', ' + firstName : ''}`
    : `Good evening${firstName ? ', ' + firstName : ''}`

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
    const accessToken = await getValidAccessToken(userId)
    const raw = createRawHtmlEmail(profile.email, subject, html)
    await sendMessage(accessToken, raw)
    return { ok: true, sent_to: profile.email }
  } catch (err: any) {
    console.error(`Failed to send digest for user ${userId}:`, err)
    return { ok: false, error: err.message }
  }
}
