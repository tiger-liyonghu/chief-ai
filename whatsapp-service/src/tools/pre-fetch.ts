/**
 * Pre-fetch context for persons mentioned in a WhatsApp message.
 *
 * Mirrors the logic in web/lib/ontology/pre-fetch.ts but runs
 * directly against the Supabase admin client available in the
 * WhatsApp service process.
 *
 * Returns a formatted context block to inject into the system prompt.
 */

import { supabase } from '../supabase'

/**
 * Extract potential person names from a message.
 * - English: 2-3 consecutive capitalized words
 * - Chinese: 2-4 CJK chars after context markers, or standalone 2-3 char names
 */
function extractNames(message: string): string[] {
  const names: string[] = []

  // English names
  const englishPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g
  let match
  while ((match = englishPattern.exec(message)) !== null) {
    const candidate = match[1]
    const skipPhrases = [
      'Good Morning', 'Good Afternoon', 'Good Evening', 'Thank You',
      'Happy Birthday', 'New Year', 'Merry Christmas', 'Happy New',
    ]
    if (!skipPhrases.some(p => candidate.startsWith(p))) {
      names.push(candidate)
    }
  }

  // Chinese names after context markers
  const chinesePattern = /(?:和|跟|找|约|给|问|告诉|联系|见|叫|是|关于)\s*([\u4e00-\u9fff]{2,4})/g
  while ((match = chinesePattern.exec(message)) !== null) {
    names.push(match[1])
  }

  // Standalone Chinese names
  const standaloneChinesePattern = /(?:^|[，。！？、\s])(\p{Script=Han}{2,3})(?:的|说|问|回|来|去|要|在|$|[，。！？、\s])/gu
  while ((match = standaloneChinesePattern.exec(message)) !== null) {
    const candidate = match[1]
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
 * Pre-fetch context for mentioned persons.
 * Returns formatted string to inject into system prompt, or empty string.
 */
export async function preFetchPersonContext(
  userId: string,
  message: string,
): Promise<string> {
  const names = extractNames(message)
  if (names.length === 0) return ''

  const contextParts: string[] = []

  for (const name of names.slice(0, 3)) {
    // Find matching contact
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email, company, role, relationship, importance')
      .eq('user_id', userId)
      .ilike('name', `%${name}%`)
      .limit(1)

    if (!contacts || contacts.length === 0) continue

    const contact = contacts[0]
    const lines: string[] = []
    lines.push(`Person: ${contact.name} (${contact.relationship || 'contact'})`)

    const facts: string[] = []
    if (contact.company) facts.push(`Works at ${contact.company}`)
    if (contact.role) facts.push(`Role: ${contact.role}`)
    if (contact.importance === 'vip') facts.push('VIP contact')
    if (contact.email) facts.push(`Email: ${contact.email}`)
    if (facts.length > 0) lines.push(`Facts: ${facts.join(', ')}`)

    // Load 1-hop relations for this contact
    const [outRes, inRes] = await Promise.all([
      supabase
        .from('relations')
        .select('relation, to_entity, to_type, properties')
        .eq('user_id', userId)
        .eq('from_entity', contact.id)
        .eq('is_active', true)
        .limit(10),
      supabase
        .from('relations')
        .select('relation, from_entity, from_type, properties')
        .eq('user_id', userId)
        .eq('to_entity', contact.id)
        .eq('is_active', true)
        .limit(10),
    ])

    const relCount = (outRes.data?.length || 0) + (inRes.data?.length || 0)
    if (relCount > 0) {
      lines.push(`Relations: ${relCount} total`)

      // Check for urgent commitments
      const commitmentIds = [
        ...(outRes.data || []).filter(r => r.to_type === 'commitment').map(r => r.to_entity),
        ...(inRes.data || []).filter(r => r.from_type === 'commitment').map(r => r.from_entity),
      ]

      if (commitmentIds.length > 0) {
        const { data: commitments } = await supabase
          .from('commitments')
          .select('title, status, deadline')
          .in('id', commitmentIds.slice(0, 5))

        const urgent = (commitments || []).filter(c => {
          if (c.status === 'overdue') return true
          if (c.deadline) {
            const daysLeft = Math.ceil((new Date(c.deadline).getTime() - Date.now()) / 86400000)
            return daysLeft <= 1 && daysLeft >= 0
          }
          return false
        })

        if (urgent.length > 0) {
          lines.push(`URGENT: ${urgent.map(c => `${c.status === 'overdue' ? 'Overdue' : 'Due today'}: ${c.title}`).join('; ')}`)
        }
      }
    }

    contextParts.push(lines.join('\n'))
  }

  if (contextParts.length === 0) return ''

  return `\n--- Pre-loaded context for mentioned persons ---\n${contextParts.join('\n---\n')}\n--- End context ---`
}
