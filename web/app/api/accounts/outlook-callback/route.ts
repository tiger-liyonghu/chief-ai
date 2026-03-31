import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMicrosoftTokensFromCode, getMicrosoftProfile } from '@/lib/microsoft/auth'
import { encrypt } from '@/lib/google/tokens'
import { getPublicOrigin } from '@/lib/auth/redirect'

/**
 * GET /api/accounts/outlook-callback
 * Microsoft OAuth callback — store tokens and redirect back to settings.
 */
export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request.url, request.headers)
  const code = request.nextUrl.searchParams.get('code')
  const stateParam = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    console.error('Microsoft OAuth error:', error, request.nextUrl.searchParams.get('error_description'))
    return NextResponse.redirect(new URL('/dashboard/settings?error=microsoft_auth_failed', origin))
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL('/dashboard/settings?error=missing_code', origin))
  }

  let state: { action: string; userId: string }
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64').toString())
  } catch {
    return NextResponse.redirect(new URL('/dashboard/settings?error=invalid_state', origin))
  }

  if (state.action !== 'add_outlook' || !state.userId) {
    return NextResponse.redirect(new URL('/dashboard/settings?error=invalid_state', origin))
  }

  try {
    // Exchange code for tokens
    const tokens = await getMicrosoftTokensFromCode(code)

    // Get user profile
    const profile = await getMicrosoftProfile(tokens.access_token)
    const email = profile.mail || profile.userPrincipalName

    const admin = createAdminClient()

    // Check how many accounts user has (to determine is_primary)
    const { count: existingCount } = await admin
      .from('google_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', state.userId)

    // Upsert Microsoft account
    await admin.from('google_accounts').upsert({
      user_id: state.userId,
      google_email: email, // using same column name for compatibility
      google_name: profile.displayName,
      google_avatar: null,
      is_primary: !existingCount || existingCount === 0,
      provider: 'microsoft',
      access_token_encrypted: encrypt(tokens.access_token),
      refresh_token_encrypted: encrypt(tokens.refresh_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }, { onConflict: 'user_id,google_email,provider' })

    return NextResponse.redirect(
      new URL(`/dashboard/settings?account_added=${encodeURIComponent(email)}`, origin),
    )
  } catch (err: any) {
    console.error('Microsoft OAuth callback error:', err)
    return NextResponse.redirect(new URL('/dashboard/settings?error=microsoft_token_failed', origin))
  }
}
