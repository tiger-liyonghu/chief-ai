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

  // Get the contact's email
  const { data: contact } = await admin
    .from('contacts')
    .select('email')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!contact?.email) {
    return NextResponse.json({ meeting: null })
  }

  // Find next calendar event where attendees contains this contact's email
  const { data: event } = await admin
    .from('calendar_events')
    .select('title, start_time')
    .eq('user_id', user.id)
    .gte('start_time', new Date().toISOString())
    .ilike('attendees', `%${contact.email}%`)
    .order('start_time', { ascending: true })
    .limit(1)
    .single()

  return NextResponse.json({ meeting: event || null })
}
