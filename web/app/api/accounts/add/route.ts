import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUrl } from '@/lib/google/auth'
import { getPublicOrigin } from '@/lib/auth/redirect'

/** GET /api/accounts/add — redirect to Google OAuth to add a new account */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', getPublicOrigin(request.url, request.headers)))
  }

  // Encode user_id in state so the callback knows who is adding the account
  const state = JSON.stringify({ action: 'add_account', userId: user.id })
  const stateEncoded = Buffer.from(state).toString('base64url')

  const url = getAuthUrl({
    state: stateEncoded,
    redirectPath: '/api/accounts/callback',
    headers: request.headers,
  })

  return NextResponse.redirect(url)
}
