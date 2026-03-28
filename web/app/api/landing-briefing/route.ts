import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'

/**
 * GET /api/landing-briefing
 * Landing Briefing — triggered when timezone change detected (flight landed).
 * Aggregates everything that happened during the flight/offline period.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get user profile
  const { data: profile } = await admin
    .from('profiles')
    .select('timezone, language')
    .eq('id', user.id)
    .single()

  const timezone = profile?.timezone || 'Asia/Singapore'
  const now = new Date()

  // Determine "offline period" — last sync time to now
  const { data: lastSync } = await admin
    .from('sync_log')
    .select('completed_at')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  const offlineSince = lastSync?.completed_at
    ? new Date(lastSync.completed_at)
    : new Date(now.getTime() - 16 * 60 * 60 * 1000) // default 16h (long flight)

  const offlineISO = offlineSince.toISOString()

  // Gather everything that arrived during offline period
  const [emailsRes, waRes, eventsRes, tasksRes, followUpsRes] = await Promise.all([
    // New emails
    admin
      .from('emails')
      .select('from_name, from_address, subject, is_reply_needed, reply_urgency, received_at')
      .eq('user_id', user.id)
      .gte('received_at', offlineISO)
      .order('reply_urgency', { ascending: false })
      .order('received_at', { ascending: false }),

    // New WhatsApp messages
    admin
      .from('whatsapp_messages')
      .select('from_name, from_number, body, direction, received_at')
      .eq('user_id', user.id)
      .eq('direction', 'inbound')
      .gte('received_at', offlineISO)
      .order('received_at', { ascending: false }),

    // Upcoming events (next 24h)
    admin
      .from('calendar_events')
      .select('title, start_time, end_time, location, meeting_link')
      .eq('user_id', user.id)
      .gte('start_time', now.toISOString())
      .lte('start_time', new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString())
      .order('start_time', { ascending: true }),

    // Overdue tasks
    admin
      .from('tasks')
      .select('title, priority, due_date')
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress'])
      .lte('due_date', now.toISOString().slice(0, 10))
      .order('priority', { ascending: true }),

    // Overdue commitments
    admin
      .from('follow_ups')
      .select('contact_name, contact_email, subject, type, due_date')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .lte('due_date', now.toISOString().slice(0, 10)),
  ])

  const emails = emailsRes.data || []
  const waMessages = waRes.data || []
  const events = eventsRes.data || []
  const overdueTasks = tasksRes.data || []
  const overdueCommitments = followUpsRes.data || []

  const urgentEmails = emails.filter(e => e.is_reply_needed && (e.reply_urgency || 0) >= 2)
  const offlineHours = Math.round((now.getTime() - offlineSince.getTime()) / 3600000)

  // Generate AI landing briefing
  let briefing = ''
  try {
    const { client, model } = await createUserAIClient(user.id)
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are Chief AI, delivering a landing briefing after the user was offline for ${offlineHours} hours.
Your job: cut through the noise and tell them what matters RIGHT NOW.

Structure:
1. LOCATION & TIME: "You're now in [timezone]. It's [local time]. [Other timezone] is [time there]."
2. URGENT (must act now): Messages/emails that need immediate response
3. OVERDUE: Commitments or tasks past their deadline
4. UPCOMING: Next meeting/event with time
5. CATCH-UP: Summary of non-urgent messages (count + top senders)

Rules:
- Be concise: 5-8 sentences max
- Lead with the most time-sensitive item
- Detect language from email subjects and respond accordingly
- Use specific names and subjects, not vague descriptions`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            timezone,
            offline_hours: offlineHours,
            emails_received: emails.length,
            urgent_emails: urgentEmails.slice(0, 5).map(e => ({
              from: e.from_name || e.from_address,
              subject: e.subject,
              urgency: e.reply_urgency,
            })),
            whatsapp_messages: waMessages.slice(0, 5).map(m => ({
              from: m.from_name || m.from_number,
              snippet: (m.body || '').slice(0, 80),
            })),
            upcoming_events: events.slice(0, 3).map(e => ({
              title: e.title,
              time: e.start_time,
              location: e.location,
            })),
            overdue_tasks: overdueTasks.slice(0, 3).map(t => t.title),
            overdue_commitments: overdueCommitments.slice(0, 3).map(f => ({
              contact: f.contact_name || f.contact_email,
              subject: f.subject,
              type: f.type,
            })),
          }),
        },
      ],
      temperature: 0.5,
      max_tokens: 400,
    })
    briefing = completion.choices[0]?.message?.content?.trim() || ''
  } catch (err) {
    console.error('Landing briefing AI failed:', err)
    briefing = `You were offline for ${offlineHours} hours. ${emails.length} new emails, ${waMessages.length} WhatsApp messages. ${urgentEmails.length} need urgent reply.`
  }

  return NextResponse.json({
    briefing,
    stats: {
      offline_hours: offlineHours,
      offline_since: offlineSince.toISOString(),
      timezone,
      emails_total: emails.length,
      emails_urgent: urgentEmails.length,
      whatsapp_total: waMessages.length,
      upcoming_events: events.length,
      overdue_tasks: overdueTasks.length,
      overdue_commitments: overdueCommitments.length,
    },
    urgent_emails: urgentEmails.slice(0, 5),
    upcoming_events: events.slice(0, 3),
    overdue_commitments: overdueCommitments.slice(0, 5),
  })
}
