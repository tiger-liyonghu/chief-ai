import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google/auth'

export async function GET(request: NextRequest) {
  const url = getAuthUrl({ headers: request.headers })
  return NextResponse.redirect(url)
}
