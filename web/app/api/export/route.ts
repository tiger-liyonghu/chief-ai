import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const userId = user.id

  // Fetch all user data in parallel
  const [
    { data: profile },
    { data: commitments },
    { data: contacts },
    { data: emails },
    { data: calendarEvents },
    { data: familyCalendar },
    { data: trips },
    { data: expenses },
    { data: tasks },
    { data: insightsSnapshots },
  ] = await Promise.all([
    admin.from('profiles').select('*').eq('id', userId).single(),
    admin.from('commitments').select('*').eq('user_id', userId),
    admin.from('contacts').select('*').eq('user_id', userId),
    admin.from('emails').select('id, subject, from_address, to_address, date, snippet, is_read, has_attachments, created_at').eq('user_id', userId),
    admin.from('calendar_events').select('*').eq('user_id', userId),
    admin.from('family_calendar').select('*').eq('user_id', userId),
    admin.from('trips').select('*').eq('user_id', userId),
    admin.from('expenses').select('*').eq('user_id', userId),
    admin.from('tasks').select('*').eq('user_id', userId),
    admin.from('insights_snapshots').select('*').eq('user_id', userId),
  ])

  const exportData = {
    exported_at: new Date().toISOString(),
    user: {
      id: userId,
      email: user.email,
    },
    profile: profile || null,
    commitments: commitments || [],
    contacts: contacts || [],
    emails: emails || [],
    calendar_events: calendarEvents || [],
    family_calendar: familyCalendar || [],
    trips: trips || [],
    expenses: expenses || [],
    tasks: tasks || [],
    insights_snapshots: insightsSnapshots || [],
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="chief-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
