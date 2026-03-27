import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMicrosoftAuthUrl } from '@/lib/microsoft/auth'

/**
 * GET /api/accounts/add-outlook
 * Redirect user to Microsoft OAuth to add an Outlook account.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = Buffer.from(JSON.stringify({
    action: 'add_outlook',
    userId: user.id,
  })).toString('base64')

  const authUrl = getMicrosoftAuthUrl({ state })
  return NextResponse.redirect(authUrl)
}
