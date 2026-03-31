import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { commitment_id, duration_minutes = 60 } = await request.json()

  // Fetch the commitment
  const { data: commitment } = await admin
    .from('commitments')
    .select('title, contact_name, deadline')
    .eq('id', commitment_id)
    .eq('user_id', user.id)
    .single()

  if (!commitment) return NextResponse.json({ error: 'Commitment not found' }, { status: 404 })

  // Calculate prep time: day before deadline, 10am
  const deadline = commitment.deadline ? new Date(commitment.deadline) : new Date()
  const prepDate = new Date(deadline)
  prepDate.setDate(prepDate.getDate() - 1)
  if (prepDate < new Date()) prepDate.setTime(Date.now()) // If past, use today
  prepDate.setHours(10, 0, 0, 0)

  const endTime = new Date(prepDate.getTime() + duration_minutes * 60000)

  // Create calendar event directly in DB (no Google Calendar API needed)
  const { data: event, error } = await admin
    .from('calendar_events')
    .insert({
      user_id: user.id,
      google_event_id: `sophia-prep-${commitment_id}`,
      title: `Prep: ${commitment.title}`,
      description: `Preparation time for: ${commitment.title}\nFor: ${commitment.contact_name || 'N/A'}\nDeadline: ${commitment.deadline || 'ASAP'}`,
      start_time: prepDate.toISOString(),
      end_time: endTime.toISOString(),
      is_recurring: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event, message: `Blocked ${duration_minutes} min for "${commitment.title}"` })
}
