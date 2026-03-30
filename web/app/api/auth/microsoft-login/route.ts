import { NextResponse } from 'next/server'
import { getMicrosoftAuthUrl } from '@/lib/microsoft/auth'

/**
 * GET /api/auth/microsoft-login
 * Redirect to Microsoft OAuth for initial login (no auth required).
 * Uses state to distinguish login flow from add-account flow.
 */
export async function GET() {
  const state = Buffer.from(JSON.stringify({
    action: 'login',
  })).toString('base64')

  const authUrl = getMicrosoftAuthUrl({
    state,
    redirectPath: '/api/auth/microsoft-callback',
  })

  return NextResponse.redirect(authUrl)
}
