import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUnrepliedEmails, getCoolingContacts, getCalendarConflicts } from '@/lib/signals/query'

/**
 * GET /api/onboarding/wow
 *
 * Returns instant wow data — no LLM, pure database queries.
 * Designed to respond in <5 seconds even with no prior email processing.
 *
 * This powers the first thing a new user sees after connecting Gmail.
 * Goal: "操，这个我确实忘了。"
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const [unreplied, cooling, conflicts] = await Promise.all([
    getUnrepliedEmails(admin, user.id, { limit: 5 }),
    getCoolingContacts(admin, user.id, { threshold: 40, limit: 5 }),
    getCalendarConflicts(admin, user.id, { days: 7 }),
  ])

  return NextResponse.json({
    unrepliedCount: unreplied.length,
    unrepliedTop: unreplied.slice(0, 3).map(e => ({
      from: e.fromName || e.from,
      subject: e.subject,
      daysSince: e.daysSince,
    })),

    coolingCount: cooling.length,
    coolingTop: cooling.slice(0, 3).map(c => ({
      name: c.name,
      daysSince: c.daysSinceContact,
      importance: c.importance,
    })),

    conflictCount: conflicts.length,
    conflictTop: conflicts.slice(0, 3).map(c => ({
      event1: c.event1.title,
      event2: c.event2.title,
      isFamily: c.involvesFamilyEvent,
    })),
  })
}
