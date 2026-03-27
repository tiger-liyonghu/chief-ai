import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { MEETING_PREP_SYSTEM, MEETING_PREP_USER } from '@/lib/ai/prompts/meeting-prep'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventId } = await request.json()
    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Get the calendar event
    const { data: event, error: eventError } = await admin
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .eq('user_id', user.id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Parse attendees
    const attendees: Array<{ email: string; name?: string; status?: string }> =
      typeof event.attendees === 'string'
        ? JSON.parse(event.attendees)
        : event.attendees || []

    if (attendees.length === 0) {
      return NextResponse.json({ error: 'No attendees found for this event' }, { status: 400 })
    }

    // Collect attendee emails
    const attendeeEmails = attendees.map(a => a.email).filter(Boolean)

    // Search emails table for any emails from/to these attendees
    // We search for emails where from_address matches any attendee
    const { data: emails } = await admin
      .from('emails')
      .select('from_address, from_name, subject, snippet, received_at')
      .eq('user_id', user.id)
      .in('from_address', attendeeEmails)
      .order('received_at', { ascending: false })
      .limit(30)

    const emailHistory = emails || []

    // Call AI to generate the meeting brief
    const { client, model } = await createUserAIClient(user.id)
    const aiResponse = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: MEETING_PREP_SYSTEM },
        {
          role: 'user',
          content: MEETING_PREP_USER({
            title: event.title,
            description: event.description,
            start_time: event.start_time,
            attendees,
            emailHistory,
          }),
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const content = aiResponse.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 })
    }

    const parsed = JSON.parse(content)

    // Delete any existing briefs for this event (regeneration case)
    await admin
      .from('meeting_briefs')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', user.id)

    // Save briefs — one row per attendee
    const briefRows = (parsed.attendee_summaries || []).map((attendee: any) => ({
      user_id: user.id,
      event_id: eventId,
      attendee_email: attendee.email,
      attendee_name: attendee.name || null,
      interaction_summary: attendee.summary || null,
      last_contact_date: attendee.last_contact_date || null,
      email_count: attendee.email_count || 0,
      talking_points: parsed.talking_points || [],
      related_documents: parsed.related_docs || [],
      generated_at: new Date().toISOString(),
    }))

    // If no attendee summaries were generated, save a single brief with the overall data
    if (briefRows.length === 0) {
      briefRows.push({
        user_id: user.id,
        event_id: eventId,
        attendee_email: null,
        attendee_name: null,
        interaction_summary: parsed.last_interaction?.summary || 'No prior interactions found',
        last_contact_date: parsed.last_interaction?.date || null,
        email_count: 0,
        talking_points: parsed.talking_points || [],
        related_documents: parsed.related_docs || [],
        generated_at: new Date().toISOString(),
      })
    }

    const { data: savedBriefs, error: insertError } = await admin
      .from('meeting_briefs')
      .insert(briefRows)
      .select()

    if (insertError) {
      console.error('Failed to save meeting briefs:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      briefs: savedBriefs,
      open_items: parsed.open_items || [],
      talking_points: parsed.talking_points || [],
      related_docs: parsed.related_docs || [],
      last_interaction: parsed.last_interaction || null,
    })
  } catch (error: any) {
    console.error('Generate brief error:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate brief' }, { status: 500 })
  }
}
