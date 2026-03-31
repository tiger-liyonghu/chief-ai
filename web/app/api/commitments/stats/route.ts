import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') || '7')

  const since = new Date()
  since.setDate(since.getDate() - days)

  // Get all commitments for the period
  const { data: all } = await admin
    .from('commitments')
    .select('id, type, status, deadline, completed_at, created_at')
    .eq('user_id', user.id)
    .gte('created_at', since.toISOString())

  const commitments = all || []

  // Active commitments (current state, not period-limited)
  const { data: active } = await admin
    .from('commitments')
    .select('id, type, status, deadline, urgency_score')
    .eq('user_id', user.id)
    .in('status', ['pending', 'in_progress', 'waiting', 'overdue'])

  const activeList = active || []

  // Calculate stats
  const needsAction = activeList.filter(c => c.type === 'i_promised' && ['pending', 'in_progress', 'overdue'].includes(c.status))
  const waitingOnThem = activeList.filter(c => c.type === 'they_promised' || c.status === 'waiting')
  const familyActive = activeList.filter(c => c.type === 'family')

  const totalWithDeadline = commitments.filter(c => c.deadline)
  const completed = commitments.filter(c => c.status === 'done')
  const overdue = commitments.filter(c => c.status === 'overdue')
  const complianceRate = (completed.length + overdue.length) > 0
    ? Math.round((completed.length / (completed.length + overdue.length)) * 100)
    : null

  // Family compliance
  const familyAll = commitments.filter(c => c.type === 'family')
  const familyDone = familyAll.filter(c => c.status === 'done')
  const familyComplianceRate = familyAll.length > 0
    ? Math.round((familyDone.length / familyAll.length) * 100)
    : null

  // --- Response time metrics (last 30 days) ---
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: completedRecent } = await admin
    .from('commitments')
    .select('id, created_at, completed_at, source_type')
    .eq('user_id', user.id)
    .eq('status', 'done')
    .not('completed_at', 'is', null)
    .gte('completed_at', thirtyDaysAgo.toISOString())

  const completedList = completedRecent || []

  let avgResponseHours = 0
  let fastestResponseHours = 0
  if (completedList.length > 0) {
    const responseTimes = completedList
      .filter(c => c.created_at && c.completed_at)
      .map(c => (new Date(c.completed_at).getTime() - new Date(c.created_at).getTime()) / 3600000)
      .filter(h => h > 0) // exclude invalid

    if (responseTimes.length > 0) {
      avgResponseHours = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      fastestResponseHours = Math.min(...responseTimes)
    }
  }

  // Completion sources heuristic
  const completionSources = { web: 0, whatsapp: 0, auto: 0 }

  for (const c of completedList) {
    if (!c.completed_at) continue

    // Check if a WhatsApp message containing completion signal exists near completion time
    const completedAt = new Date(c.completed_at)
    const windowStart = new Date(completedAt.getTime() - 5 * 60 * 1000) // 5 min before
    const windowEnd = new Date(completedAt.getTime() + 5 * 60 * 1000)   // 5 min after
    const shortId = c.id.substring(0, 6)

    const { data: waMatch } = await admin
      .from('whatsapp_messages')
      .select('id')
      .gte('received_at', windowStart.toISOString())
      .lte('received_at', windowEnd.toISOString())
      .or(`body.ilike.%完成%${shortId}%,body.ilike.%done%${shortId}%,body.ilike.%${shortId}%完成%,body.ilike.%${shortId}%done%`)
      .limit(1)

    if (waMatch && waMatch.length > 0) {
      completionSources.whatsapp++
    } else if (c.source_type === 'manual') {
      // Source type manual typically means web
      completionSources.web++
    } else {
      completionSources.web++
    }
  }

  // Due today
  const today = new Date().toISOString().split('T')[0]
  const dueToday = activeList.filter(c => c.deadline === today)

  // Overdue count
  const overdueActive = activeList.filter(c =>
    c.deadline && c.deadline < today && c.status !== 'done' && c.status !== 'cancelled'
  )

  return NextResponse.json({
    // Counts for dashboard
    needs_action: needsAction.length,
    waiting_on_them: waitingOnThem.length,
    family_active: familyActive.length,
    due_today: dueToday.length,
    overdue: overdueActive.length,

    // Rates
    compliance_rate: complianceRate,
    family_compliance_rate: familyComplianceRate,

    // Period stats
    period_days: days,
    period_total: commitments.length,
    period_completed: completed.length,
    period_overdue: overdue.length,

    // Response time metrics
    avg_response_hours: Math.round(avgResponseHours * 10) / 10,
    fastest_response_hours: Math.round(fastestResponseHours * 10) / 10,
    completion_sources: completionSources,

    // Top urgent items
    top_urgent: activeList
      .sort((a, b) => (b.urgency_score || 0) - (a.urgency_score || 0))
      .slice(0, 5)
  })
}
