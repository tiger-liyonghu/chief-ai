import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { enabled, time } = await request.json()

  // Validate time format HH:MM
  if (time !== undefined) {
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/
    if (!timeRegex.test(time)) {
      return NextResponse.json(
        { error: 'Invalid time format. Use HH:MM (24-hour).' },
        { status: 400 }
      )
    }
  }

  const admin = createAdminClient()

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (time !== undefined) updates.daily_brief_time = time
  if (enabled !== undefined) updates.daily_brief_enabled = enabled

  const { error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, time, enabled })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile, error } = await admin
    .from('profiles')
    .select('daily_brief_time, daily_brief_enabled')
    .eq('id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    time: profile?.daily_brief_time || '08:00',
    enabled: profile?.daily_brief_enabled ?? false,
  })
}
