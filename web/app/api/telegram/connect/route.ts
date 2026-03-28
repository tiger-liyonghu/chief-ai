import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMe, setWebhook } from '@/lib/telegram/bot'

/**
 * GET /api/telegram/connect
 *
 * Returns the bot's t.me link and current connection status for the user.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const bot = await getMe()
    const botLink = `https://t.me/${bot.username}`

    // Check if user already has a connection
    const { data: connection } = await supabase
      .from('telegram_connections')
      .select('id, chat_id, username, first_name, is_active, created_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    return NextResponse.json({
      bot_username: bot.username,
      bot_link: botLink,
      connected: !!connection,
      connection: connection || null,
    })
  } catch (err) {
    console.error('[Telegram Connect GET]', err)
    return NextResponse.json(
      { error: 'Failed to fetch bot info. Check TELEGRAM_BOT_TOKEN.' },
      { status: 503 },
    )
  }
}

/**
 * POST /api/telegram/connect
 *
 * Binds a Telegram chat_id to the authenticated user.
 *
 * Body: { chat_id: string, username?: string, first_name?: string }
 *
 * Flow:
 * 1. User opens the bot in Telegram and sends /start
 * 2. The webhook stores the chat_id temporarily or the frontend obtains it
 * 3. Frontend calls this endpoint with the chat_id to create the binding
 *
 * Alternatively supports a "setup_webhook" action to register the webhook URL.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // ── Action: set up webhook ──
  if (body.action === 'setup_webhook') {
    return handleSetupWebhook()
  }

  // ── Action: bind chat_id ──
  const chatId = body.chat_id
  if (!chatId) {
    return NextResponse.json({ error: 'chat_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Deactivate any existing connection for this user
  await admin
    .from('telegram_connections')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('is_active', true)

  // Upsert the new connection
  const { data: connection, error } = await admin
    .from('telegram_connections')
    .upsert(
      {
        user_id: user.id,
        chat_id: String(chatId),
        username: body.username || null,
        first_name: body.first_name || null,
        is_active: true,
      },
      { onConflict: 'user_id, chat_id' },
    )
    .select()
    .single()

  if (error) {
    console.error('[Telegram Connect POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, connection })
}

/**
 * DELETE /api/telegram/connect
 *
 * Disconnect Telegram for the authenticated user.
 */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { error } = await admin
    .from('telegram_connections')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (error) {
    console.error('[Telegram Connect DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ---------------------------------------------------------------------------
// Webhook setup helper
// ---------------------------------------------------------------------------

async function handleSetupWebhook(): Promise<NextResponse> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_APP_URL is not set' },
      { status: 500 },
    )
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET

  try {
    const result = await setWebhook(webhookUrl, secret)
    return NextResponse.json({ ok: result, webhook_url: webhookUrl })
  } catch (err) {
    console.error('[Telegram Webhook Setup]', err)
    return NextResponse.json(
      { error: 'Failed to set webhook with Telegram' },
      { status: 502 },
    )
  }
}
