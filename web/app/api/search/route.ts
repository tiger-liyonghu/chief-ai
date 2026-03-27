import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const LIMIT_PER_TYPE = 10

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: 'Query must be at least 2 characters' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // Build ILIKE patterns for relevance ordering:
  // exact match > starts with > contains
  const exactPattern = q
  const startsWithPattern = `${q}%`
  const containsPattern = `%${q}%`

  // Run all searches in parallel
  const [emailsResult, tasksResult, followUpsResult, eventsResult] =
    await Promise.all([
      // Emails: search subject, from_name, from_address, snippet
      admin
        .from('emails')
        .select('id, subject, from_name, from_address, snippet, received_at, is_reply_needed')
        .eq('user_id', user.id)
        .or(
          `subject.ilike.${containsPattern},from_name.ilike.${containsPattern},from_address.ilike.${containsPattern},snippet.ilike.${containsPattern}`
        )
        .order('received_at', { ascending: false })
        .limit(LIMIT_PER_TYPE),

      // Tasks: search title, description, due_reason
      admin
        .from('tasks')
        .select('id, title, description, priority, status, due_date, due_reason, created_at')
        .eq('user_id', user.id)
        .or(
          `title.ilike.${containsPattern},description.ilike.${containsPattern},due_reason.ilike.${containsPattern}`
        )
        .order('created_at', { ascending: false })
        .limit(LIMIT_PER_TYPE),

      // Follow-ups: search contact_name, subject, commitment_text
      admin
        .from('follow_ups')
        .select('id, type, contact_name, contact_email, subject, commitment_text, due_date, status, created_at')
        .eq('user_id', user.id)
        .or(
          `contact_name.ilike.${containsPattern},subject.ilike.${containsPattern},commitment_text.ilike.${containsPattern}`
        )
        .order('created_at', { ascending: false })
        .limit(LIMIT_PER_TYPE),

      // Calendar events: search title, description, location
      admin
        .from('calendar_events')
        .select('id, title, description, start_time, end_time, location, meeting_link, created_at')
        .eq('user_id', user.id)
        .or(
          `title.ilike.${containsPattern},description.ilike.${containsPattern},location.ilike.${containsPattern}`
        )
        .order('start_time', { ascending: false })
        .limit(LIMIT_PER_TYPE),
    ])

  // Check for errors
  for (const result of [emailsResult, tasksResult, followUpsResult, eventsResult]) {
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }
  }

  const emails = emailsResult.data || []
  const tasks = tasksResult.data || []
  const follow_ups = followUpsResult.data || []
  const events = eventsResult.data || []

  return NextResponse.json({
    emails,
    tasks,
    follow_ups,
    events,
    total: emails.length + tasks.length + follow_ups.length + events.length,
  })
}
