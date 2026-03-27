import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deepseek } from '@/lib/ai/client'

// ─── GET: Meeting context card ───────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { eventId } = await params

  try {
    // 1. Fetch meeting details
    const { data: event, error: eventError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .eq('user_id', user.id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // 2. Parse attendee emails from JSONB
    const attendees: { email: string; name?: string; status?: string }[] =
      typeof event.attendees === 'string'
        ? JSON.parse(event.attendees)
        : event.attendees ?? []

    const attendeeEmails = attendees
      .map(a => a.email?.toLowerCase())
      .filter(Boolean) as string[]

    // 3. Fetch per-attendee email history, WhatsApp messages, tasks, follow-ups in parallel
    const [emailResults, waResults, tasksResult, followUpsResult, contactsResult] =
      await Promise.all([
        // Recent emails per attendee (from_address match)
        attendeeEmails.length > 0
          ? supabase
              .from('emails')
              .select('from_address, from_name, subject, snippet, received_at, is_reply_needed')
              .eq('user_id', user.id)
              .in('from_address', attendeeEmails)
              .order('received_at', { ascending: false })
              .limit(attendeeEmails.length * 5)
          : Promise.resolve({ data: [], error: null }),

        // WhatsApp messages — match via contacts phone lookup
        attendeeEmails.length > 0
          ? supabase
              .from('whatsapp_messages')
              .select('from_number, from_name, to_number, body, direction, received_at')
              .eq('user_id', user.id)
              .order('received_at', { ascending: false })
              .limit(100)
          : Promise.resolve({ data: [], error: null }),

        // Open tasks
        supabase
          .from('tasks')
          .select('title, status, priority, source_type, due_date')
          .eq('user_id', user.id)
          .in('status', ['pending', 'in_progress'])
          .order('due_date', { ascending: true })
          .limit(20),

        // Follow-ups for attendees
        attendeeEmails.length > 0
          ? supabase
              .from('follow_ups')
              .select('contact_email, contact_name, subject, type, status, due_date')
              .eq('user_id', user.id)
              .in('contact_email', attendeeEmails)
              .eq('status', 'active')
              .order('due_date', { ascending: true })
              .limit(20)
          : Promise.resolve({ data: [], error: null }),

        // Contacts for phone number mapping
        attendeeEmails.length > 0
          ? supabase
              .from('contacts')
              .select('email, name, phone')
              .eq('user_id', user.id)
              .in('email', attendeeEmails)
          : Promise.resolve({ data: [], error: null }),
      ])

    // Build phone-to-email map for WhatsApp matching
    const phoneToEmail = new Map<string, string>()
    for (const c of contactsResult.data ?? []) {
      if (c.phone && c.email) phoneToEmail.set(c.phone, c.email.toLowerCase())
    }

    // Group emails by attendee (max 5 each)
    const emailsByAttendee: Record<string, any[]> = {}
    for (const e of emailResults.data ?? []) {
      const addr = e.from_address?.toLowerCase()
      if (!addr) continue
      if (!emailsByAttendee[addr]) emailsByAttendee[addr] = []
      if (emailsByAttendee[addr].length < 5) emailsByAttendee[addr].push(e)
    }

    // Group WhatsApp messages by attendee (max 5 each)
    const waByAttendee: Record<string, any[]> = {}
    for (const m of waResults.data ?? []) {
      const phone = m.direction === 'inbound' ? m.from_number : m.to_number
      const email = phoneToEmail.get(phone)
      if (!email || !attendeeEmails.includes(email)) continue
      if (!waByAttendee[email]) waByAttendee[email] = []
      if (waByAttendee[email].length < 5) waByAttendee[email].push(m)
    }

    // Filter tasks relevant to attendees (by source or general open tasks)
    const relevantTasks = tasksResult.data ?? []

    // 4. Build attendee context cards
    const attendeeContexts = attendees.map(a => {
      const email = a.email?.toLowerCase() ?? ''
      return {
        email,
        name: a.name ?? email,
        rsvp_status: a.status,
        recent_emails: emailsByAttendee[email] ?? [],
        recent_whatsapp: waByAttendee[email] ?? [],
        pending_follow_ups: (followUpsResult.data ?? []).filter(
          f => f.contact_email?.toLowerCase() === email
        ),
      }
    })

    // 5. Generate AI pre-meeting brief
    const contextForAI = {
      meeting: {
        title: event.title,
        description: event.description,
        start_time: event.start_time,
        location: event.location,
        meeting_link: event.meeting_link,
      },
      attendees: attendeeContexts.map(a => ({
        name: a.name,
        rsvp: a.rsvp_status,
        recent_email_subjects: a.recent_emails.map(e => e.subject),
        recent_whatsapp_snippets: a.recent_whatsapp.map(m =>
          m.body?.substring(0, 80)
        ),
        pending_follow_ups: a.pending_follow_ups.map(f => f.subject),
      })),
      open_tasks: relevantTasks.slice(0, 10).map(t => ({
        title: t.title,
        priority: t.priority,
        due: t.due_date,
      })),
    }

    let briefing = ''
    try {
      const completion = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content:
              'You are a concise executive assistant. Given meeting context, write a 3-5 sentence pre-meeting briefing in the user\'s language (detect from meeting title/description). Highlight key discussion points, pending items with attendees, and anything that needs attention. Be direct and actionable.',
          },
          {
            role: 'user',
            content: JSON.stringify(contextForAI),
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      })
      briefing = completion.choices[0]?.message?.content ?? ''
    } catch (aiErr) {
      console.error('AI briefing generation failed:', aiErr)
      briefing = 'Unable to generate briefing at this time.'
    }

    return NextResponse.json({
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        start_time: event.start_time,
        end_time: event.end_time,
        location: event.location,
        meeting_link: event.meeting_link,
      },
      attendees: attendeeContexts,
      open_tasks: relevantTasks,
      briefing,
    })
  } catch (err) {
    console.error('Meeting context error:', err)
    const message = err instanceof Error ? err.message : 'Failed to load meeting context'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
