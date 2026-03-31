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

  // Authenticated users on /login → send to dashboard (or onboarding if not completed)
  if (user && request.nextUrl.pathname === '/login') {
    const needsOnboarding = request.cookies.get('chief-needs-onboarding')?.value === 'true'
    return NextResponse.redirect(new URL(needsOnboarding ? '/onboarding' : '/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/onboarding'],
}
