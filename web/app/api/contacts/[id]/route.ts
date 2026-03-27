import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const admin = createAdminClient()

  // Get the contact
  const { data: contact, error: contactErr } = await admin
    .from('contacts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (contactErr || !contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  // Fetch interaction history in parallel
  const [emailsRes, tasksRes, followUpsRes, eventsRes] = await Promise.all([
    // Recent emails from/to this contact
    admin
      .from('emails')
      .select('id, subject, from_address, from_name, received_at, is_reply_needed, reply_urgency, snippet')
      .eq('user_id', user.id)
      .eq('from_address', contact.email)
      .order('received_at', { ascending: false })
      .limit(10),

    // Tasks linked to emails from this contact
    admin
      .from('tasks')
      .select('id, title, priority, status, due_date, created_at, source_email_id')
      .eq('user_id', user.id)
      .in('source_email_id',
        // Subquery: get email IDs from this contact
        (await admin
          .from('emails')
          .select('id')
          .eq('user_id', user.id)
          .eq('from_address', contact.email)
          .limit(50)
        ).data?.map(e => e.id) || ['00000000-0000-0000-0000-000000000000']
      )
      .order('created_at', { ascending: false })
      .limit(10),

    // Follow-ups involving this contact
    admin
      .from('follow_ups')
      .select('id, type, subject, commitment_text, due_date, status, created_at')
      .eq('user_id', user.id)
      .eq('contact_email', contact.email)
      .order('created_at', { ascending: false })
      .limit(10),

    // Calendar events with this contact as attendee
    admin
      .from('calendar_events')
      .select('id, title, start_time, end_time, attendees, location')
      .eq('user_id', user.id)
      .order('start_time', { ascending: false })
      .limit(50),
  ])

  // Filter calendar events that include this contact
  const contactEvents = (eventsRes.data || []).filter(event => {
    const attendees = typeof event.attendees === 'string'
      ? JSON.parse(event.attendees)
      : (event.attendees || [])
    return attendees.some((a: any) =>
      (a.email || '').toLowerCase() === contact.email.toLowerCase()
    )
  }).slice(0, 10)

  return NextResponse.json({
    contact,
    recentEmails: emailsRes.data || [],
    relatedTasks: tasksRes.data || [],
    followUps: followUpsRes.data || [],
    sharedEvents: contactEvents,
  })
}
