import { buildRedirectUrl } from '@/lib/auth/redirect'
import { NextRequest, NextResponse } from 'next/server'
import { getMicrosoftTokensFromCode, getMicrosoftProfile } from '@/lib/microsoft/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/google/tokens'

/**
 * GET /api/auth/microsoft-callback
 * Microsoft OAuth callback for initial login.
 * Creates or finds a user in Supabase, stores tokens, and establishes a session.
 * Mirrors the Google OAuth callback flow at /api/auth/callback.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const stateParam = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    console.error('Microsoft OAuth error:', error, request.nextUrl.searchParams.get('error_description'))
    return NextResponse.redirect(buildRedirectUrl('/login?error=microsoft_auth_failed', request.url))
  }

  if (!code) {
    return NextResponse.redirect(buildRedirectUrl('/login?error=no_code', request.url))
  }

  // Validate state
  let state: { action: string }
  try {
    state = JSON.parse(Buffer.from(stateParam || '', 'base64').toString())
  } catch {
    return NextResponse.redirect(buildRedirectUrl('/login?error=invalid_state', request.url))
  }

  if (state.action !== 'login') {
    return NextResponse.redirect(buildRedirectUrl('/login?error=invalid_state', request.url))
  }

  try {
    // Exchange code for tokens
    const tokens = await getMicrosoftTokensFromCode(code, '/api/auth/microsoft-callback')
    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(buildRedirectUrl('/login?error=no_tokens', request.url))
    }

    // Get user profile from Microsoft Graph
    const profile = await getMicrosoftProfile(tokens.access_token)
    const email = profile.mail || profile.userPrincipalName
    if (!email) {
      return NextResponse.redirect(buildRedirectUrl('/login?error=no_email', request.url))
    }

    const supabase = createAdminClient()

    // Check if user exists in profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    let userId: string

    if (existingProfile) {
      userId = existingProfile.id
    } else {
      // Create user in Supabase Auth
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: profile.displayName,
        },
      })

      if (authError && authError.code === 'email_exists') {
        // User exists in Auth but not in profiles — find them
        const { data: { users } } = await supabase.auth.admin.listUsers()
        const existingUser = users?.find(u => u.email === email)
        if (!existingUser) throw new Error('User exists but not found')
        userId = existingUser.id
      } else if (authError) {
        throw authError
      } else {
        userId = authUser.user.id
      }

      // Ensure profile exists
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: profile.displayName,
        gdpr_consent_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    }

    // Store Microsoft account in google_accounts (multi-account table)
    const { count: existingAccountCount } = await supabase
      .from('google_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    const isPrimary = !existingAccountCount || existingAccountCount === 0

    await supabase.from('google_accounts').upsert({
      user_id: userId,
      google_email: email,
      google_name: profile.displayName,
      google_avatar: null,
      is_primary: isPrimary,
      provider: 'microsoft',
      access_token_encrypted: encrypt(tokens.access_token),
      refresh_token_encrypted: encrypt(tokens.refresh_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }, { onConflict: 'user_id,google_email,provider' })

    // Check if this is a first-time user who needs onboarding
    const { data: profileCheck } = await supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', userId)
      .single()

    const needsOnboarding = !profileCheck?.onboarding_completed_at

    // Generate a session via magic link (same as Google flow)
    const { data: session, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    if (sessionError) throw sessionError

    const redirectUrl = buildRedirectUrl('/api/auth/session', request.url)
    redirectUrl.searchParams.set('token_hash', session.properties.hashed_token)
    redirectUrl.searchParams.set('type', 'magiclink')
    redirectUrl.searchParams.set('user_id', userId)

    const response = NextResponse.redirect(redirectUrl)

    if (needsOnboarding) {
      response.cookies.set('chief-needs-onboarding', 'true', {
        path: '/',
        maxAge: 60 * 30,
        httpOnly: false,
        sameSite: 'lax',
      })
    }

    return response
  } catch (err) {
    console.error('Microsoft OAuth callback error:', err)
    return NextResponse.redirect(buildRedirectUrl('/login?error=auth_failed', request.url))
  }
}
