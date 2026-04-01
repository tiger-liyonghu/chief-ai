/**
 * 🧠 Sophia's Brain — Working Memory (Layer 1)
 *
 * Maintains conversation context across messages.
 * After each exchange, generates a 1-2 sentence summary.
 * Injected into the next conversation to prevent context loss.
 * Auto-expires: 24 hours.
 */

import { SupabaseClient } from '@supabase/supabase-js'

interface ChatSession {
  id: string
  summary: string | null
  message_count: number
  updated_at: string
}

/**
 * Get the current chat session for a user + channel.
 * Returns null if no recent session (> 24 hours old).
 */
export async function getSession(
  admin: SupabaseClient,
  userId: string,
  channel: 'dashboard' | 'whatsapp' = 'dashboard',
): Promise<ChatSession | null> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data } = await admin
    .from('chat_sessions')
    .select('id, summary, message_count, updated_at')
    .eq('user_id', userId)
    .eq('channel', channel)
    .gte('updated_at', twentyFourHoursAgo)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  return data || null
}

/**
 * Update session with a new summary after a conversation exchange.
 * Creates a new session if none exists.
 */
export async function updateSession(
  admin: SupabaseClient,
  userId: string,
  summary: string,
  channel: 'dashboard' | 'whatsapp' = 'dashboard',
): Promise<void> {
  const session = await getSession(admin, userId, channel)

  if (session) {
    await admin
      .from('chat_sessions')
      .update({
        summary,
        message_count: session.message_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)
  } else {
    await admin
      .from('chat_sessions')
      .insert({
        user_id: userId,
        channel,
        summary,
        message_count: 1,
      })
  }
}

/**
 * Generate a conversation summary from the latest exchange.
 * Uses a lightweight LLM call (classification task type, low tokens).
 */
export function buildSummaryPrompt(userMessage: string, assistantReply: string): string {
  return `Summarize this conversation exchange in 1-2 sentences (Chinese if user spoke Chinese, English otherwise). Focus on: what the user asked, what was decided, any action taken.

User: ${userMessage.slice(0, 300)}
Assistant: ${assistantReply.slice(0, 500)}

Summary:`
}

/**
 * Format session context for injection into Sophia's prompt.
 * Returns empty string if no session or session is empty.
 */
export function formatSessionContext(session: ChatSession | null): string {
  if (!session || !session.summary) return ''
  return `\n[PREVIOUS_CONTEXT: ${session.summary}]`
}

/**
 * Auto-record important conversation moments as episodic memories.
 * Triggered after each exchange. Only fires if message matches triggers.
 */
const EPISODE_TRIGGERS = [
  { pattern: /答应|承诺|promise|commit|保证/i, type: 'event' as const, importance: 7 },
  { pattern: /决定|decide|确定|定了|选择|go with/i, type: 'event' as const, importance: 6 },
  { pattern: /取消|cancel|不去了|改期|推迟|postpone/i, type: 'event' as const, importance: 6 },
  { pattern: /喜欢|偏好|prefer|习惯|不喜欢|avoid/i, type: 'preference' as const, importance: 5 },
  { pattern: /记住|remember|别忘|don't forget/i, type: 'event' as const, importance: 7 },
  { pattern: /以后|from now on|下次|next time/i, type: 'lesson' as const, importance: 6 },
]

export async function maybeRecordEpisode(
  admin: SupabaseClient,
  userId: string,
  userMessage: string,
  assistantReply: string,
): Promise<void> {
  const matched = EPISODE_TRIGGERS.find(t => t.pattern.test(userMessage))
  if (!matched) return

  try {
    const { saveMemory } = await import('@/lib/ai/memory/episodic-memory')
    await saveMemory(admin, userId, {
      memory_type: matched.type,
      content: `User: "${userMessage.slice(0, 150)}" → Action: "${assistantReply.slice(0, 150)}"`,
      importance: matched.importance,
      confidence: 0.7,
      source: 'observed',
    })
  } catch { /* non-fatal */ }
}

/**
 * Clean up expired sessions (> 24 hours).
 * Called periodically by the scheduler.
 */
export async function cleanupExpiredSessions(admin: SupabaseClient): Promise<number> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data } = await admin
    .from('chat_sessions')
    .delete()
    .lt('updated_at', twentyFourHoursAgo)
    .select('id')

  return data?.length || 0
}
