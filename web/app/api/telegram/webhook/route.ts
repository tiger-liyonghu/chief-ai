import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage, type TelegramUpdate } from '@/lib/telegram/bot'
import { createUserAIClient, getUserLLMConfig } from '@/lib/ai/unified-client'
import { CHAT_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT_FALLBACK } from '@/lib/ai/prompts/chat'
import { gatherUserContext } from '@/lib/ai/context'
import { supportsTools } from '@/lib/ai/tools'
import type OpenAI from 'openai'

/**
 * POST /api/telegram/webhook
 *
 * Receives updates from Telegram via webhook. Fully serverless-compatible.
 *
 * Security: validates the X-Telegram-Bot-Api-Secret-Token header against
 * TELEGRAM_WEBHOOK_SECRET env var. Telegram sends this header on every
 * webhook call when a secret_token was provided during setWebhook.
 */
export async function POST(request: NextRequest) {
  // ── Verify webhook authenticity ──
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret) {
    const headerSecret = request.headers.get('x-telegram-bot-api-secret-token')
    if (headerSecret !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  let update: TelegramUpdate
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only handle text messages for now
  const message = update.message
  if (!message?.text || !message.chat || !message.from) {
    // Acknowledge non-text updates so Telegram doesn't retry
    return NextResponse.json({ ok: true })
  }

  const chatId = message.chat.id
  const text = message.text
  const fromUser = message.from

  const admin = createAdminClient()

  try {
    // ── Look up connected user ──
    const { data: connection } = await admin
      .from('telegram_connections')
      .select('user_id')
      .eq('chat_id', String(chatId))
      .eq('is_active', true)
      .single()

    if (!connection) {
      // Unknown user — prompt them to connect via the app
      await sendMessage(
        chatId,
        'I don\'t recognize this chat yet. Please connect your Telegram account in the Chief of Staff app first.',
      )
      return NextResponse.json({ ok: true })
    }

    const userId = connection.user_id

    // ── Store inbound message ──
    await admin.from('telegram_messages').insert({
      user_id: userId,
      chat_id: String(chatId),
      message_id: message.message_id,
      from_username: fromUser.username || null,
      from_first_name: fromUser.first_name,
      text,
      direction: 'inbound',
      received_at: new Date(message.date * 1000).toISOString(),
    })

    // ── Generate AI reply ──
    const reply = await generateAIReply(userId, text, admin)

    // ── Store outbound message ──
    const sent = await sendMessage(chatId, reply)
    await admin.from('telegram_messages').insert({
      user_id: userId,
      chat_id: String(chatId),
      message_id: sent.message_id,
      from_username: null,
      from_first_name: 'Chief',
      text: reply,
      direction: 'outbound',
      received_at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Telegram Webhook] Error:', err)
    // Still return 200 so Telegram doesn't retry endlessly
    return NextResponse.json({ ok: true })
  }
}

// ---------------------------------------------------------------------------
// AI reply generation — simplified single-turn (no tool calling over Telegram)
// ---------------------------------------------------------------------------

async function generateAIReply(
  userId: string,
  userMessage: string,
  admin: ReturnType<typeof createAdminClient>,
): Promise<string> {
  const llmConfig = await getUserLLMConfig(userId)
  const useTools = supportsTools(llmConfig.provider)
  const systemPrompt = useTools ? CHAT_SYSTEM_PROMPT : CHAT_SYSTEM_PROMPT_FALLBACK

  const { contextBlock, alertsBlock } = await gatherUserContext(admin, userId)

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: [
        systemPrompt,
        '',
        '--- USER CONTEXT ---',
        contextBlock,
        alertsBlock,
        '',
        'IMPORTANT: This conversation is happening over Telegram.',
        'Keep replies concise (under 4000 chars). Use plain text, no markdown links.',
      ].join('\n'),
    },
    { role: 'user', content: userMessage },
  ]

  const { client, model } = await createUserAIClient(userId)

  try {
    const completion = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    })

    const content = completion.choices?.[0]?.message?.content
    return content?.trim() || 'Sorry, I could not generate a response right now.'
  } catch (err) {
    console.error('[Telegram AI] LLM call failed:', err)
    return 'Sorry, I am having trouble connecting to the AI service. Please try again shortly.'
  }
}
