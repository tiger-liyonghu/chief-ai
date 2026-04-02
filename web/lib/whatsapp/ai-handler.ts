/**
 * Sophia AI Engine — WhatsApp-native executive assistant.
 * Supports function calling for real operations (calendar, email, tasks, etc.)
 * Implements time-response strategy: instant / quick / acknowledge-then-reply.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import OpenAI from 'openai'
import { APPLE_TOOLS, executeTool, getUserTimezone } from '@/lib/whatsapp/tools/registry'
import { getLLMClient } from '@/lib/whatsapp/tools/types'
import { preFetchPersonContext } from '@/lib/whatsapp/tools/pre-fetch'

// ── Response sanitizer: fix formatting issues before sending ──

/**
 * Post-process LLM response for WhatsApp delivery.
 *
 * Three transformations:
 * 1. Convert Markdown **bold** to WhatsApp *bold*
 * 2. Strip Markdown headers (##), code blocks (```), bullet points (- )
 * 3. Remove 🍎 prefix if present
 */
function sanitizeWhatsAppResponse(text: string): string {
  let r = text

  // Remove 🍎 prefix
  r = r.replace(/^🍎\s*/, '')

  // Convert **bold** to *bold* (WhatsApp format)
  r = r.replace(/\*\*([^*]+)\*\*/g, '*$1*')

  // Remove ## headers — keep the text
  r = r.replace(/^#{1,6}\s+/gm, '')

  // Remove ``` code blocks — keep content
  r = r.replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, '').trim())

  // Convert markdown bullet "- " to plain newline (WhatsApp doesn't render bullets)
  r = r.replace(/^\s*[-•]\s+/gm, '  ')

  // Remove numbered list formatting "1. " → "1) " (more WhatsApp-friendly)
  r = r.replace(/^(\d+)\.\s+/gm, '$1) ')

  // Collapse multiple blank lines to single
  r = r.replace(/\n{3,}/g, '\n\n')

  return r.trim()
}

// ── Vision/Audio client (SiliconFlow) ──

function getVisionClient(): OpenAI {
  const key = process.env.SILICONFLOW_API_KEY
  if (key) {
    return new OpenAI({
      apiKey: key,
      baseURL: 'https://api.siliconflow.com/v1',
    })
  }
  // Fallback to main LLM client
  return getLLMClient()
}

const VISION_MODEL = process.env.LLM_VISION_MODEL || 'Qwen/Qwen3-VL-8B-Instruct'

// ── Commitment Quick-Reply Actions ──

const COMMITMENT_ACTIONS: Array<{ pattern: RegExp; action: string }> = [
  { pattern: /^完成\s*([a-f0-9]{4,8})/i, action: 'mark_done' },
  { pattern: /^done\s*([a-f0-9]{4,8})/i, action: 'mark_done' },
  { pattern: /^起草\s*([a-f0-9]{4,8})/i, action: 'draft_reply' },
  { pattern: /^draft\s*([a-f0-9]{4,8})/i, action: 'draft_reply' },
  { pattern: /^延期\s*([a-f0-9]{4,8})/i, action: 'postpone' },
  { pattern: /^postpone\s*([a-f0-9]{4,8})/i, action: 'postpone' },
  { pattern: /^催\s*([a-f0-9]{4,8})/i, action: 'send_nudge' },
  { pattern: /^nudge\s*([a-f0-9]{4,8})/i, action: 'send_nudge' },
  { pattern: /^升级\s*([a-f0-9]{4,8})/i, action: 'escalate' },
]

async function handleCommitmentAction(
  userId: string,
  body: string,
  sendReply: (jid: string, text: string) => Promise<void>,
  remoteJid: string,
): Promise<boolean> {
  const supabase = createAdminClient()
  const trimmed = body.trim()

  for (const { pattern, action } of COMMITMENT_ACTIONS) {
    const match = trimmed.match(pattern)
    if (!match) continue

    const shortId = match[1]

    // Find commitment by ID prefix
    const { data: commitments } = await supabase
      .from('commitments')
      .select('id, contact_name, contact_email, title, description, type, deadline, status')
      .eq('user_id', userId)
      .like('id', `${shortId}%`)
      .limit(1)

    if (!commitments || commitments.length === 0) {
      await sendReply(remoteJid, `找不到编号 ${shortId} 的承诺事项。`)
      return true
    }

    const commitment = commitments[0]
    const contactName = commitment.contact_name || commitment.contact_email || '对方'
    const title = commitment.title || commitment.description || '(无标题)'

    switch (action) {
      case 'mark_done': {
        await supabase
          .from('commitments')
          .update({ status: 'done', completed_at: new Date().toISOString() })
          .eq('id', commitment.id)
        await sendReply(remoteJid, `已标记完成：「${title}」 ✓`)
        return true
      }

      case 'postpone': {
        const currentDeadline = commitment.deadline
          ? new Date(commitment.deadline)
          : new Date()
        const newDeadline = new Date(currentDeadline.getTime() + 7 * 86400000)
        const newDeadlineStr = newDeadline.toISOString().split('T')[0]

        await supabase
          .from('commitments')
          .update({ deadline: newDeadlineStr, status: 'pending' })
          .eq('id', commitment.id)
        await sendReply(remoteJid, `已延期：「${title}」→ ${newDeadlineStr}`)
        return true
      }

      case 'draft_reply': {
        const client = getLLMClient()
        const draftPrompt = commitment.type === 'i_promised'
          ? `你是老板的AI秘书。老板答应了${contactName}要做「${title}」，请帮老板起草一封简短的邮件，告知对方进展或交付。语气专业但亲切。只输出邮件Subject和Body，不要解释。格式：\nSubject: ...\n\n正文内容`
          : `你是老板的AI秘书。老板需要催促${contactName}完成承诺的「${title}」。请起草一封简短催促邮件，语气礼貌但坚定。只输出邮件Subject和Body，不要解释。格式：\nSubject: ...\n\n正文内容`

        try {
          const completion = await client.chat.completions.create({
            model: process.env.LLM_MODEL || 'deepseek-chat',
            messages: [
              { role: 'system', content: '你是一个专业的商务邮件助手。' },
              { role: 'user', content: draftPrompt },
            ],
            temperature: 0.5,
            max_tokens: 512,
          })

          const draft = completion.choices[0]?.message?.content?.trim() || ''
          await sendReply(remoteJid, `📝 给${contactName}的邮件草稿：\n\n${draft}\n\n回复「发」确认发送，或告诉我要改什么。`)
        } catch (err) {
          console.error('[Sophia] Draft generation failed:', err)
          await sendReply(remoteJid, `起草邮件失败，请稍后再试。`)
        }
        return true
      }

      case 'send_nudge': {
        const client = getLLMClient()
        const nudgePrompt = `你是老板的AI秘书。${contactName}答应了「${title}」但还没完成（${commitment.deadline ? '截止' + commitment.deadline : '未设截止日'}）。请起草一封简短的催促邮件，语气礼貌友好但明确表达需要尽快完成。只输出邮件Subject和Body，不要解释。格式：\nSubject: ...\n\n正文内容`

        try {
          const completion = await client.chat.completions.create({
            model: process.env.LLM_MODEL || 'deepseek-chat',
            messages: [
              { role: 'system', content: '你是一个专业的商务邮件助手。' },
              { role: 'user', content: nudgePrompt },
            ],
            temperature: 0.5,
            max_tokens: 512,
          })

          const draft = completion.choices[0]?.message?.content?.trim() || ''
          await sendReply(remoteJid, `📝 给${contactName}的催促邮件：\n\n${draft}\n\n回复「发」确认发送，或告诉我要改什么。`)
        } catch (err) {
          console.error('[Sophia] Nudge generation failed:', err)
          await sendReply(remoteJid, `生成催促邮件失败，请稍后再试。`)
        }
        return true
      }

      case 'escalate': {
        const client = getLLMClient()
        const escalatePrompt = `你是老板的AI秘书。${contactName}答应了「${title}」但逾期未完成。老板想换种方式跟进。请提供3个升级跟进建议：\n1. 直接电话沟通的话术要点\n2. 通过其他联系人施压的策略\n3. 设定最后期限的邮件草稿\n\n简洁明了，不超过300字。`

        try {
          const completion = await client.chat.completions.create({
            model: process.env.LLM_MODEL || 'deepseek-chat',
            messages: [
              { role: 'system', content: '你是一个资深的商务关系管理顾问。' },
              { role: 'user', content: escalatePrompt },
            ],
            temperature: 0.6,
            max_tokens: 512,
          })

          const suggestions = completion.choices[0]?.message?.content?.trim() || ''
          await sendReply(remoteJid, `🔺 关于${contactName}「${title}」的升级跟进建议：\n\n${suggestions}`)
        } catch (err) {
          console.error('[Sophia] Escalation suggestion failed:', err)
          await sendReply(remoteJid, `生成跟进建议失败，请稍后再试。`)
        }
        return true
      }
    }
  }

  return false
}

// ── Rate limiting ──

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const MAX_REPLIES_PER_HOUR = 60

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return false
  }
  if (entry.count >= MAX_REPLIES_PER_HOUR) return true
  entry.count++
  return false
}

// ── Types ──

export interface WhatsAppInboundMessage {
  from: string
  fromName: string
  body: string
  remoteJid: string
  isGroup: boolean
  messageType: string
  imageBase64?: string
  audioBase64?: string
  documentBuffer?: string // base64 encoded
  documentName?: string
}

export async function isAIEnabled(userId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('whatsapp_connections')
    .select('ai_enabled')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .single()
  return data?.ai_enabled === true
}

// ── System prompt ──

function getSystemPrompt(timezone: string): string {
  const { getSophieWhatsAppPrompt } = require('@/lib/ai/prompts/sophia-voice')
  return getSophieWhatsAppPrompt(timezone, 'Sophia')
}

// ── Main handler ──

/**
 * CONVERSATION MUTEX — prevents echo storms.
 *
 * Mathematical model: positive feedback loop in self-chat.
 * Sophia sends reply → WhatsApp delivers to self → triggers handler → repeat.
 *
 * Solution: time-based mutual exclusion lock per user.
 * States: IDLE → PROCESSING → COOLDOWN → IDLE
 * During PROCESSING and COOLDOWN, ALL incoming messages are rejected.
 * Cooldown = 5 seconds (> WhatsApp round-trip time).
 *
 * This is mathematically guaranteed to break the feedback loop because
 * time is monotonically increasing and cannot be bypassed.
 */
const conversationLock = new Map<string, number>() // userId → unlock timestamp
const COOLDOWN_MS = 5000 // 5 seconds after response before accepting new messages

/**
 * RECENCY CACHE — prevents duplicate responses to repeated input.
 *
 * If Sophia just gave a briefing 30 minutes ago and user says "hi" again,
 * respond with "刚说过了" instead of repeating the same briefing.
 */
const lastResponse = new Map<string, { text: string; time: number }>()

/**
 * MESSAGE CLASSIFIER — routes messages to appropriate handler.
 *
 * chitchat: brief acknowledgment, no tools
 * action/query: full LLM pipeline
 * urgent: bypass shouldNotify, full pipeline
 */
function classifyMessage(body: string): 'urgent' | 'action' | 'query' | 'chitchat' | 'wait_signal' {
  const text = body.trim().toLowerCase()

  // Wait signals: user is thinking/acknowledging, don't respond with content
  if (/^(我看看|让我想想|嗯|好的?|ok|okay|知道了|收到|got it|noted|hmm|看看)$/i.test(text)) return 'wait_signal'

  // Urgent: explicit urgency markers
  if (/紧急|urgent|马上|立刻|asap|赶紧|emergency/i.test(text)) return 'urgent'

  // Action: user wants Sophia to DO something
  if (/帮我|起草|发送|创建|完成|延期|催|安排|block|schedule|draft|send|create|done|nudge/i.test(text)) return 'action'

  // Quick commitment commands (handled separately, but classify as action)
  if (/^(完成|done|起草|draft|延期|postpone|催|nudge|升级)\s/i.test(text)) return 'action'

  // Query: user is asking for information
  if (/[?？]|什么|几个|有没有|怎么样|多少|哪些|吗$|呢$|today|tomorrow|this week|calendar|email|task|commit/i.test(text)) return 'query'

  // Everything else is chitchat
  return 'chitchat'
}

// Track recently processed messages (content-based, for reconnect replays)
const recentlyProcessed = new Map<string, number>()
setInterval(() => {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000
  for (const [key, ts] of recentlyProcessed) {
    if (ts < fiveMinAgo) recentlyProcessed.delete(key)
  }
  // Also clean old lastResponse entries (> 30 min)
  const thirtyMinAgo = Date.now() - 30 * 60 * 1000
  for (const [key, val] of lastResponse) {
    if (val.time < thirtyMinAgo) lastResponse.delete(key)
  }
}, 60 * 1000)

export async function processMessageWithAI(
  userId: string,
  message: WhatsAppInboundMessage,
  sendReply: (jid: string, text: string) => Promise<void>,
): Promise<void> {
  const hasImage = message.messageType === 'image' && message.imageBase64
  if (!hasImage && !message.body.trim()) return

  // ── MUTEX CHECK: if locked, reject immediately ──
  const unlockTime = conversationLock.get(userId) || 0
  if (Date.now() < unlockTime) {
    // Still in PROCESSING or COOLDOWN — this is likely a feedback echo
    return
  }

  // ── CONTENT DEDUP: same content within 2 minutes = replay ──
  const contentKey = `${userId}:${message.from}:${(message.body || '').slice(0, 80)}`
  if (recentlyProcessed.has(contentKey)) {
    return
  }
  recentlyProcessed.set(contentKey, Date.now())

  // ── ACQUIRE LOCK: entering PROCESSING state ──
  // Lock for 60 seconds max (in case processing hangs, auto-release)
  conversationLock.set(userId, Date.now() + 60000)

  const aiEnabled = await isAIEnabled(userId)
  if (!aiEnabled) {
    conversationLock.delete(userId) // Release lock
    return
  }

  if (isRateLimited(userId)) {
    console.log(`[Sophia] Rate limited for user ${userId}`)
    conversationLock.delete(userId)
    return
  }

  // ── CLASSIFY MESSAGE ──
  const messageClass = message.body ? classifyMessage(message.body) : 'action'

  // ── RECENCY CHECK: don't repeat the same briefing ──
  const lastResp = lastResponse.get(userId)
  if (messageClass === 'query' && lastResp && Date.now() - lastResp.time < 30 * 60 * 1000) {
    // Check if user is asking for the same thing they just asked
    const simpleInput = (message.body || '').trim().toLowerCase()
    if (simpleInput === 'hi' || simpleInput === 'hello' || simpleInput === '你好' || simpleInput === 'sophia') {
      const reply = '刚说过了。你要我帮你处理哪个？'
      await sendReply(message.remoteJid, reply)
      // Set cooldown
      conversationLock.set(userId, Date.now() + COOLDOWN_MS)
      return
    }
  }

  // ── WAIT SIGNAL: user is thinking, don't respond ──
  if (messageClass === 'wait_signal') {
    // "我看看", "嗯", "好的" — user is processing, not requesting action
    // A real chief of staff stays silent here
    conversationLock.set(userId, Date.now() + COOLDOWN_MS)
    return // No response at all — silence is the correct behavior
  }

  // ── CHITCHAT: brief response, no tools ──
  if (messageClass === 'chitchat' && !hasImage) {
    // Don't invoke the full LLM pipeline for casual chat
    // Just acknowledge briefly — a real chief of staff doesn't over-respond to small talk
    const chitchatResponses = [
      '收到。',
      '嗯。需要我做什么吗？',
      '知道了。',
    ]
    const reply = chitchatResponses[Math.floor(Math.random() * chitchatResponses.length)]
    await sendReply(message.remoteJid, reply)
    conversationLock.set(userId, Date.now() + COOLDOWN_MS)
    return
  }

  const startTime = Date.now()
  const supabase = createAdminClient()

  try {
    // ── Quick-reply commitment actions (before LLM call) ──
    if (message.body && message.messageType === 'text') {
      const handled = await handleCommitmentAction(userId, message.body, sendReply, message.remoteJid)
      if (handled) {
        // Store Sophia's reply is handled inside handleCommitmentAction via sendReply
        // Store the user's command message
        await supabase.from('whatsapp_messages').insert({
          user_id: userId,
          wa_message_id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          from_number: message.from,
          from_name: 'User',
          to_number: 'sophia',
          body: message.body,
          message_type: 'text',
          direction: 'outbound',
          received_at: new Date().toISOString(),
        })
        return
      }
    }

    const tz = await getUserTimezone(userId)

    // ── Voice message: not yet supported ──
    if (message.audioBase64 && message.messageType === 'audio') {
      message.body = '语音消息功能正在开发中，目前支持文字和图片消息。'
      message.messageType = 'text'
    }

    // ── Document: extract text ──
    if (message.documentBuffer && message.messageType === 'document') {
      try {
        const docBuf = Buffer.from(message.documentBuffer, 'base64')
        const name = message.documentName || 'document'
        let docText = ''

        if (name.endsWith('.pdf')) {
          // Use pdf-parse or send to vision model
          try {
            const pdfModule = await import('pdf-parse')
            const pdfParse = (pdfModule as any).default || pdfModule
            const pdfData = await pdfParse(docBuf)
            docText = pdfData.text.slice(0, 5000)
          } catch {
            docText = '[PDF 解析失败，请尝试截图发送]'
          }
        } else if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv')) {
          docText = docBuf.toString('utf-8').slice(0, 5000)
        } else {
          docText = `[${name}] 文件已收到，格式暂不支持直接解析。请截图发送关键页面。`
        }

        console.log(`[Sophia] Document parsed: ${name}, ${docText.length} chars`)
        message.body = `${message.body || '请分析这个文件'}\n\n--- 文件内容: ${name} ---\n${docText}`
        message.messageType = 'text'
      } catch (err) {
        console.error('[Sophia] Document parsing failed:', err)
        message.body = `[文件 ${message.documentName} 已收到，解析失败]`
        message.messageType = 'text'
      }
    }

    // Fetch recent conversation history (Sophia ↔ Boss)
    const { data: recentMessages } = await supabase
      .from('whatsapp_messages')
      .select('body, direction, from_name, received_at')
      .eq('user_id', userId)
      .not('body', 'is', null)
      .order('received_at', { ascending: false })
      .limit(20)

    const chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    if (recentMessages) {
      const chronological = [...recentMessages].reverse()
      for (const msg of chronological) {
        if (!msg.body) continue
        // Messages from Sophia (from_name='Sophia') are assistant, others are user
        const role = (msg.from_name === 'Sophia' || msg.from_name === 'Apple') ? 'assistant' : 'user'
        chatHistory.push({ role, content: msg.body })
      }
    }

    // Pre-fetch context for any persons mentioned in the message
    let personContext = ''
    if (message.body && message.messageType === 'text') {
      try {
        personContext = await preFetchPersonContext(userId, message.body)
      } catch (err) {
        console.error('[Sophia] Pre-fetch context failed (non-fatal):', err)
      }
    }

    // 👂 Emotion detection
    const { detectEmotion, formatEmotionContext } = await import('@/lib/ai/emotion/detect')
    const localHour = parseInt(new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }))
    const emotionResult = detectEmotion(message.body || '', localHour)
    const emotionContext = formatEmotionContext(emotionResult)

    // Build messages
    const systemPrompt = personContext
      ? getSystemPrompt(tz) + personContext + emotionContext
      : getSystemPrompt(tz) + emotionContext
    const msgs: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
      { role: 'system', content: systemPrompt },
    ]

    // Add recent history (skip last one, that's the current message)
    if (chatHistory.length > 1) {
      for (const msg of chatHistory.slice(0, -1)) {
        msgs.push(msg)
      }
    }
    // Build user message — with image if present
    if (hasImage) {
      msgs.push({
        role: 'user',
        content: [
          ...(message.body ? [{ type: 'text' as const, text: message.body }] : [{ type: 'text' as const, text: '请识别这张图片的内容。如果是发票/收据，提取金额、商户、类别、币种。如果是名片，提取姓名、公司、职位、电话、邮箱。' }]),
          { type: 'image_url' as const, image_url: { url: `data:image/jpeg;base64,${message.imageBase64}` } },
        ],
      })
    } else {
      msgs.push({ role: 'user', content: message.body })
    }

    // Use SiliconFlow for vision, main LLM for text
    const client = hasImage ? getVisionClient() : getLLMClient()
    const model = hasImage
      ? VISION_MODEL
      : (process.env.LLM_MODEL || 'deepseek-chat')

    if (hasImage) {
      console.log(`[Sophia] Vision call: model=${model}, imageSize=${message.imageBase64?.length || 0} chars, hasKey=${!!process.env.SILICONFLOW_API_KEY}`)
    }

    // First LLM call — may include tool calls
    let completion = await client.chat.completions.create({
      model,
      messages: msgs,
      tools: hasImage ? undefined : APPLE_TOOLS, // No tools for vision calls
      temperature: 0.5,
      max_tokens: 1024,
    })

    let assistantMessage = completion.choices[0]?.message
    if (!assistantMessage) return

    // Handle tool calls (up to 5 rounds for dev tasks)
    let rounds = 0
    let ackSent = false
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && rounds < 5) {
      rounds++
      const toolNames = assistantMessage.tool_calls.map(t => (t as any).function.name)
      console.log(`[Sophia] Tool call round ${rounds}: ${toolNames.join(', ')}`)

      // For slow tools, send acknowledgment first (3-second principle)
      const SLOW_TOOLS = ['run_dev_task', 'search_company_news', 'get_cultural_brief', 'get_local_recommendations', 'run_custom_agent', 'check_travel_policy', 'create_custom_agent']
      const hasSlow = toolNames.some(t => SLOW_TOOLS.includes(t))
      if (hasSlow && !ackSent) {
        ackSent = true
        const ackMessages: Record<string, string> = {
          run_dev_task: '🍎 收到老板，我去改代码，改好了告诉你。',
          search_company_news: '🍎 好的，我去查一下，稍后告诉你。',
          run_custom_agent: '🍎 好的，正在运行，稍等。',
        }
        const ackMsg = ackMessages[toolNames.find(t => SLOW_TOOLS.includes(t))!] || '🍎 收到，我处理一下。'
        await sendReply(message.remoteJid, ackMsg)
      }

      // Add assistant message with tool calls
      msgs.push(assistantMessage as any)

      // Execute all tool calls
      for (const toolCall of assistantMessage.tool_calls) {
        let toolArgs: any = {}
        try {
          toolArgs = JSON.parse((toolCall as any).function.arguments || '{}')
        } catch { /* empty args */ }

        let result: string
        try {
          result = await executeTool(userId, (toolCall as any).function.name, toolArgs)
        } catch (err: any) {
          result = `工具执行失败：${err.message || 'unknown error'}`
          console.error(`[Sophia] Tool ${(toolCall as any).function.name} failed:`, err)
        }
        msgs.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        })
      }

      // Next LLM call with tool results
      completion = await client.chat.completions.create({
        model,
        messages: msgs,
        tools: APPLE_TOOLS,
        temperature: 0.5,
        max_tokens: 1024,
      })

      assistantMessage = completion.choices[0]?.message
      if (!assistantMessage) return
    }

    const response = assistantMessage.content?.trim()
    if (!response) return

    const elapsed = Date.now() - startTime
    const usage = completion.usage
    console.log(`[Sophia] Reply in ${elapsed}ms, ${rounds} tool rounds, ${usage?.total_tokens || '?'} tokens`)

    // Track LLM usage
    const { trackLLMUsage } = await import('@/lib/whatsapp/notification-log')
    trackLLMUsage(userId, model, usage?.prompt_tokens || 0, usage?.completion_tokens || 0, rounds, elapsed, hasImage ? 'vision' : 'chat')

    // ── POST-PROCESS: fix formatting before sending ──
    const sanitizedResponse = sanitizeWhatsAppResponse(response)

    // Send reply
    await sendReply(message.remoteJid, sanitizedResponse)

    // ── ENTER COOLDOWN: lock for N seconds to prevent echo ──
    conversationLock.set(userId, Date.now() + COOLDOWN_MS)

    // ── CACHE RESPONSE: for recency check on repeated input ──
    lastResponse.set(userId, { text: sanitizedResponse.slice(0, 200), time: Date.now() })

    // Store Sophia's reply
    await supabase.from('whatsapp_messages').insert({
      user_id: userId,
      wa_message_id: `sophia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from_number: 'sophia',
      from_name: 'Sophia',
      to_number: message.from,
      body: sanitizedResponse,
      message_type: 'text',
      direction: 'inbound',
      received_at: new Date().toISOString(),
    })

    console.log(`[Sophia] Replied to boss for user ${userId}`)
  } catch (err) {
    console.error('[Sophia] Error:', err)
    // Release lock on error so user isn't permanently locked out
    conversationLock.set(userId, Date.now() + COOLDOWN_MS)
    // Send error acknowledgment so boss isn't left waiting
    try {
      await sendReply(message.remoteJid, '抱歉老板，刚才处理出了点问题。再说一遍？')
    } catch { /* ignore send error */ }
  }
}
