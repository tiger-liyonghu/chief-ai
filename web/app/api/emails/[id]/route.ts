import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken } from '@/lib/google/tokens'
import { getMessage, parseEmailBody } from '@/lib/google/gmail'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch email record from DB
  const admin = createAdminClient()
  const { data: email, error } = await admin
    .from('emails')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !email) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  }

  // If we already have cached body_text, return it
  if (email.body_text) {
    return NextResponse.json({
      id: email.id,
      subject: email.subject,
      from_name: email.from_name,
      from_address: email.from_address,
      body: email.body_text,
      received_at: email.received_at,
      thread_id: email.thread_id,
    })
  }

  // Fetch full body from Gmail API
  try {
    const accessToken = await getValidAccessToken(user.id)
    const gmailMessage = await getMessage(accessToken, email.gmail_message_id)
    const body = parseEmailBody(gmailMessage.payload)

    // Cache the body in DB so we don't re-fetch next time
    if (body) {
      await admin
        .from('emails')
        .update({ body_text: body })
        .eq('id', id)
    }

    return NextResponse.json({
      id: email.id,
      subject: email.subject,
      from_name: email.from_name,
      from_address: email.from_address,
      body: body || email.snippet || '',
      received_at: email.received_at,
      thread_id: email.thread_id,
    })
  } catch (err: any) {
    console.error('Failed to fetch email body from Gmail:', err.message)
    // Fallback to snippet if Gmail fetch fails
    return NextResponse.json({
      id: email.id,
      subject: email.subject,
      from_name: email.from_name,
      from_address: email.from_address,
      body: email.snippet || '',
      received_at: email.received_at,
      thread_id: email.thread_id,
    })
  }
}
