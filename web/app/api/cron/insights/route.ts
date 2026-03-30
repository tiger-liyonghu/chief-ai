import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/cron/insights
 * Vercel Cron: runs daily.
 * - Fridays: generates weekly insights snapshot for every user
 * - 1st of month: generates monthly insights snapshot for every user
 * - Other days: no-op
 *
 * Reuses the same aggregation logic as POST /api/insights but runs
 * with the service-role client so no user session is required.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const dayOfWeek = now.getDay()       // 0=Sun … 5=Fri … 6=Sat
  const dayOfMonth = now.getDate()
  const isFriday = dayOfWeek === 5
  const isFirstOfMonth = dayOfMonth === 1

  if (!isFriday && !isFirstOfMonth) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'Not Friday and not 1st of month',
      date: now.toISOString(),
    })
  }

  const admin = createAdminClient()

  // Fetch all active users
  const { data: users, error: usersErr } = await admin
    .from('profiles')
    .select('id, email')

  if (usersErr || !users) {
    return NextResponse.json({ error: 'Failed to fetch users', detail: usersErr?.message }, { status: 500 })
  }

  const periods: Array<'weekly' | 'monthly'> = []
  if (isFriday) periods.push('weekly')
  if (isFirstOfMonth) periods.push('monthly')

  let generated = 0
  const errors: string[] = []

  for (const user of users) {
    for (const periodType of periods) {
      try {
        await generateInsightSnapshot(admin, user.id, periodType, now)
        generated++
      } catch (err: any) {
        errors.push(`${user.email}/${periodType}: ${err.message}`)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    date: now.toISOString(),
    periods,
    users_checked: users.length,
    snapshots_generated: generated,
    errors: errors.length > 0 ? errors : undefined,
  })
}

/**
 * Core insight generation logic — mirrors /api/insights POST handler
 * but uses the admin (service-role) client instead of a user session.
 */
async function generateInsightSnapshot(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  periodType: 'weekly' | 'monthly',
  now: Date,
) {
  let periodStart: Date
  let periodEnd: Date

  if (periodType === 'weekly') {
    periodEnd = new Date(now)
    periodStart = new Date(now)
    periodStart.setDate(periodStart.getDate() - 7)
  } else {
    periodEnd = new Date(now)
    periodStart = new Date(now)
    periodStart.setMonth(periodStart.getMonth() - 1)
  }

  const startStr = periodStart.toISOString().split('T')[0]
  const endStr = periodEnd.toISOString().split('T')[0]

  // ── Commitment stats ──────────────────────────────────────────────────
  const { data: commitments } = await admin
    .from('commitments')
    .select('id, type, status, deadline, completed_at, created_at')
    .eq('user_id', userId)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())

  const allC = commitments || []
  const completed = allC.filter(c => c.status === 'done')
  const overdue = allC.filter(c => c.status === 'overdue')
  const familyAll = allC.filter(c => c.type === 'family')
  const familyDone = familyAll.filter(c => c.status === 'done')

  const commitmentStats = {
    total: allC.length,
    completed: completed.length,
    overdue: overdue.length,
    pending: allC.filter(c => c.status === 'pending').length,
    compliance_rate: (completed.length + overdue.length) > 0
      ? Math.round((completed.length / (completed.length + overdue.length)) * 100) : 100,
    family_total: familyAll.length,
    family_completed: familyDone.length,
    family_compliance_rate: familyAll.length > 0
      ? Math.round((familyDone.length / familyAll.length) * 100) : 100,
  }

  // ── Relationship stats ────────────────────────────────────────────────
  const { data: contacts } = await admin
    .from('contacts')
    .select('id, name, company, importance, last_contact_at, email_count')
    .eq('user_id', userId)
    .order('last_contact_at', { ascending: false })

  const allContacts = contacts || []
  const activeContacts = allContacts.filter(c =>
    c.last_contact_at && new Date(c.last_contact_at) >= periodStart
  )
  const coldVips = allContacts
    .filter(c => c.importance === 'vip' && c.last_contact_at)
    .filter(c => {
      const daysSince = Math.floor((now.getTime() - new Date(c.last_contact_at!).getTime()) / 86400000)
      return daysSince > 90
    })
    .map(c => ({
      name: c.name,
      company: c.company,
      days_since: Math.floor((now.getTime() - new Date(c.last_contact_at!).getTime()) / 86400000),
    }))

  const relationshipStats = {
    active_contacts: activeContacts.length,
    total_contacts: allContacts.length,
    cold_vips: coldVips,
  }

  // ── Travel stats ──────────────────────────────────────────────────────
  const { data: trips } = await admin
    .from('trips')
    .select('id, destination_city, start_date, end_date, total_expense')
    .eq('user_id', userId)
    .gte('start_date', startStr)
    .lte('start_date', endStr)

  const allTrips = trips || []
  const totalDays = allTrips.reduce((sum, t) => {
    const days = Math.ceil((new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / 86400000)
    return sum + days
  }, 0)

  const travelStats = {
    trips_count: allTrips.length,
    total_days: totalDays,
    total_expense: allTrips.reduce((sum, t) => sum + (Number(t.total_expense) || 0), 0),
    cities: allTrips.map(t => t.destination_city).filter(Boolean),
  }

  // ── Family stats ──────────────────────────────────────────────────────
  const { data: familyEvents } = await admin
    .from('family_calendar')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .lte('start_date', endStr)
    .or(`end_date.gte.${startStr},end_date.is.null`)

  const familyStats = {
    events_in_period: (familyEvents || []).length,
    conflicts_detected: 0,
    family_commitments_kept: familyDone.length,
    family_commitments_total: familyAll.length,
  }

  // ── Upsert snapshot ───────────────────────────────────────────────────
  const { error } = await admin
    .from('insights_snapshots')
    .upsert({
      user_id: userId,
      period_type: periodType,
      period_start: startStr,
      period_end: endStr,
      commitment_stats: commitmentStats,
      relationship_stats: relationshipStats,
      travel_stats: travelStats,
      family_stats: familyStats,
    }, {
      onConflict: 'user_id,period_type,period_start',
    })

  if (error) {
    throw new Error(`Upsert failed: ${error.message}`)
  }
}
