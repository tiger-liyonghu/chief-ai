import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Urgency Scoring Algorithm for commitments.
 * Calculates urgency_score based on multiple signals.
 * Can be called on-demand or via cron.
 */

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get all active commitments
  const { data: commitments } = await supabase
    .from('commitments')
    .select('id, type, contact_id, contact_email, deadline, deadline_fuzzy, status, last_nudge_at, created_at, urgency_score')
    .eq('user_id', user.id)
    .in('status', ['pending', 'in_progress', 'waiting', 'overdue'])

  if (!commitments || commitments.length === 0) {
    return NextResponse.json({ updated: 0 })
  }

  // Get VIP contacts
  const { data: vipContacts } = await supabase
    .from('contacts')
    .select('email, importance')
    .eq('user_id', user.id)
    .in('importance', ['vip', 'high'])

  const vipEmails = new Set((vipContacts || []).map(c => c.email))

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let updated = 0

  for (const c of commitments) {
    let score = 0

    // 1. Deadline proximity
    if (c.deadline) {
      const deadline = new Date(c.deadline)
      const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / 86400000)

      if (daysLeft < 0) {
        // Overdue
        score += 5 + Math.min(Math.abs(daysLeft), 5) // 5-10 for overdue
        // Auto-update status to overdue
        if (c.status !== 'overdue') {
          await supabase.from('commitments').update({ status: 'overdue' }).eq('id', c.id)
        }
      } else if (daysLeft === 0) {
        score += 4 // Due today
      } else if (daysLeft === 1) {
        score += 3 // Due tomorrow
      } else if (daysLeft <= 3) {
        score += 2 // Due within 3 days
      } else if (daysLeft <= 7) {
        score += 1 // Due within a week
      }
    } else if (c.deadline_fuzzy) {
      // Fuzzy deadlines get a base urgency
      const fuzzy = c.deadline_fuzzy.toLowerCase()
      if (fuzzy.includes('asap') || fuzzy.includes('urgent') || fuzzy.includes('尽快')) {
        score += 3
      } else {
        score += 1
      }
    }

    // 2. VIP contact
    if (c.contact_email && vipEmails.has(c.contact_email)) {
      score += 2
    }

    // 3. Been nudged (means the other party is waiting)
    if (c.last_nudge_at) {
      score += 2
    }

    // 4. Age of commitment (older = more urgent if still pending)
    const ageInDays = Math.ceil((today.getTime() - new Date(c.created_at).getTime()) / 86400000)
    if (ageInDays > 14) {
      score += 2 // Stale commitment
    } else if (ageInDays > 7) {
      score += 1
    }

    // 5. Family commitments — hard constraint, always visible
    if (c.type === 'family') {
      score = Math.max(score, 3) // Floor of 3 for family
    }

    // 6. Cap at 10
    score = Math.min(score, 10)

    // Only update if score changed
    if (score !== c.urgency_score) {
      await supabase
        .from('commitments')
        .update({ urgency_score: score })
        .eq('id', c.id)
      updated++
    }
  }

  return NextResponse.json({ updated, total: commitments.length })
}
