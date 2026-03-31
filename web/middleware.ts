import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Unauthenticated users accessing /dashboard/* or /onboarding → redirect to /login
  if (!user && (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname === '/onboarding')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated users on /login → always send to dashboard
  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Onboarding check: use cookie set by auth callback, not DB query.
  // DB query in middleware was unreliable — if /api/onboarding failed to write
  // onboarding_completed_at for any reason, users got stuck in a redirect loop.
  if (user && request.nextUrl.pathname === '/dashboard') {
    const needsOnboarding = request.cookies.get('chief-needs-onboarding')?.value === 'true'
    if (needsOnboarding) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/onboarding'],
}
