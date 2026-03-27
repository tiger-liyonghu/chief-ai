import { NextRequest, NextResponse } from 'next/server'
import { getTokensFromCode, getOAuth2Client } from '@/lib/google/auth'
import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/google/tokens'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const stateParam = request.nextUrl.searchParams.get('state')

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=missing_params', request.url)
    )
  }

  try {
    // Decode state to get user info
    const state = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
    if (state.action !== 'add_account' || !state.userId) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=invalid_state', request.url)
      )
    }

    const userId = state.userId

    // Exchange code for tokens using the add-account callback URI
    const tokens = await getTokensFromCode(code, '/api/accounts/callback')
    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=no_tokens', request.url)
      )
    }

    // Get user info from Google for this account
    const auth = getOAuth2Client('/api/accounts/callback')
    auth.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth })
    const { data: userInfo } = await oauth2.userinfo.get()

    if (!userInfo.email) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=no_email', request.url)
      )
    }

    const supabase = createAdminClient()

    // Check if this google_email is already connected for this user
    const { data: existing } = await supabase
      .from('google_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('google_email', userInfo.email)
      .single()

    if (existing) {
      // Update tokens for existing account
      await supabase.from('google_accounts').update({
        access_token_encrypted: encrypt(tokens.access_token),
        refresh_token_encrypted: encrypt(tokens.refresh_token),
        token_expires_at: new Date(tokens.expiry_date || Date.now() + 3600000).toISOString(),
        google_name: userInfo.name || null,
        google_avatar: userInfo.picture || null,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)

      return NextResponse.redirect(
        new URL('/dashboard/settings?account_updated=' + encodeURIComponent(userInfo.email), request.url)
      )
    }

    // Check if this is the user's first account (should be primary)
    const { count } = await supabase
      .from('google_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    const isFirst = !count || count === 0

    // Insert new account
    await supabase.from('google_accounts').insert({
      user_id: userId,
      google_email: userInfo.email,
      google_name: userInfo.name || null,
      google_avatar: userInfo.picture || null,
      is_primary: isFirst,
      access_token_encrypted: encrypt(tokens.access_token),
      refresh_token_encrypted: encrypt(tokens.refresh_token),
      token_expires_at: new Date(tokens.expiry_date || Date.now() + 3600000).toISOString(),
    })

    return NextResponse.redirect(
      new URL('/dashboard/settings?account_added=' + encodeURIComponent(userInfo.email), request.url)
    )
  } catch (error) {
    console.error('Add account callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=add_failed', request.url)
    )
  }
}
