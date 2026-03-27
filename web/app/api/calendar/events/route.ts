import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken } from '@/lib/google/tokens'
import { createEvent, updateEvent, deleteEvent } from '@/lib/google/calendar'

// ─── POST: Create a new calendar event ──────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, description, start_time, end_time, location, attendee_emails, create_meet_link } = body

  if (!title || !start_time || !end_time) {
    return NextResponse.json({ error: 'title, start_time, and end_time are required' }, { status: 400 })
  }

  // Validate time ordering
  if (new Date(end_time) <= new Date(start_time)) {
    return NextResponse.json({ error: 'end_time must be after start_time' }, { status: 400 })
  }

  try {
    const accessToken = await getValidAccessToken(user.id)

    // Create on Google Calendar
    const googleEvent = await createEvent(accessToken, {
      title,
      description: description || undefined,
      startTime: start_time,
      endTime: end_time,
      location: location || undefined,
      attendeeEmails: attendee_emails || [],
      createMeetLink: !!create_meet_link,
    })

    // Upsert into local table
    const admin = createAdminClient()
    const attendees = (googleEvent.attendees || []).map(a => ({
      email: a.email,
      name: a.displayName,
      status: a.responseStatus,
    }))

    const { data: localEvent, error: dbError } = await admin
      .from('calendar_events')
      .upsert({
        user_id: user.id,
        google_event_id: googleEvent.id,
        title: googleEvent.summary,
        description: googleEvent.description || null,
        start_time: googleEvent.start?.dateTime || start_time,
        end_time: googleEvent.end?.dateTime || end_time,
        attendees: JSON.stringify(attendees),
        location: googleEvent.location || null,
        meeting_link: googleEvent.hangoutLink || null,
        is_recurring: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,google_event_id' })
      .select()
      .single()

    if (dbError) {
      console.error('Failed to save event locally:', dbError)
    }

    return NextResponse.json({
      event: localEvent || {
        google_event_id: googleEvent.id,
        title: googleEvent.summary,
        start_time: googleEvent.start?.dateTime,
        end_time: googleEvent.end?.dateTime,
        meeting_link: googleEvent.hangoutLink || null,
      },
    })
  } catch (err) {
    console.error('Create event error:', err)
    const message = err instanceof Error ? err.message : 'Failed to create event'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── PATCH: Update an existing event ────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { event_id, title, description, start_time, end_time, location, attendee_emails } = body

  if (!event_id) {
    return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
  }

  // Validate time ordering if both provided
  if (start_time && end_time && new Date(end_time) <= new Date(start_time)) {
    return NextResponse.json({ error: 'end_time must be after start_time' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()

    // Find the local event to get google_event_id
    const { data: localEvent, error: findError } = await admin
      .from('calendar_events')
      .select('google_event_id')
      .eq('id', event_id)
      .eq('user_id', user.id)
      .single()

    if (findError || !localEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const accessToken = await getValidAccessToken(user.id)

    // Update on Google Calendar
    const googleEvent = await updateEvent(accessToken, localEvent.google_event_id, {
      title,
      description,
      startTime: start_time,
      endTime: end_time,
      location,
      attendeeEmails: attendee_emails,
    })

    // Update local record
    const updates: any = { updated_at: new Date().toISOString() }
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (start_time) updates.start_time = googleEvent.start?.dateTime || start_time
    if (end_time) updates.end_time = googleEvent.end?.dateTime || end_time
    if (location !== undefined) updates.location = location || null
    if (attendee_emails) {
      const attendees = (googleEvent.attendees || []).map(a => ({
        email: a.email,
        name: a.displayName,
        status: a.responseStatus,
      }))
      updates.attendees = JSON.stringify(attendees)
    }
    if (googleEvent.hangoutLink) updates.meeting_link = googleEvent.hangoutLink

    await admin
      .from('calendar_events')
      .update(updates)
      .eq('id', event_id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Update event error:', err)
    const message = err instanceof Error ? err.message : 'Failed to update event'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── DELETE: Delete an event ────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { event_id } = body

  if (!event_id) {
    return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()

    // Find local event
    const { data: localEvent, error: findError } = await admin
      .from('calendar_events')
      .select('google_event_id')
      .eq('id', event_id)
      .eq('user_id', user.id)
      .single()

    if (findError || !localEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const accessToken = await getValidAccessToken(user.id)

    // Delete from Google Calendar
    await deleteEvent(accessToken, localEvent.google_event_id)

    // Delete local record
    await admin
      .from('calendar_events')
      .delete()
      .eq('id', event_id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Delete event error:', err)
    const message = err instanceof Error ? err.message : 'Failed to delete event'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
