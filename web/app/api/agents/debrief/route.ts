import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'

/**
 * POST /api/agents/debrief
 * Debrief Agent — structured retrospective for a time period.
 * Body: { period: "week" | "month" | "custom", start_date?, end_date? }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const period = body.period || 'week'

  const admin = createAdminClient()
  const now = new Date()

  // Calculate date range
  let startDate: Date
  let endDate = now

  if (period === 'custom' && body.start_date && body.end_date) {
    startDate = new Date(body.start_date)
    endDate = new Date(body.end_date)
  } else if (period === 'month') {
    startDate = new Date(now.getTime() - 30 * 86400000)
  } else {
    startDate = new Date(now.getTime() - 7 * 86400000)
  }

  const startISO = startDate.toISOString()
  const endISO = endDate.toISOString()

  // Gather all data for the period in parallel
  const [emailsRes, eventsRes, tasksRes, followUpsRes, waRes, tripsRes] = await Promise.all([
    admin
      .from('emails')
      .select('from_address, from_name, subject, is_reply_needed, received_at')
      .eq('user_id', user.id)
      .gte('received_at', startISO)
      .lte('received_at', endISO)
      .order('received_at', { ascending: false }),

    admin
      .from('calendar_events')
      .select('title, start_time, attendees, location')
      .eq('user_id', user.id)
      .gte('start_time', startISO)
      .lte('start_time', endISO)
      .order('start_time', { ascending: true }),

    admin
      .from('tasks')
      .select('title, status, priority, source_type, created_at, completed_at')
      .eq('user_id', user.id)
      .gte('created_at', startISO)
      .lte('created_at', endISO),

    admin
      .from('follow_ups')
      .select('contact_name, contact_email, subject, type, status, due_date, created_at')
      .eq('user_id', user.id)
      .gte('created_at', startISO),

    admin
      .from('whatsapp_messages')
      .select('from_name, from_number, direction, received_at')
      .eq('user_id', user.id)
      .gte('received_at', startISO)
      .lte('received_at', endISO),

    admin
      .from('trips')
      .select('title, destination_city, start_date, end_date, status')
      .eq('user_id', user.id)
      .gte('start_date', startISO.slice(0, 10))
      .lte('start_date', endISO.slice(0, 10)),
  ])

  const emails = emailsRes.data || []
  const events = eventsRes.data || []
  const tasks = tasksRes.data || []
  const followUps = followUpsRes.data || []
  const waMessages = waRes.data || []
  const trips = tripsRes.data || []

  // Calculate stats
  const stats = {
    emails_received: emails.length,
    emails_needing_reply: emails.filter(e => e.is_reply_needed).length,
    meetings_attended: events.length,
    tasks_created: tasks.length,
    tasks_completed: tasks.filter(t => t.status === 'done').length,
    tasks_completion_rate: tasks.length > 0
      ? Math.round(tasks.filter(t => t.status === 'done').length / tasks.length * 100)
      : 0,
    commitments_made: followUps.filter(f => f.type === 'i_promised').length,
    commitments_resolved: followUps.filter(f => f.type === 'i_promised' && f.status === 'resolved').length,
    whatsapp_messages: waMessages.length,
    wa_inbound: waMessages.filter(m => m.direction === 'inbound').length,
    wa_outbound: waMessages.filter(m => m.direction === 'outbound').length,
    trips: trips.length,
  }

  // Top contacts (by email frequency)
  const contactFreq = new Map<string, { name: string; count: number }>()
  for (const e of emails) {
    const addr = e.from_address || ''
    const existing = contactFreq.get(addr)
    if (existing) {
      existing.count++
    } else {
      contactFreq.set(addr, { name: e.from_name || addr, count: 1 })
    }
  }
  const topContacts = [...contactFreq.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([email, { name, count }]) => ({ email, name, interactions: count }))

  // Generate AI debrief
  let debrief = ''
  try {
    const { client, model } = await createUserAIClient(user.id)
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are Debrief, an AI retrospective assistant. Generate a structured retrospective report.

Format:
## Highlights
- 2-3 key accomplishments or wins

## Attention Areas
- What fell through the cracks? Overdue items?

## Relationship Pulse
- Who did you interact with most? Any relationships cooling?

## Numbers
- Key stats summary in one line

## Next Week Focus
- 2-3 specific recommendations

Rules: Be specific with names/numbers. Detect language from email subjects. Keep under 300 words.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
            stats,
            top_contacts: topContacts,
            unresolved_followups: followUps.filter(f => f.status === 'active').slice(0, 5).map(f => ({
              contact: f.contact_name || f.contact_email,
              subject: f.subject,
              type: f.type,
            })),
            meetings_sample: events.slice(0, 5).map(e => e.title),
            trips: trips.map(t => `${t.title} (${t.destination_city})`),
          }),
        },
      ],
      temperature: 0.5,
      max_tokens: 500,
    })
    debrief = completion.choices[0]?.message?.content?.trim() || ''
  } catch (err) {
    console.error('Debrief AI generation failed:', err)
    debrief = 'Unable to generate debrief at this time.'
  }

  return NextResponse.json({
    period: { start: startDate.toISOString(), end: endDate.toISOString(), label: period },
    stats,
    top_contacts: topContacts,
    debrief,
  })
}
