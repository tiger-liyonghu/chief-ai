import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { REPLY_DRAFT_SYSTEM, REPLY_DRAFT_USER } from '@/lib/ai/prompts/reply-draft'

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { thread, tone, from, subject, instructions } = await request.json()

  const { client, model } = await createUserAIClient(user.id)
  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: REPLY_DRAFT_SYSTEM },
      {
        role: 'user',
        content: REPLY_DRAFT_USER({
          thread: `From: ${from}\nSubject: ${subject}\n\n${thread}`,
          tone: tone || 'friendly',
          instructions,
        }),
      },
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 1000,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || ''
        if (text) {
          controller.enqueue(encoder.encode(text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
