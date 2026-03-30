/**
 * Apple AI Engine — WhatsApp-native executive assistant.
 * Supports function calling for real operations (calendar, email, tasks, etc.)
 * Implements time-response strategy: instant / quick / acknowledge-then-reply.
 */

import { supabase } from './supabase'
import OpenAI from 'openai'
import { APPLE_TOOLS, executeTool, getUserTimezone } from './tools/registry'
import { getLLMClient } from './tools/types'

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

    // Build messages
    const msgs: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
      { role: 'system', content: getSystemPrompt(tz) },
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
