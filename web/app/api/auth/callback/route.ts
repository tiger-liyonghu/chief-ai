import { NextRequest, NextResponse } from 'next/server'
import { getTokensFromCode, getOAuth2Client } from '@/lib/google/auth'
import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/google/tokens'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url))
  }

  try {
    // Exchange code for tokens
    const tokens = await getTokensFromCode(code)
    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(new URL('/login?error=no_tokens', request.url))
    }

    // Get user info from Google
    const auth = getOAuth2Client()
    auth.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth })
    const { data: userInfo } = await oauth2.userinfo.get()

    const supabase = createAdminClient()

    // Check if user exists in profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userInfo.email!)
      .single()

    let userId: string

    if (existingProfile) {
      userId = existingProfile.id
    } else {
      // Try to create user in Supabase Auth, or find existing
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: userInfo.email!,
        email_confirm: true,
        user_metadata: {
          full_name: userInfo.name,
          avatar_url: userInfo.picture,
        },
      })

      if (authError && authError.code === 'email_exists') {
        // User exists in Auth but not in profiles — find them
        const { data: { users } } = await supabase.auth.admin.listUsers()
        const existingUser = users?.find(u => u.email === userInfo.email)
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
        email: userInfo.email!,
        full_name: userInfo.name,
        gdpr_consent_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    }

    // Store encrypted tokens (legacy table)
    await supabase.from('google_tokens').upsert({
      user_id: userId,
      access_token_encrypted: encrypt(tokens.access_token),
      refresh_token_encrypted: encrypt(tokens.refresh_token),
      token_expires_at: new Date(tokens.expiry_date || Date.now() + 3600000).toISOString(),
    }, { onConflict: 'user_id' })

    // Also store in google_accounts (multi-account table)
    // If no accounts exist yet, mark as primary
    const { count: existingAccountCount } = await supabase
      .from('google_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    const isPrimary = !existingAccountCount || existingAccountCount === 0

    await supabase.from('google_accounts').upsert({
      user_id: userId,
      google_email: userInfo.email!,
      google_name: userInfo.name || null,
      google_avatar: userInfo.picture || null,
      is_primary: isPrimary,
      access_token_encrypted: encrypt(tokens.access_token),
      refresh_token_encrypted: encrypt(tokens.refresh_token),
      token_expires_at: new Date(tokens.expiry_date || Date.now() + 3600000).toISOString(),
    }, { onConflict: 'user_id,google_email' })

    // Check if this is a first-time user who needs onboarding
    const { data: profileCheck } = await supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', userId)
      .single()

    const needsOnboarding = !profileCheck?.onboarding_completed_at

    // Generate a session for the user
    const { data: session, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userInfo.email!,
    })
    if (sessionError) throw sessionError

    // Redirect to the magic link which will set the session
    const redirectUrl = new URL('/api/auth/session', request.url)
    redirectUrl.searchParams.set('token_hash', session.properties.hashed_token)
    redirectUrl.searchParams.set('type', 'magiclink')
    redirectUrl.searchParams.set('user_id', userId)

    const response = NextResponse.redirect(redirectUrl)

    // Set cookie flag if user needs onboarding
    if (needsOnboarding) {
      response.cookies.set('chief-needs-onboarding', 'true', {
        path: '/',
        maxAge: 60 * 30, // 30 minutes — enough time to complete onboarding
        httpOnly: false, // Client-side JS needs to read this
        sameSite: 'lax',
      })
    }

    return response
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
  }
}
