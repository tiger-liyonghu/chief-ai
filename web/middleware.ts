import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Redirect /dashboard root paths to the correct nested routes
  // The (dashboard) group is transparent in the URL
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
