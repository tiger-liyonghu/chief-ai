import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Internal Health Dashboard API
 * Returns system-wide metrics for monitoring
 * No auth required (internal use only, protect via deployment)
 */

export async function GET() {
  const admin = createAdminClient()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86400000)
  const dayAgo = new Date(now.getTime() - 86400000)

  // 1. Commitment metrics
  const { count: totalCommitments } = await admin
    .from('commitments')
    .select('*', { count: 'exact', head: true })

  const { count: activeCommitments } = await admin
    .from('commitments')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'in_progress', 'waiting', 'overdue'])

  const { count: overdueCommitments } = await admin
    .from('commitments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'overdue')

  const { count: weekCompleted } = await admin
    .from('commitments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'done')
    .gte('completed_at', weekAgo.toISOString())

  const { count: weekCreated } = await admin
    .from('commitments')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekAgo.toISOString())

  const complianceRate = (weekCompleted || 0) + (overdueCommitments || 0) > 0
    ? Math.round(((weekCompleted || 0) / ((weekCompleted || 0) + (overdueCommitments || 0))) * 100)
    : 100

  // 2. User metrics
  const { count: totalUsers } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const { count: onboardedUsers } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .not('onboarding_completed_at', 'is', null)

  // 3. Family metrics
  const { count: familyEvents } = await admin
    .from('family_calendar')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  const { count: familyCommitments } = await admin
    .from('commitments')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'family')
    .in('status', ['pending', 'in_progress'])

  // 4. Travel metrics
  const { count: activeTrips } = await admin
    .from('trips')
    .select('*', { count: 'exact', head: true })
    .in('status', ['upcoming', 'active', 'pre_trip'])

  const { count: timelineEvents } = await admin
    .from('trip_timeline_events')
    .select('*', { count: 'exact', head: true })

  // 5. Contact metrics
  const { count: totalContacts } = await admin
    .from('contacts')
    .select('*', { count: 'exact', head: true })

  // 6. Email sync metrics
  const { count: recentEmails } = await admin
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .gte('date', dayAgo.toISOString())

  const { count: scannedEmails } = await admin
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .eq('commitment_scanned', true)

  const { count: totalEmails } = await admin
    .from('emails')
    .select('*', { count: 'exact', head: true })

  const scanCoverage = (totalEmails || 0) > 0
    ? Math.round(((scannedEmails || 0) / (totalEmails || 0)) * 100)
    : 0

  // 7. Insights metrics
  const { count: insightReports } = await admin
    .from('insights_snapshots')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({
    timestamp: now.toISOString(),
    system: {
      status: 'ok',
      version: '2.0',
    },
    users: {
      total: totalUsers || 0,
      onboarded: onboardedUsers || 0,
      onboarding_rate: (totalUsers || 0) > 0
        ? Math.round(((onboardedUsers || 0) / (totalUsers || 0)) * 100) : 0,
    },
    commitments: {
      total: totalCommitments || 0,
      active: activeCommitments || 0,
      overdue: overdueCommitments || 0,
      week_completed: weekCompleted || 0,
      week_created: weekCreated || 0,
      compliance_rate: complianceRate,
    },
    family: {
      calendar_events: familyEvents || 0,
      active_commitments: familyCommitments || 0,
    },
    travel: {
      active_trips: activeTrips || 0,
      timeline_events: timelineEvents || 0,
    },
    contacts: {
      total: totalContacts || 0,
    },
    email: {
      total: totalEmails || 0,
      recent_24h: recentEmails || 0,
      scan_coverage: scanCoverage,
    },
    insights: {
      reports_generated: insightReports || 0,
    },
  })
}
