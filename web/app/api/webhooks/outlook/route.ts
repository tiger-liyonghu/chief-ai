import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/webhooks/outlook
 * Microsoft Graph subscription webhook receiver.
 *
 * Graph sends a POST when subscribed resources change (new mail, calendar events).
 *
 * Setup: create a subscription via Graph API:
 * POST /subscriptions { changeType: "created", resource: "me/mailFolders/inbox/messages",
 *   notificationUrl: "https://chief-ai-delta.vercel.app/api/webhooks/outlook",
 *   expirationDateTime: "...", clientState: "secret" }
 */
export async function POST(request: NextRequest) {
  // Graph validation: on subscription creation, Graph sends a validation token
  const validationToken = request.nextUrl.searchParams.get('validationToken')
  if (validationToken) {
    // Must return the token as plain text to validate the subscription
    return new Response(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  try {
    const body = await request.json()
    const notifications = body.value || []

    const admin = createAdminClient()

    for (const notification of notifications) {
      // Verify client state (shared secret)
      if (notification.clientState !== process.env.OUTLOOK_WEBHOOK_SECRET) {
        console.warn('[Outlook Webhook] Invalid clientState')
        continue
      }

      const { resource, changeType, subscriptionId } = notification
      console.log(`[Outlook Webhook] ${changeType} on ${resource}, subscription: ${subscriptionId}`)

      // Find user by subscription (would need a subscriptions table in production)
      // For now, log and trigger sync
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Outlook Webhook] Error:', err)
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Outlook webhook endpoint active',
    setup_required: [
      '1. Set OUTLOOK_WEBHOOK_SECRET env var',
      '2. Create Graph subscription via POST /subscriptions',
      '3. Renew subscription before expiration (max 4230 minutes)',
    ],
  })
}
