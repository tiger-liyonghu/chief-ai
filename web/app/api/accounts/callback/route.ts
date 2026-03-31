import { NextRequest, NextResponse } from 'next/server'
import { getTokensFromCode, getOAuth2Client } from '@/lib/google/auth'
import { getPublicOrigin } from '@/lib/auth/redirect'
import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/google/tokens'

export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request.url, request.headers)
  const code = request.nextUrl.searchParams.get('code')
  const stateParam = request.nextUrl.searchParams.get('state')

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=missing_params', origin)
    )
  }

  try {
    // Decode and VERIFY HMAC-signed state (prevent IDOR)
    const crypto = await import('crypto')
    const stateWrapper = JSON.parse(Buffer.from(stateParam, 'base64url').toString())

    // Verify HMAC signature
    if (!stateWrapper.p || !stateWrapper.s) {
      return NextResponse.redirect(new URL('/dashboard/settings?error=invalid_state', origin))
    }
    const expectedHmac = crypto.createHmac('sha256', process.env.TOKEN_ENCRYPTION_KEY || 'fallback-key')
      .update(stateWrapper.p).digest('hex')
    if (!crypto.timingSafeEqual(Buffer.from(stateWrapper.s, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
      return NextResponse.redirect(new URL('/dashboard/settings?error=invalid_state', origin))
    }

    const state = JSON.parse(stateWrapper.p)
    if (state.action !== 'add_account' || !state.userId) {
      return NextResponse.redirect(new URL('/dashboard/settings?error=invalid_state', origin))
    }

    // Reject states older than 10 minutes
    if (state.ts && Date.now() - state.ts > 10 * 60 * 1000) {
      return NextResponse.redirect(new URL('/dashboard/settings?error=expired_state', origin))
    }

    const userId = state.userId

    // Exchange code for tokens using the add-account callback URI
    const tokens = await getTokensFromCode(code, '/api/accounts/callback', request.headers)
    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=no_tokens', origin)
      )
    }

    // Get user info from Google for this account
    const auth = getOAuth2Client('/api/accounts/callback', request.headers)
    auth.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth })
    const { data: userInfo } = await oauth2.userinfo.get()

    if (!userInfo.email) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=no_email', origin)
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
        new URL('/dashboard/settings?account_updated=' + encodeURIComponent(userInfo.email), origin)
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
      new URL('/dashboard/settings?account_added=' + encodeURIComponent(userInfo.email), origin)
    )
  } catch (error) {
    console.error('Add account callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=add_failed', origin)
    )
  }
}
