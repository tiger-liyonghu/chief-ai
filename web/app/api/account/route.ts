import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Delete the user's profile (cascades to all related data)
  const { error: profileError } = await admin
    .from('profiles')
    .delete()
    .eq('id', user.id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Delete the auth user
  const { error: authError } = await admin.auth.admin.deleteUser(user.id)

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  // Sign out the current session
  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}
