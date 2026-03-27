/**
 * WhatsApp AI response handler.
 *
 * When a user receives a WhatsApp message and has AI auto-reply enabled,
 * this module processes the message through Chief AI, executes any actions,
 * and sends the response back via WhatsApp.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { CHAT_SYSTEM_PROMPT } from '@/lib/ai/prompts/chat'
import { gatherUserContext } from '@/lib/ai/context'
import {
  parseActions,
  executeActions,
  stripActionBlocks,
  formatActionResultsForWhatsApp,
} from '@/lib/ai/actions'

// ── Rate limiting ──

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const MAX_REPLIES_PER_HOUR = 20

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return false
  }

  if (entry.count >= MAX_REPLIES_PER_HOUR) {
    return true
  }

  entry.count++
  return false
}

// ── WhatsApp-specific system prompt additions ──

const WHATSAPP_PROMPT_SUFFIX = `

IMPORTANT: You are responding via WhatsApp. Follow these rules:
- Keep responses SHORT: max 3-4 sentences unless the user asks for detail.
- Use plain text. No markdown headers, no code blocks.
- For emphasis use WhatsApp formatting: *bold* for important items, _italic_ for subtle notes.
- For action confirmations, be brief and direct.
- For calendar queries, use a compact format like: "Tomorrow: 9:00 Team standup, 14:00 Priya meeting"
- Do NOT use bullet lists with dashes. Use line breaks and plain text instead.
- Respond in the same language the user uses.`

// ── Main handler ──

export interface WhatsAppInboundMessage {
  from: string        // sender phone number (without @s.whatsapp.net)
  fromName: string    // push name or phone number
  body: string        // text content
  remoteJid: string   // full JID for replying
  isGroup: boolean    // whether this is a group message
  messageType: string // 'text', 'image', etc.
}

/**
 * Check if AI auto-reply is enabled for a user's WhatsApp connection.
 */
export async function isAIEnabled(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('whatsapp_connections')
    .select('ai_enabled')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .single()

  return data?.ai_enabled === true
}

/**
 * Process an inbound WhatsApp message through Chief AI and return the response.
 *
 * Guards:
 * - Only processes text messages (not media)
 * - Only processes 1-on-1 chats (not groups)
 * - Rate limited to MAX_REPLIES_PER_HOUR per user
 * - AI auto-reply must be enabled in settings
 */
export async function processMessageWithAI(
  userId: string,
  message: WhatsAppInboundMessage,
  sendReply: (jid: string, text: string) => Promise<void>,
): Promise<void> {
  // Guard: skip non-text messages
  if (message.messageType !== 'text' || !message.body.trim()) {
    return
  }

  // Guard: skip group messages
  if (message.isGroup) {
    return
  }

  // Guard: check if AI is enabled
  const aiEnabled = await isAIEnabled(userId)
  if (!aiEnabled) {
    return
  }

  // Guard: rate limit
  if (isRateLimited(userId)) {
    console.log(`[WhatsApp AI] Rate limited for user ${userId}`)
    return
  }

  const admin = createAdminClient()

  try {
    // 1. Fetch conversation history (last 10 messages from this contact)
    const { data: recentMessages } = await admin
      .from('whatsapp_messages')
      .select('body, direction, received_at')
      .eq('user_id', userId)
      .or(`from_number.eq.${message.from},to_number.eq.${message.from}`)
      .not('body', 'is', null)
      .order('received_at', { ascending: false })
      .limit(10)

    // Build chat history (oldest first)
    const chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    if (recentMessages) {
      const chronological = [...recentMessages].reverse()
      for (const msg of chronological) {
        if (!msg.body) continue
        // Inbound = user message, outbound = assistant (our) message
        chatHistory.push({
          role: msg.direction === 'inbound' ? 'user' : 'assistant',
          content: msg.body,
        })
      }
    }

    // 2. Gather user context (tasks, calendar, emails, follow-ups, alerts)
    const { contextBlock, alertsBlock } = await gatherUserContext(admin, userId)

    // 3. Build the system prompt
    const systemPrompt =
      `${CHAT_SYSTEM_PROMPT}${WHATSAPP_PROMPT_SUFFIX}\n\n--- USER CONTEXT ---\n${contextBlock}${alertsBlock}\n\n--- WHATSAPP CONTACT ---\nYou are chatting with: ${message.fromName} (${message.from})`

    // 4. Build messages array
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]

    // Include recent conversation history (skip the last message -- it's the current one)
    if (chatHistory.length > 1) {
      for (const msg of chatHistory.slice(0, -1)) {
        messages.push(msg)
      }
    }

    // Add the current message
    messages.push({ role: 'user', content: message.body })

    // 5. Call AI (non-streaming)
    const { client, model } = await createUserAIClient(userId)
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 512, // Keep responses concise for WhatsApp
    })

    const aiResponse = completion.choices[0]?.message?.content
    if (!aiResponse) {
      console.error('[WhatsApp AI] Empty response from AI')
      return
    }

    // 6. Parse and execute actions
    const actions = parseActions(aiResponse)
    let actionSummary = ''
    if (actions.length > 0) {
      const results = await executeActions(actions, userId, admin)
      actionSummary = formatActionResultsForWhatsApp(results)
    }

    // 7. Clean the response (strip action blocks)
    let cleanResponse = stripActionBlocks(aiResponse)

    // Append action confirmations
    if (actionSummary) {
      cleanResponse = cleanResponse
        ? `${cleanResponse}\n\n${actionSummary}`
        : actionSummary
    }

    if (!cleanResponse.trim()) {
      return
    }

    // 8. Add a natural delay before replying (2 seconds)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // 9. Send the response via WhatsApp
    await sendReply(message.remoteJid, cleanResponse)

    // 10. Store the outbound AI message
    await admin.from('whatsapp_messages').insert({
      user_id: userId,
      wa_message_id: `ai-reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from_number: 'chief-ai',
      from_name: 'Chief AI',
      to_number: message.from,
      body: cleanResponse,
      message_type: 'text',
      direction: 'outbound',
      received_at: new Date().toISOString(),
    })

    console.log(
      `[WhatsApp AI] Replied to ${message.fromName} (${message.from}) for user ${userId}`,
    )
  } catch (err) {
    console.error('[WhatsApp AI] Error processing message:', err)
  }
}
