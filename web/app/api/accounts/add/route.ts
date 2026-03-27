import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUrl } from '@/lib/google/auth'

/** GET /api/accounts/add — redirect to Google OAuth to add a new account */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!))
  }

  // Encode user_id in state so the callback knows who is adding the account
  const state = JSON.stringify({ action: 'add_account', userId: user.id })
  const stateEncoded = Buffer.from(state).toString('base64url')

  const url = getAuthUrl({
    state: stateEncoded,
    redirectPath: '/api/accounts/callback',
  })

  return NextResponse.redirect(url)
}
