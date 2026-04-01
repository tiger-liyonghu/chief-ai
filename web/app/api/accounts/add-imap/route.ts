/**
 * POST /api/accounts/add-imap
 *
 * Add an IMAP email account (163, QQ, 126, or custom).
 * Validates the connection first, then stores encrypted credentials.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/google/tokens'
import { verifyImapConnection, detectPreset, IMAP_PRESETS } from '@/lib/imap/client'

interface AddImapRequest {
  email: string
  password: string  // authorization code
  preset?: string   // '163' | 'qq' | '126' | 'yeah' | 'custom'
  imapHost?: string  // required if preset is 'custom'
  imapPort?: number
  smtpHost?: string
  smtpPort?: number
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: AddImapRequest = await request.json()
    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email address and authorization code are required' },
        { status: 400 },
      )
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address format' },
        { status: 400 },
      )
    }

    // Determine IMAP/SMTP config from preset or custom
    const preset = body.preset || detectPreset(email)
    const presetConfig = IMAP_PRESETS[preset] || IMAP_PRESETS['custom']

    const imapHost = body.imapHost || presetConfig.imap.host
    const imapPort = body.imapPort || presetConfig.imap.port
    const smtpHost = body.smtpHost || presetConfig.smtp.host
    const smtpPort = body.smtpPort || presetConfig.smtp.port

    if (!imapHost || !smtpHost) {
      return NextResponse.json(
        { error: 'IMAP and SMTP host are required for custom providers' },
        { status: 400 },
      )
    }

    // Verify IMAP connection with provided credentials
    try {
      await verifyImapConnection({
        host: imapHost,
        port: imapPort,
        email,
        password,
      })
    } catch (err: any) {
      return NextResponse.json(
        { error: `Connection failed: ${err.message}. Please check your email and authorization code.` },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    // Check if this user already has this email bound (re-auth → update)
    const { data: ownExisting } = await admin
      .from('google_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('google_email', email)
      .eq('provider', 'imap')
      .single()

    if (ownExisting) {
      await admin.from('google_accounts').update({
        access_token_encrypted: encrypt(password),
        refresh_token_encrypted: encrypt(JSON.stringify({
          imapHost, imapPort, smtpHost, smtpPort, preset,
        })),
        token_expires_at: '2099-12-31T23:59:59Z',
        updated_at: new Date().toISOString(),
      }).eq('id', ownExisting.id)

      return NextResponse.json({
        ok: true,
        action: 'updated',
        email,
        accountId: ownExisting.id,
      })
    }

    // Check if this email is already bound by ANOTHER user (global unique)
    const { data: otherExisting } = await admin
      .from('google_accounts')
      .select('id')
      .eq('google_email', email)
      .eq('provider', 'imap')
      .single()

    if (otherExisting) {
      return NextResponse.json(
        { error: 'This email is already connected by another account.' },
        { status: 409 },
      )
    }

    // Enforce max 3 accounts per user
    const { count } = await admin
      .from('google_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (count && count >= 3) {
      return NextResponse.json(
        { error: 'Maximum 3 email accounts allowed.' },
        { status: 400 },
      )
    }

    // Store new IMAP account
    const { data: newAccount, error: insertError } = await admin
      .from('google_accounts')
      .insert({
        user_id: user.id,
        google_email: email,
        google_name: email.split('@')[0],
        provider: 'imap',
        access_token_encrypted: encrypt(password),
        refresh_token_encrypted: encrypt(JSON.stringify({
          imapHost, imapPort, smtpHost, smtpPort, preset,
        })),
        token_expires_at: '2099-12-31T23:59:59Z',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to insert IMAP account:', insertError)
      return NextResponse.json(
        { error: 'Failed to save account. Please try again.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      action: 'created',
      email,
      accountId: newAccount.id,
    })
  } catch (err: any) {
    console.error('add-imap error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
