import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Calculate and update urgency scores for all active commitments.
 * Can be called from API routes, scan-stream, or cron jobs.
 */
export async function calculateUrgencyScores(supabase: SupabaseClient, userId: string): Promise<{ updated: number; total: number }> {
  const { data: commitments } = await supabase
    .from('commitments')
    .select('id, type, contact_email, deadline, deadline_fuzzy, status, last_nudge_at, created_at, urgency_score')
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress', 'waiting', 'overdue'])

  if (!commitments || commitments.length === 0) {
    return { updated: 0, total: 0 }
  }

  const { data: vipContacts } = await supabase
    .from('contacts')
    .select('email, importance')
    .eq('user_id', userId)
    .in('importance', ['vip', 'high'])

  const vipEmails = new Set((vipContacts || []).map(c => c.email))

  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  let updated = 0

  for (const c of commitments) {
    let score = 0

    if (c.deadline) {
      const [y, m, d] = c.deadline.split('-').map(Number)
      const deadline = new Date(Date.UTC(y, m - 1, d))
      const daysLeft = Math.round((deadline.getTime() - today.getTime()) / 86400000)

      if (daysLeft < 0) {
        score += 5 + Math.min(Math.abs(daysLeft), 5)
        if (c.status !== 'overdue') {
          await supabase.from('commitments').update({ status: 'overdue' }).eq('id', c.id)
        }
      } else if (daysLeft === 0) {
        score += 4
      } else if (daysLeft === 1) {
        score += 3
      } else if (daysLeft <= 3) {
        score += 2
      } else if (daysLeft <= 7) {
        score += 1
      }
    } else if (c.deadline_fuzzy) {
      const fuzzy = c.deadline_fuzzy.toLowerCase()
      if (fuzzy.includes('asap') || fuzzy.includes('urgent') || fuzzy.includes('尽快')) {
        score += 3
      } else {
        score += 1
      }
    }

    if (c.contact_email && vipEmails.has(c.contact_email)) {
      score += 2
    }

    if (c.last_nudge_at) {
      score += 2
    }

    const ageInDays = Math.ceil((today.getTime() - new Date(c.created_at).getTime()) / 86400000)
    if (ageInDays > 14) {
      score += 2
    } else if (ageInDays > 7) {
      score += 1
    }

    if (c.type === 'family') {
      score = Math.max(score, 3)
    }

    score = Math.min(score, 10)

    if (score !== c.urgency_score) {
      await supabase
        .from('commitments')
        .update({ urgency_score: score })
        .eq('id', c.id)
      updated++
    }
  }

  return { updated, total: commitments.length }
}
