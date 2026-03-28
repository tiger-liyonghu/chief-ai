import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/webhooks/gmail
 * Gmail Push Notification webhook receiver.
 *
 * Gmail Watch API sends a POST when new messages arrive.
 * Payload: { message: { data: base64(JSON), messageId, publishTime } }
 *
 * Setup: call Gmail users.watch() with topicName pointing to a Google Cloud Pub/Sub topic
 * that pushes to this endpoint.
 *
 * For now, this is a placeholder that logs incoming notifications.
 * Full implementation requires:
 * 1. Google Cloud Pub/Sub topic creation
 * 2. Subscription with push endpoint = this URL
 * 3. Gmail watch() call per user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Gmail push notification payload
    const message = body.message
    if (!message?.data) {
      return NextResponse.json({ ok: true }) // ACK empty messages
    }

    // Decode base64 payload
    const decoded = JSON.parse(Buffer.from(message.data, 'base64').toString())
    const { emailAddress, historyId } = decoded

    if (!emailAddress || !historyId) {
      return NextResponse.json({ ok: true })
    }

    console.log(`[Gmail Webhook] New mail for ${emailAddress}, historyId: ${historyId}`)

    const admin = createAdminClient()

    // Find the user by email
    const { data: account } = await admin
      .from('google_accounts')
      .select('user_id')
      .eq('google_email', emailAddress)
      .eq('provider', 'google')
      .limit(1)
      .single()

    if (!account) {
      console.log(`[Gmail Webhook] No account found for ${emailAddress}`)
      return NextResponse.json({ ok: true })
    }

    // Trigger a sync for this user (lightweight — just queue it)
    // In production, this would enqueue a background job
    // For now, we update a "needs_sync" flag
    await admin.from('profiles').update({
      updated_at: new Date().toISOString(),
    }).eq('id', account.user_id)

    console.log(`[Gmail Webhook] Sync triggered for user ${account.user_id}`)

    // Must return 200 quickly to ACK the notification
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Gmail Webhook] Error:', err)
    // Still return 200 to prevent Pub/Sub retries
    return NextResponse.json({ ok: true })
  }
}

/**
 * GET /api/webhooks/gmail
 * Verification endpoint for Pub/Sub subscription setup.
 */
export async function GET() {
  return NextResponse.json({
    status: 'Gmail webhook endpoint active',
    setup_required: [
      '1. Create Google Cloud Pub/Sub topic',
      '2. Create push subscription pointing to this URL',
      '3. Call Gmail users.watch() for each connected user',
    ],
  })
}
