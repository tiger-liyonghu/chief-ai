import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') || '7')

  const since = new Date()
  since.setDate(since.getDate() - days)

  // Get all commitments for the period
  const { data: all } = await supabase
    .from('commitments')
    .select('id, type, status, deadline, completed_at, created_at')
    .eq('user_id', user.id)
    .gte('created_at', since.toISOString())

  const commitments = all || []

  // Active commitments (current state, not period-limited)
  const { data: active } = await supabase
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
  const complianceRate = totalWithDeadline.length > 0
    ? Math.round((completed.length / (completed.length + overdue.length)) * 100)
    : 100

  // Family compliance
  const familyAll = commitments.filter(c => c.type === 'family')
  const familyDone = familyAll.filter(c => c.status === 'done')
  const familyComplianceRate = familyAll.length > 0
    ? Math.round((familyDone.length / familyAll.length) * 100)
    : 100

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

    // Top urgent items
    top_urgent: activeList
      .sort((a, b) => (b.urgency_score || 0) - (a.urgency_score || 0))
      .slice(0, 5)
  })
}
