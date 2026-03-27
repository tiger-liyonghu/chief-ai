import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { CHAT_SYSTEM_PROMPT } from '@/lib/ai/prompts/chat'
import { gatherUserContext } from '@/lib/ai/context'
import { parseActions, executeActions } from '@/lib/ai/actions'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { message, history } = await request.json()

  if (!message || typeof message !== 'string') {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const admin = createAdminClient()

  // Gather user context (tasks, calendar, emails, follow-ups, alerts)
  const { contextBlock, alertsBlock } = await gatherUserContext(admin, user.id)

  // Build messages array
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: `${CHAT_SYSTEM_PROMPT}\n\n--- USER CONTEXT ---\n${contextBlock}${alertsBlock}`,
    },
  ]

  // Include chat history if provided
  if (Array.isArray(history)) {
    for (const msg of history) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content })
      }
    }
  }

  // Add the current message
  messages.push({ role: 'user', content: message })

  // Stream the response using user's configured LLM
  const { client, model } = await createUserAIClient(user.id)
  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 2048,
  })

  // Convert to ReadableStream for SSE
  const encoder = new TextEncoder()
  let fullResponse = ''

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content
          if (content) {
            fullResponse += content
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
            )
          }
        }

        // Parse and execute actions from the full response
        const actions = parseActions(fullResponse)
        if (actions.length > 0) {
          const results = await executeActions(actions, user.id, admin)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ actions: results })}\n\n`)
          )
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: errorMessage })}\n\n`
          )
        )
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// parseActions and executeActions are now imported from @/lib/ai/actions
