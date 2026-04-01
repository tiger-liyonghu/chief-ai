/**
 * 🧠 Sophia's Brain — Episodic Memory
 *
 * Records and retrieves important events, lessons, and patterns.
 * Used by: briefing (inject relevant memories), chat (recall context),
 * self-review (learn from corrections).
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface Memory {
  id: string
  memory_type: 'event' | 'lesson' | 'preference' | 'pattern'
  content: string
  context: Record<string, unknown>
  importance: number
  confidence: number
  source: 'observed' | 'user_stated' | 'inferred'
  related_contact_id?: string | null
  created_at: string
}

/**
 * Save a new memory.
 */
export async function saveMemory(
  admin: SupabaseClient,
  userId: string,
  memory: {
    memory_type: Memory['memory_type']
    content: string
    context?: Record<string, unknown>
    importance?: number
    confidence?: number
    source?: Memory['source']
    related_contact_id?: string | null
    related_commitment_id?: string | null
  },
): Promise<void> {
  await admin.from('sophia_memories').insert({
    user_id: userId,
    memory_type: memory.memory_type,
    content: memory.content,
    context: memory.context || {},
    importance: memory.importance || 5,
    confidence: memory.confidence || 0.7,
    source: memory.source || 'observed',
    related_contact_id: memory.related_contact_id || null,
    related_commitment_id: memory.related_commitment_id || null,
  })
}

/**
 * Retrieve relevant memories for a given context.
 * Uses keyword matching on content + contact matching.
 * Returns top N by importance.
 */
export async function recallMemories(
  admin: SupabaseClient,
  userId: string,
  opts: {
    contactId?: string
    keywords?: string[]
    limit?: number
  } = {},
): Promise<Memory[]> {
  const limit = opts.limit || 5

  // Strategy: fetch by contact first, then by keywords, deduplicate
  const memories: Memory[] = []
  const seenIds = new Set<string>()

  // 1. Contact-specific memories (highest relevance)
  if (opts.contactId) {
    const { data } = await admin
      .from('sophia_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('related_contact_id', opts.contactId)
      .order('importance', { ascending: false })
      .limit(limit)

    for (const m of data || []) {
      if (!seenIds.has(m.id)) {
        memories.push(m)
        seenIds.add(m.id)
      }
    }
  }

  // 2. Keyword-matched memories
  if (opts.keywords && opts.keywords.length > 0 && memories.length < limit) {
    for (const keyword of opts.keywords.slice(0, 3)) {
      if (memories.length >= limit) break
      const { data } = await admin
        .from('sophia_memories')
        .select('*')
        .eq('user_id', userId)
        .ilike('content', `%${keyword}%`)
        .order('importance', { ascending: false })
        .limit(limit - memories.length)

      for (const m of data || []) {
        if (!seenIds.has(m.id)) {
          memories.push(m)
          seenIds.add(m.id)
        }
      }
    }
  }

  // 3. If still no results, get most important recent memories
  if (memories.length === 0) {
    const { data } = await admin
      .from('sophia_memories')
      .select('*')
      .eq('user_id', userId)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    for (const m of data || []) {
      memories.push(m)
    }
  }

  // Update last_accessed_at for retrieved memories (best-effort)
  if (memories.length > 0) {
    const ids = memories.map(m => m.id)
    try {
      await admin
        .from('sophia_memories')
        .update({ last_accessed_at: new Date().toISOString() })
        .in('id', ids)
    } catch { /* best-effort */ }
  }

  // Apply time-decay: recent memories rank higher
  // relevance = importance * recency_factor
  // recency_factor = 1 / (1 + days_since * 0.05)
  const now = Date.now()
  memories.sort((a, b) => {
    const daysA = (now - new Date(a.created_at).getTime()) / 86400000
    const daysB = (now - new Date(b.created_at).getTime()) / 86400000
    const scoreA = a.importance * (1 / (1 + daysA * 0.05))
    const scoreB = b.importance * (1 / (1 + daysB * 0.05))
    return scoreB - scoreA
  })

  return memories.slice(0, limit)
}

/**
 * Format memories for injection into Sophia's prompt.
 */
export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (memories.length === 0) return ''

  const lines = memories.map(m => {
    const tag = m.memory_type === 'lesson' ? '📝' : m.memory_type === 'pattern' ? '🔄' : m.memory_type === 'preference' ? '⭐' : '📌'
    return `${tag} ${m.content}`
  })

  return `\n--- Sophia's Memories (relevant to this conversation) ---\n${lines.join('\n')}\n--- End Memories ---`
}

/**
 * Auto-record memory when a commitment is completed.
 * Called by the commitment completion handler.
 */
export async function recordCommitmentCompletion(
  admin: SupabaseClient,
  userId: string,
  commitment: {
    id: string
    title: string
    contact_name?: string
    contact_id?: string
    deadline?: string
    completed_at: string
  },
): Promise<void> {
  const daysToComplete = commitment.deadline
    ? Math.ceil((new Date(commitment.completed_at).getTime() - new Date(commitment.deadline).getTime()) / 86400000)
    : null

  let content: string
  let importance: number

  if (daysToComplete !== null && daysToComplete > 0) {
    content = `${commitment.contact_name || '?'} 的「${commitment.title}」逾期 ${daysToComplete} 天后完成`
    importance = 6
  } else if (daysToComplete !== null && daysToComplete <= 0) {
    content = `${commitment.contact_name || '?'} 的「${commitment.title}」提前 ${Math.abs(daysToComplete)} 天完成`
    importance = 4
  } else {
    content = `完成了「${commitment.title}」`
    importance = 3
  }

  await saveMemory(admin, userId, {
    memory_type: 'event',
    content,
    context: { commitment_id: commitment.id, days_to_complete: daysToComplete },
    importance,
    source: 'observed',
    related_contact_id: commitment.contact_id || null,
    related_commitment_id: commitment.id,
  })
}
