/**
 * Topic Resolution — 跨渠道事项归集
 *
 * 两种归集策略：
 * 1. 确定性归集：同一 email thread_id → 同一 Topic
 * 2. 启发式归集：同一 Actor + 24h 内 + 语义相似 → 同一 Topic
 *
 * 调用时机：
 * - analyze-stream 已做了策略 1（thread_id）
 * - 本模块补充策略 2（跨渠道）
 */

import { createAdminClient } from '@/lib/supabase/admin'

interface SignalRef {
  channel: 'email' | 'whatsapp' | 'calendar'
  id: string
  sender_id: string        // email address or phone number
  sender_name: string | null
  title: string | null      // email subject, null for WhatsApp
  preview: string           // snippet or body
  timestamp: string         // ISO
}

/**
 * 尝试将一个 Signal 归入已有 Topic，或创建新 Topic
 */
export async function resolveSignalToTopic(
  userId: string,
  signal: SignalRef,
  commitmentId?: string,
): Promise<string | null> {
  const admin = createAdminClient()

  // ── 策略 1: Email thread_id 已经在 analyze-stream 中处理了 ──
  // 这里只处理跨渠道归集

  // ── 策略 2: 同一 Actor + 24h 窗口 ──
  // 查找该 Actor 最近 24 小时内的活跃 Topic
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600000).toISOString()

  const { data: recentTopics } = await admin
    .from('topics')
    .select('id, title, primary_actor_email, last_signal_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('primary_actor_email', signal.sender_id)
    .gte('last_signal_at', twentyFourHoursAgo)
    .order('last_signal_at', { ascending: false })
    .limit(5)

  if (recentTopics && recentTopics.length > 0) {
    // 简单语义匹配：signal 的内容与 Topic 的 title 有词重叠
    const signalText = `${signal.title || ''} ${signal.preview}`.toLowerCase()
    const signalWords = new Set(signalText.split(/\s+/).filter((w: string) => w.length > 2))

    let bestMatch: { id: string; score: number } | null = null

    for (const topic of recentTopics) {
      const topicWords = new Set(
        (topic.title || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 2)
      )

      // Jaccard similarity
      const intersection = new Set([...signalWords].filter(w => topicWords.has(w)))
      const union = new Set([...signalWords, ...topicWords])
      const similarity = union.size > 0 ? intersection.size / union.size : 0

      if (similarity > 0.2 && (!bestMatch || similarity > bestMatch.score)) {
        bestMatch = { id: topic.id, score: similarity }
      }
    }

    if (bestMatch) {
      // 归入已有 Topic
      await admin.from('topic_signals').upsert({
        topic_id: bestMatch.id,
        user_id: userId,
        signal_channel: signal.channel,
        signal_id: signal.id,
        role: commitmentId ? 'commitment' : 'context',
      }, { onConflict: 'topic_id,signal_channel,signal_id' })

      // 更新 Topic 统计
      await admin.from('topics').update({
        last_signal_at: signal.timestamp,
        // signal_count incremented separately below
        updated_at: new Date().toISOString(),
      }).eq('id', bestMatch.id)

      // Increment signal_count manually
      const { data: topicData } = await admin.from('topics').select('signal_count').eq('id', bestMatch.id).single()
      if (topicData) {
        await admin.from('topics').update({ signal_count: (topicData.signal_count || 0) + 1 }).eq('id', bestMatch.id)
      }

      // Link commitment to Topic
      if (commitmentId) {
        await admin.from('commitments')
          .update({ topic_id: bestMatch.id })
          .eq('id', commitmentId)
          .is('topic_id', null)
      }

      return bestMatch.id
    }

    // 没有语义匹配但有同一 Actor 的 Topic 在 24h 内
    // 如果只有一个 Topic，直接归入（同一个人短时间内通常谈同一件事）
    if (recentTopics.length === 1) {
      const topicId = recentTopics[0].id

      await admin.from('topic_signals').upsert({
        topic_id: topicId,
        user_id: userId,
        signal_channel: signal.channel,
        signal_id: signal.id,
        role: commitmentId ? 'commitment' : 'context',
      }, { onConflict: 'topic_id,signal_channel,signal_id' })

      await admin.from('topics').update({
        last_signal_at: signal.timestamp,
        updated_at: new Date().toISOString(),
      }).eq('id', topicId)

      if (commitmentId) {
        await admin.from('commitments')
          .update({ topic_id: topicId })
          .eq('id', commitmentId)
          .is('topic_id', null)
      }

      return topicId
    }
  }

  // ── 没有匹配，创建新 Topic ──
  const { data: newTopic } = await admin.from('topics').insert({
    user_id: userId,
    title: signal.title || signal.preview.slice(0, 80),
    primary_actor_email: signal.sender_id,
    primary_actor_name: signal.sender_name,
    actor_ids: [signal.sender_id],
    signal_count: 1,
    commitment_count: commitmentId ? 1 : 0,
    first_signal_at: signal.timestamp,
    last_signal_at: signal.timestamp,
  }).select('id').single()

  if (newTopic) {
    await admin.from('topic_signals').insert({
      topic_id: newTopic.id,
      user_id: userId,
      signal_channel: signal.channel,
      signal_id: signal.id,
      role: commitmentId ? 'commitment' : 'origin',
    })

    if (commitmentId) {
      await admin.from('commitments')
        .update({ topic_id: newTopic.id })
        .eq('id', commitmentId)
        .is('topic_id', null)
    }

    return newTopic.id
  }

  return null
}
