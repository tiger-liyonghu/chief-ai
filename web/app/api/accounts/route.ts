import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** GET /api/accounts — list all connected Google accounts for the current user */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: accounts, error } = await admin
    .from('google_accounts')
    .select('id, google_email, google_name, google_avatar, is_primary, created_at')
    .eq('user_id', user.id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(accounts || [])
}

/** DELETE /api/accounts — remove a connected Google account */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { accountId } = await request.json()
  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify the account belongs to this user and is not primary
  const { data: account, error: fetchError } = await admin
    .from('google_accounts')
    .select('id, is_primary, google_email')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  if (account.is_primary) {
    return NextResponse.json(
      { error: 'Cannot remove your primary account. Change primary first.' },
      { status: 400 }
    )
  }

  // Delete the account
  const { error: deleteError } = await admin
    .from('google_accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', user.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Clean up emails and calendar events from this account
  // (optional: keep them but mark as orphaned — for now we keep them)

  return NextResponse.json({ ok: true, removed: account.google_email })
}
