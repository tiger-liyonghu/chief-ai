/**
 * Notification dedup — persisted in Supabase instead of in-memory Maps.
 * Prevents duplicate sends across service restarts.
 */

import { supabase } from './supabase'

export async function wasNotificationSent(
  userId: string,
  type: string,
  referenceId: string,
  date: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('notification_log')
    .select('id')
    .eq('user_id', userId)
    .eq('notification_type', type)
    .eq('reference_id', referenceId)
    .eq('sent_date', date)
    .limit(1)

  return !!data && data.length > 0
}

export async function markNotificationSent(
  userId: string,
  type: string,
  referenceId: string,
  date: string,
): Promise<void> {
  await supabase.from('notification_log').upsert({
    user_id: userId,
    notification_type: type,
    reference_id: referenceId,
    sent_date: date,
  }, { onConflict: 'user_id,notification_type,reference_id,sent_date' })
}

export async function trackLLMUsage(
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  toolCalls: number,
  durationMs: number,
  taskType: string,
): Promise<void> {
  try {
    await supabase.from('llm_usage').insert({
      user_id: userId,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      tool_calls: toolCalls,
      duration_ms: durationMs,
      task_type: taskType,
    })
  } catch (err) { console.warn('[Apple] trackLLMUsage failed:', err) }
}
