import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendDigestForUser } from '@/lib/digest/send-digest'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await sendDigestForUser(user.id)

  if (result.ok) {
    return NextResponse.json({ ok: true, sent_to: result.sent_to })
  } else {
    return NextResponse.json(
      { error: result.error || 'Failed to send digest email' },
      { status: 500 }
    )
  }
}
