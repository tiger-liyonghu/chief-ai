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
