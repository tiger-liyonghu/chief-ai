import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient, getUserLLMConfig } from '@/lib/ai/unified-client'
import { getChatSystemPrompt, getChatSystemPromptFallback } from '@/lib/ai/prompts/chat'
import { gatherUserContext } from '@/lib/ai/context'
import { parseActions, executeActions, executeToolCall } from '@/lib/ai/actions'
import { CHIEF_TOOLS, supportsTools } from '@/lib/ai/tools'
import type OpenAI from 'openai'

/** Strip DeepSeek internal DSML tags that leak into text content */
function sanitizeContent(text: string): string {
  return text
    .replace(/<[｜|]DSML[｜|][^>]*>[\s\S]*?<[｜|]\/[^>]*>/g, '')
    .replace(/<[｜|][^>]*[｜|]>/g, '')
}

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

  // Fetch assistant name from profile
  const { data: profile } = await admin
    .from('profiles')
    .select('assistant_name')
    .eq('id', user.id)
    .single()
  const assistantName = profile?.assistant_name || 'Chief'

  // Determine provider capabilities
  const llmConfig = await getUserLLMConfig(user.id)
  const useTools = supportsTools(llmConfig.provider)

  // Gather user context (tasks, calendar, emails, follow-ups, alerts)
  const { contextBlock, alertsBlock } = await gatherUserContext(admin, user.id)

  // Pick the right system prompt based on tool support
  const systemPrompt = useTools ? getChatSystemPrompt(assistantName) : getChatSystemPromptFallback(assistantName)

  // Build messages array
  const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
    {
      role: 'system',
      content: `${systemPrompt}\n\n--- USER CONTEXT ---\n${contextBlock}${alertsBlock}`,
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

  const { client, model } = await createUserAIClient(user.id)

  // SSE encoder
  const encoder = new TextEncoder()

  if (useTools) {
    // ─── Function-calling path ───
    return handleWithTools(client, model, messages, user.id, admin, encoder)
  } else {
    // ─── Text-parsing fallback path ───
    return handleWithTextParsing(client, model, messages, user.id, admin, encoder)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Function-calling path (DeepSeek, OpenAI, Groq, Claude)
// ─────────────────────────────────────────────────────────────────────────────

async function handleWithTools(
  client: OpenAI,
  model: string,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  userId: string,
  admin: any,
  encoder: TextEncoder,
) {
  const readable = new ReadableStream({
    async start(controller) {
      try {
        // First call: may produce text + tool_calls
        const stream = await client.chat.completions.create({
          model,
          messages,
          tools: CHIEF_TOOLS,
          stream: true,
          temperature: 0.7,
          max_tokens: 2048,
        })

        let fullContent = ''
        let sanitizedSent = 0
        const toolCalls: Map<number, { id: string; name: string; args: string }> = new Map()

        for await (const chunk of stream) {
          const choice = chunk.choices[0]
          if (!choice) continue

          // Stream text content to client (sanitized to remove DSML leaks)
          const content = choice.delta?.content
          if (content) {
            fullContent += content
            const clean = sanitizeContent(fullContent)
            if (clean.length > sanitizedSent) {
              const newText = clean.slice(sanitizedSent)
              sanitizedSent = clean.length
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: newText })}\n\n`)
              )
            }
          }

          // Accumulate tool calls
          const deltaToolCalls = choice.delta?.tool_calls
          if (deltaToolCalls) {
            for (const tc of deltaToolCalls) {
              const existing = toolCalls.get(tc.index)
              if (existing) {
                // Append to existing arguments string
                if (tc.function?.arguments) {
                  existing.args += tc.function.arguments
                }
              } else {
                toolCalls.set(tc.index, {
                  id: tc.id || `call_${tc.index}`,
                  name: tc.function?.name || '',
                  args: tc.function?.arguments || '',
                })
              }
            }
          }
        }

        // If there were tool calls, execute them and get a final response
        if (toolCalls.size > 0) {
          const actionResults = []

          // Build the assistant message with tool_calls for the conversation
          const assistantToolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = []

          for (const [, tc] of toolCalls) {
            assistantToolCalls.push({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: tc.args },
            } as OpenAI.Chat.Completions.ChatCompletionMessageToolCall)
          }

          // Add the assistant message with all tool calls
          messages.push({
            role: 'assistant',
            content: fullContent || null,
            tool_calls: assistantToolCalls,
          } as any)

          // Execute each tool call and add results
          for (const [, tc] of toolCalls) {
            let args: Record<string, any> = {}
            try {
              args = JSON.parse(tc.args)
            } catch {
              // Malformed args — skip
            }

            const result = await executeToolCall(tc.name, args, userId, admin)
            actionResults.push(result)

            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            } as any)
          }

          // Send action results to the frontend
          if (actionResults.length > 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ actions: actionResults })}\n\n`)
            )
          }

          // Second call: let the LLM summarize the tool results into a natural response
          try {
            const followUp = await client.chat.completions.create({
              model,
              messages,
              stream: true,
              temperature: 0.7,
              max_tokens: 1024,
            })

            let followContent = ''
            let followSent = 0
            for await (const chunk of followUp) {
              const content = chunk.choices[0]?.delta?.content
              if (content) {
                followContent += content
                const clean = sanitizeContent(followContent)
                if (clean.length > followSent) {
                  const newText = clean.slice(followSent)
                  followSent = clean.length
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content: newText })}\n\n`)
                  )
                }
              }
            }
          } catch {
            // Follow-up call failed — the action results are already sent
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
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

// ─────────────────────────────────────────────────────────────────────────────
// Text-parsing fallback path (Ollama, custom providers)
// ─────────────────────────────────────────────────────────────────────────────

async function handleWithTextParsing(
  client: OpenAI,
  model: string,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  userId: string,
  admin: any,
  encoder: TextEncoder,
) {
  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 2048,
  })

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
          const results = await executeActions(actions, userId, admin)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ actions: results })}\n\n`)
          )
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
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
