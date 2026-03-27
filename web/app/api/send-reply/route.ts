import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken } from '@/lib/google/tokens'
import { createRawEmail, sendMessage } from '@/lib/google/gmail'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { emailId, to, subject, body, threadId, messageId } = await request.json()

  if (!emailId || !to || !subject || !body) {
    return NextResponse.json(
      { error: 'Missing required fields: emailId, to, subject, body' },
      { status: 400 }
    )
  }

  try {
    const accessToken = await getValidAccessToken(user.id)

    const raw = createRawEmail(to, subject, body, threadId, messageId)
    const result = await sendMessage(accessToken, raw)

    const admin = createAdminClient()

    // Mark the email as no longer needing a reply
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

    return NextResponse.json({ ok: true, gmailMessageId: result.id })
  } catch (err: any) {
    console.error('Failed to send reply:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to send reply' },
      { status: 500 }
    )
  }
}
