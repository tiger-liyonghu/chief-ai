/**
 * WhatsApp AI response handler.
 *
 * When a user receives a WhatsApp message and has AI auto-reply enabled,
 * this module processes the message through Chief AI, executes any actions,
 * and sends the response back via WhatsApp.
 *
 * Supports function calling for capable providers, with text-parsing fallback.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient, getUserLLMConfig } from '@/lib/ai/unified-client'
import { CHAT_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT_FALLBACK } from '@/lib/ai/prompts/chat'
import { gatherUserContext } from '@/lib/ai/context'
import {
  parseActions,
  executeActions,
  executeToolCall,
  stripActionBlocks,
  formatActionResultsForWhatsApp,
} from '@/lib/ai/actions'
import { CHIEF_TOOLS, supportsTools } from '@/lib/ai/tools'
import type OpenAI from 'openai'

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
        chatHistory.push({
          role: msg.direction === 'inbound' ? 'user' : 'assistant',
          content: msg.body,
        })
      }
    }

    // 2. Gather user context (tasks, calendar, emails, follow-ups, alerts)
    const { contextBlock, alertsBlock } = await gatherUserContext(admin, userId)

    // 3. Determine provider capabilities
    const llmConfig = await getUserLLMConfig(userId)
    const useTools = supportsTools(llmConfig.provider)
    const basePrompt = useTools ? CHAT_SYSTEM_PROMPT : CHAT_SYSTEM_PROMPT_FALLBACK

    // 4. Build the system prompt
    const systemPrompt =
      `${basePrompt}${WHATSAPP_PROMPT_SUFFIX}\n\n--- USER CONTEXT ---\n${contextBlock}${alertsBlock}\n\n--- WHATSAPP CONTACT ---\nYou are chatting with: ${message.fromName} (${message.from})`

    // 5. Build messages array
    const msgs: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
      { role: 'system', content: systemPrompt },
    ]

    // Include recent conversation history (skip the last message -- it's the current one)
    if (chatHistory.length > 1) {
      for (const msg of chatHistory.slice(0, -1)) {
        msgs.push(msg)
      }
    }

    // Add the current message
    msgs.push({ role: 'user', content: message.body })

    // 6. Call AI (non-streaming)
    const { client, model } = await createUserAIClient(userId)

    let cleanResponse = ''
    let actionSummary = ''

    if (useTools) {
      // ─── Function-calling path ───
      const completion = await client.chat.completions.create({
        model,
        messages: msgs,
        tools: CHIEF_TOOLS,
        temperature: 0.7,
        max_tokens: 512,
      })

      const choice = completion.choices[0]?.message
      cleanResponse = choice?.content || ''

      // Execute tool calls if any
      if (choice?.tool_calls && choice.tool_calls.length > 0) {
        const actionResults = []

        for (const tc of choice.tool_calls) {
          if (tc.type !== 'function') continue
          const fn = tc.function
          let args: Record<string, any> = {}
          try {
            args = JSON.parse(fn.arguments)
          } catch {
            // Skip malformed
          }
          const result = await executeToolCall(fn.name, args, userId, admin)
          actionResults.push(result)
        }

        actionSummary = formatActionResultsForWhatsApp(actionResults)
      }
    } else {
      // ─── Text-parsing fallback path ───
      const completion = await client.chat.completions.create({
        model,
        messages: msgs,
        temperature: 0.7,
        max_tokens: 512,
      })

      const aiResponse = completion.choices[0]?.message?.content || ''

      // Parse and execute actions
      const actions = parseActions(aiResponse)
      if (actions.length > 0) {
        const results = await executeActions(actions, userId, admin)
        actionSummary = formatActionResultsForWhatsApp(results)
      }

      cleanResponse = stripActionBlocks(aiResponse)
    }

    // Append action confirmations
    if (actionSummary) {
      cleanResponse = cleanResponse
        ? `${cleanResponse}\n\n${actionSummary}`
        : actionSummary
    }

    if (!cleanResponse.trim()) {
      return
    }

    // 7. Add a natural delay before replying (2 seconds)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // 8. Send the response via WhatsApp
    await sendReply(message.remoteJid, cleanResponse)

    // 9. Store the outbound AI message
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
