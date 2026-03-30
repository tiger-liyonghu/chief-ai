/**
 * Apple AI Engine — WhatsApp-native executive assistant.
 * Supports function calling for real operations (calendar, email, tasks, etc.)
 * Implements time-response strategy: instant / quick / acknowledge-then-reply.
 */

import { supabase } from './supabase'
import OpenAI from 'openai'
import { APPLE_TOOLS, executeTool, getUserTimezone } from './tools/registry'
import { getLLMClient } from './tools/types'
import { preFetchPersonContext } from './tools/pre-fetch'

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
          console.error('[Apple] Draft generation failed:', err)
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
          console.error('[Apple] Nudge generation failed:', err)
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
          console.error('[Apple] Escalation suggestion failed:', err)
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
  const now = new Date().toLocaleString('zh-CN', { timeZone: timezone })
  return `你是 Apple，老板的 AI 首席幕僚。老板通过 WhatsApp 和你沟通。

当前时间：${now}（${timezone}）

你的角色：
- 你是老板最信任的助理，像跟了三年的真人秘书
- 老板说什么你就执行什么，简洁确认
- 主动想一步：老板说要出差，你主动问要不要准备资料
- 你有工具可以查日历、查邮件、查任务、建任务、查跟进事项、查联系人

语气：
- 简短、干练、不啰嗦
- 用老板的语言回复（中文就中文，英文就英文）
- 不要用 markdown 标题或代码块
- 可以用 WhatsApp 格式：*加粗* _斜体_
- 一般 1-3 句话搞定，列表用换行不用 bullet

工具使用原则：
- 老板问日程、邮件、任务等，先调工具拿真实数据，再基于数据回答
- 不要编造数据，没查到就说"没有找到"
- 建任务、标完成等写操作，执行后简洁确认`
}

// ── Main handler ──

export async function processMessageWithAI(
  userId: string,
  message: WhatsAppInboundMessage,
  sendReply: (jid: string, text: string) => Promise<void>,
): Promise<void> {
  const hasImage = message.messageType === 'image' && message.imageBase64
  if (!hasImage && !message.body.trim()) return

  const aiEnabled = await isAIEnabled(userId)
  if (!aiEnabled) return

  if (isRateLimited(userId)) {
    console.log(`[Apple] Rate limited for user ${userId}`)
    return
  }

  const startTime = Date.now()

  try {
    // ── Quick-reply commitment actions (before LLM call) ──
    if (message.body && message.messageType === 'text') {
      const handled = await handleCommitmentAction(userId, message.body, sendReply, message.remoteJid)
      if (handled) {
        // Store Apple's reply is handled inside handleCommitmentAction via sendReply
        // Store the user's command message
        await supabase.from('whatsapp_messages').insert({
          user_id: userId,
          wa_message_id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          from_number: message.from,
          from_name: 'User',
          to_number: 'apple',
          body: message.body,
          message_type: 'text',
          direction: 'outbound',
          received_at: new Date().toISOString(),
        })
        return
      }
    }

    const tz = await getUserTimezone(userId)

    // ── Voice message: transcribe with Whisper ──
    if (message.audioBase64 && message.messageType === 'audio') {
      try {
        const client = getLLMClient()
        // Write audio to temp file for Whisper API
        const fs = await import('fs')
        const path = await import('path')
        const tmpFile = path.join('/tmp', `apple-audio-${Date.now()}.ogg`)
        fs.writeFileSync(tmpFile, Buffer.from(message.audioBase64, 'base64'))

        const transcription = await client.audio.transcriptions.create({
          file: fs.createReadStream(tmpFile) as any,
          model: 'whisper-1',
        })
        fs.unlinkSync(tmpFile)

        if (transcription.text) {
          console.log(`[Apple] Voice transcribed: "${transcription.text.slice(0, 50)}"`)
          message.body = transcription.text
          message.messageType = 'text'
        }
      } catch (err) {
        console.error('[Apple] Voice transcription failed:', err)
        // Fallback: try DeepSeek or skip
        message.body = '[语音消息，暂时无法识别]'
        message.messageType = 'text'
      }
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

        console.log(`[Apple] Document parsed: ${name}, ${docText.length} chars`)
        message.body = `${message.body || '请分析这个文件'}\n\n--- 文件内容: ${name} ---\n${docText}`
        message.messageType = 'text'
      } catch (err) {
        console.error('[Apple] Document parsing failed:', err)
        message.body = `[文件 ${message.documentName} 已收到，解析失败]`
        message.messageType = 'text'
      }
    }

    // Fetch recent conversation history (Apple ↔ Boss)
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
        // Messages from Apple (from_name='Apple') are assistant, others are user
        const role = msg.from_name === 'Apple' ? 'assistant' : 'user'
        chatHistory.push({ role, content: msg.body })
      }
    }

    // Pre-fetch context for any persons mentioned in the message
    let personContext = ''
    if (message.body && message.messageType === 'text') {
      try {
        personContext = await preFetchPersonContext(userId, message.body)
      } catch (err) {
        console.error('[Apple] Pre-fetch context failed (non-fatal):', err)
      }
    }

    // Build messages
    const systemPrompt = personContext
      ? getSystemPrompt(tz) + personContext
      : getSystemPrompt(tz)
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

    const client = getLLMClient()
    // Use vision-capable model for images, regular model for text
    const model = hasImage
      ? (process.env.LLM_VISION_MODEL || process.env.LLM_MODEL || 'deepseek-chat')
      : (process.env.LLM_MODEL || 'deepseek-chat')

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
      console.log(`[Apple] Tool call round ${rounds}: ${toolNames.join(', ')}`)

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
          console.error(`[Apple] Tool ${(toolCall as any).function.name} failed:`, err)
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
    console.log(`[Apple] Reply in ${elapsed}ms, ${rounds} tool rounds, ${usage?.total_tokens || '?'} tokens`)

    // Track LLM usage
    const { trackLLMUsage } = await import('./notification-log')
    trackLLMUsage(userId, model, usage?.prompt_tokens || 0, usage?.completion_tokens || 0, rounds, elapsed, hasImage ? 'vision' : 'chat')

    // Send reply
    await sendReply(message.remoteJid, response)

    // Store Apple's reply
    await supabase.from('whatsapp_messages').insert({
      user_id: userId,
      wa_message_id: `apple-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from_number: 'apple',
      from_name: 'Apple',
      to_number: message.from,
      body: response,
      message_type: 'text',
      direction: 'inbound',
      received_at: new Date().toISOString(),
    })

    console.log(`[Apple] Replied to boss for user ${userId}`)
  } catch (err) {
    console.error('[Apple] Error:', err)
    // Send error acknowledgment so boss isn't left waiting
    try {
      await sendReply(message.remoteJid, '🍎 抱歉老板，刚才处理出了点问题，我再试一下。')
    } catch { /* ignore send error */ }
  }
}
