/**
 * Pre-fetch context for persons mentioned in a user message.
 *
 * Before the LLM call, this utility:
 * 1. Extracts person names from the message (English + Chinese)
 * 2. Matches them against the contacts table
 * 3. Calls resolveContext for each match
 * 4. Returns a formatted context block to inject into the system prompt
 *
 * This replaces 4-5 tool call chains with a single pre-fetch,
 * giving the LLM context without additional round-trips.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { resolveContext, contextToPrompt } from './resolve-context'

/**
 * Extract potential person names from a message.
 * Handles:
 * - English names: 2-3 consecutive capitalized words (e.g. "John Smith", "Mary Jane Watson")
 * - Chinese names: 2-4 character sequences of CJK unified ideographs
 */
export function extractNames(message: string): string[] {
  const names: string[] = []

  // English names: 2-3 consecutive capitalized words
  // Avoids matching common sentence starters by requiring at least 2 words
  const englishPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g
  let match
  while ((match = englishPattern.exec(message)) !== null) {
    const candidate = match[1]
    // Skip common non-name phrases
    const skipPhrases = [
      'Good Morning', 'Good Afternoon', 'Good Evening', 'Thank You',
      'Happy Birthday', 'New Year', 'Merry Christmas', 'Happy New',
    ]
    if (!skipPhrases.some(p => candidate.startsWith(p))) {
      names.push(candidate)
    }
  }

  // Chinese names: 2-4 CJK characters
  // Chinese names typically appear after common patterns like:
  // 和X, 跟X, 找X, 约X, 给X, 问X, 告诉X, 联系X, or just standalone
  const chinesePattern = /(?:和|跟|找|约|给|问|告诉|联系|见|叫|是|关于)\s*([\u4e00-\u9fff]{2,4})/g
  while ((match = chinesePattern.exec(message)) !== null) {
    names.push(match[1])
  }

  // Also try standalone Chinese names (2-3 chars that could be names)
  // More conservative: only at word boundaries
  const standaloneChinesePattern = /(?:^|[，。！？、\s])(\p{Script=Han}{2,3})(?:的|说|问|回|来|去|要|在|$|[，。！？、\s])/gu
  while ((match = standaloneChinesePattern.exec(message)) !== null) {
    const candidate = match[1]
    // Skip common non-name words
    const skipWords = [
      '什么', '怎么', '为什么', '这个', '那个', '今天', '明天', '昨天',
      '现在', '已经', '可以', '不是', '没有', '但是', '因为', '所以',
      '如果', '这些', '那些', '时候', '知道', '觉得', '需要', '应该',
      '他们', '我们', '你们', '大家', '公司', '工作', '会议', '项目',
    ]
    if (!skipWords.includes(candidate) && !names.includes(candidate)) {
      names.push(candidate)
    }
  }

  return [...new Set(names)]
}

/**
 * Pre-fetch context for all persons mentioned in a message.
 *
 * @param supabase - Supabase client (with user auth or admin)
 * @param userId - The current user's ID
 * @param message - The user's message text
 * @returns Formatted context string, or empty string if no matches
 */
export async function preFetchContext(
  supabase: SupabaseClient,
  userId: string,
  message: string,
): Promise<string> {
  const names = extractNames(message)
  if (names.length === 0) return ''

  const contextParts: string[] = []

  for (const name of names.slice(0, 3)) { // Cap at 3 names to avoid latency
    // Search contacts by name (fuzzy match)
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email, company, role, relationship, importance')
      .eq('user_id', userId)
      .ilike('name', `%${name}%`)
      .limit(1)

    if (!contacts || contacts.length === 0) continue

    const contact = contacts[0]

    try {
      const bundle = await resolveContext(supabase, userId, contact.id, {
        entityType: 'person',
        maxHops: 1,
        hydrateEntities: true,
      })

      const summary = contextToPrompt(bundle, 1)
      if (summary) {
        contextParts.push(summary)
      }
    } catch (err) {
      // Non-fatal: if context resolution fails, skip this person
      console.error(`[pre-fetch] Failed to resolve context for ${name}:`, err)
    }
  }

  if (contextParts.length === 0) return ''

  return `\n--- Pre-loaded context for mentioned persons ---\n${contextParts.join('\n---\n')}\n--- End context ---`
}
