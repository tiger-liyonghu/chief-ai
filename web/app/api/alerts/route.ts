import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectAlerts } from '@/lib/alerts/detect'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const admin = createAdminClient()
    const result = await detectAlerts(admin, user.id)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Alert detection failed:', err)
    return NextResponse.json(
      { error: 'Failed to detect alerts', detail: err.message },
      { status: 500 },
    )
  }
}
