import { NextRequest, NextResponse } from 'next/server'
import { buildRedirectUrl } from '@/lib/auth/redirect'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')

  if (!tokenHash || !type) {
    return NextResponse.redirect(buildRedirectUrl('/login?error=invalid_session', request.url, request.headers))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as any,
  })

  if (error) {
    console.error('Session verification error:', error)
    return NextResponse.redirect(buildRedirectUrl('/login?error=session_failed', request.url, request.headers))
  }

  // Check if user needs onboarding (new user without completed onboarding)
  const userId = request.nextUrl.searchParams.get('user_id')
  if (userId) {
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', userId)
      .single()

    if (!profile?.onboarding_completed_at) {
      return NextResponse.redirect(buildRedirectUrl('/onboarding', request.url, request.headers))
    }
  }

  return NextResponse.redirect(buildRedirectUrl('/dashboard', request.url, request.headers))
}
