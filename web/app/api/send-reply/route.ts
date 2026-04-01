import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken } from '@/lib/google/tokens'
import { decrypt } from '@/lib/google/tokens'
import { createRawEmail, sendMessage } from '@/lib/google/gmail'
import { sendSmtpMessage, IMAP_PRESETS } from '@/lib/imap/client'

/**
 * Determine how to send an email based on the sender's account provider.
 * Returns 'gmail' | 'outlook' | 'imap' and the account row.
 */
async function resolveAccountProvider(userId: string, fromEmail?: string) {
  const admin = createAdminClient()

  // If a fromEmail is specified, find its account
  if (fromEmail) {
    const { data: account } = await admin
      .from('google_accounts')
      .select('id, google_email, provider, access_token_encrypted, refresh_token_encrypted')
      .eq('user_id', userId)
      .eq('google_email', fromEmail)
      .single()
    if (account) return account
  }

  // Fall back to first account
  const { data: account } = await admin
    .from('google_accounts')
    .select('id, google_email, provider, access_token_encrypted, refresh_token_encrypted')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  return account
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { emailId, to, subject, body, threadId, messageId, fromEmail } = await request.json()

  if (!to || !subject || !body) {
    return NextResponse.json(
      { error: 'Missing required fields: to, subject, body' },
      { status: 400 }
    )
  }

  try {
    const account = await resolveAccountProvider(user.id, fromEmail)

    if (!account) {
      return NextResponse.json(
        { error: 'No email account configured. Please add an account in Settings.' },
        { status: 400 }
      )
    }

    let resultId: string

    if (account.provider === 'imap') {
      // --- IMAP/SMTP path ---
      const password = decrypt(account.access_token_encrypted)
      const serverConfig = JSON.parse(decrypt(account.refresh_token_encrypted))
      const smtpHost = serverConfig.smtpHost
      const smtpPort = serverConfig.smtpPort

      if (!smtpHost) {
        return NextResponse.json(
          { error: 'SMTP configuration missing for this IMAP account' },
          { status: 400 }
        )
      }

      const result = await sendSmtpMessage(
        { host: smtpHost, port: smtpPort, email: account.google_email, password },
        to,
        subject,
        body,
        messageId ? { replyTo: to } : undefined
      )
      resultId = result.messageId
    } else {
      // --- Gmail / Outlook API path ---
      const accessToken = await getValidAccessToken(user.id)
      const raw = createRawEmail(to, subject, body, threadId, messageId)
      const result = await sendMessage(accessToken, raw)
      resultId = result.id || 'sent'
    }

    const admin = createAdminClient()

    // Mark the email as no longer needing a reply (if emailId provided)
    if (emailId) {
      await admin
        .from('emails')
        .update({ is_reply_needed: false })
        .eq('id', emailId)
        .eq('user_id', user.id)

      // Save the sent reply in reply_drafts table
      await admin
        .from('reply_drafts')
        .insert({
          email_id: emailId,
          user_id: user.id,
          body,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
    }

    return NextResponse.json({ ok: true, messageId: resultId })
  } catch (err: any) {
    console.error('Failed to send reply:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to send reply' },
      { status: 500 }
    )
  }
}
