import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken } from '@/lib/google/tokens'
import {
  getMessage,
  parseEmailHeaders,
  parseEmailBody,
  createForwardEmail,
  sendMessage,
} from '@/lib/google/gmail'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { emailId, to, note } = await request.json()

  if (!emailId || !to) {
    return NextResponse.json(
      { error: 'Missing required fields: emailId, to' },
      { status: 400 }
    )
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json(
      { error: 'Invalid recipient email address' },
      { status: 400 }
    )
  }

  try {
    const admin = createAdminClient()

    // Fetch original email record from DB
    const { data: emailRecord, error: dbError } = await admin
      .from('emails')
      .select('subject, from_name, from_address, snippet, gmail_id, received_at')
      .eq('id', emailId)
      .eq('user_id', user.id)
      .single()

    if (dbError || !emailRecord) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    const accessToken = await getValidAccessToken(user.id)

    // Fetch full body from Gmail API for complete forwarding
    let fullBody = emailRecord.snippet || ''
    if (emailRecord.gmail_id) {
      try {
        const gmailMsg = await getMessage(accessToken, emailRecord.gmail_id)
        const parsedBody = parseEmailBody(gmailMsg.payload)
        if (parsedBody) fullBody = parsedBody
      } catch {
        // Fall back to snippet if Gmail fetch fails
      }
    }

    const originalFrom = emailRecord.from_name
      ? `${emailRecord.from_name} <${emailRecord.from_address}>`
      : emailRecord.from_address

    const originalDate = emailRecord.received_at
      ? new Date(emailRecord.received_at).toLocaleString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        })
      : 'Unknown date'

    const raw = createForwardEmail(
      to,
      emailRecord.subject || '(no subject)',
      originalFrom,
      originalDate,
      fullBody,
      undefined,
      note || undefined,
    )

    const result = await sendMessage(accessToken, raw)

    return NextResponse.json({ ok: true, gmailMessageId: result.id })
  } catch (err: any) {
    console.error('Failed to forward email:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to forward email' },
      { status: 500 }
    )
  }
}
