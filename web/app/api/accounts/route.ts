import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** GET /api/accounts — list all connected email accounts for the current user */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: accounts, error } = await admin
    .from('google_accounts')
    .select('id, google_email, google_name, google_avatar, provider, created_at')
    .eq('user_id', user.id)
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

  // Verify the account belongs to this user
  const { data: account, error: fetchError } = await admin
    .from('google_accounts')
    .select('id, google_email')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Cascade: delete associated emails and calendar events
  await admin.from('emails').delete()
    .eq('user_id', user.id)
    .eq('source_account_email', account.google_email)
  await admin.from('calendar_events').delete()
    .eq('user_id', user.id)
    .eq('source_account_email', account.google_email)

  // Delete the account
  const { error: deleteError } = await admin
    .from('google_accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', user.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, removed: account.google_email })
}
