import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const now = new Date()
  const twoWeeksLater = new Date(now.getTime() + 14 * 86400000)

  const { data: events, error } = await admin
    .from('calendar_events')
    .select('*')
    .eq('user_id', user.id)
    .gte('start_time', now.toISOString())
    .lte('start_time', twoWeeksLater.toISOString())
    .order('start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(events || [])
}
