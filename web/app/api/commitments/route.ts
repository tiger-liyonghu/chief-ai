import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Compute transitive blocking chains:
 * If commitment A depends_on commitment B, and B is overdue → A is "blocked".
 * If A blocks B, and A is overdue → B is also "blocked" (waiting on A).
 */
async function computeBlockingChains(
  userId: string,
  commitments: any[],
): Promise<Map<string, { blocked_by: Array<{ id: string; title: string; deadline: string | null; days_overdue: number }> }>> {
  const admin = createAdminClient()
  const result = new Map<string, { blocked_by: any[] }>()

  if (commitments.length === 0) return result

  // Fetch all commitment-commitment relations for this user
  const { data: relations } = await admin
    .from('relations')
    .select('from_entity, to_entity, relation')
    .eq('user_id', userId)
    .eq('from_type', 'commitment')
    .eq('to_type', 'commitment')
    .in('relation', ['depends_on_commitment', 'blocks_commitment'])
    .eq('is_active', true)

  if (!relations || relations.length === 0) return result

  // Build lookup maps
  const commitmentMap = new Map<string, any>()
  for (const c of commitments) commitmentMap.set(c.id, c)

  const now = new Date()

  for (const rel of relations) {
    if (rel.relation === 'depends_on_commitment') {
      // A depends_on B → if B is overdue, A is blocked
      const dependentId = rel.from_entity  // A
      const dependencyId = rel.to_entity   // B
      const dependency = commitmentMap.get(dependencyId)

      if (dependency && dependency.deadline) {
        const daysOverdue = Math.ceil((now.getTime() - new Date(dependency.deadline).getTime()) / 86400000)
        if (daysOverdue > 0 && dependency.status !== 'done') {
          if (!result.has(dependentId)) result.set(dependentId, { blocked_by: [] })
          result.get(dependentId)!.blocked_by.push({
            id: dependency.id,
            title: dependency.title,
            deadline: dependency.deadline,
            days_overdue: daysOverdue,
          })
        }
      }
    } else if (rel.relation === 'blocks_commitment') {
      // A blocks B → if A is overdue, B is blocked
      const blockerId = rel.from_entity    // A
      const blockedId = rel.to_entity      // B
      const blocker = commitmentMap.get(blockerId)

      if (blocker && blocker.deadline) {
        const daysOverdue = Math.ceil((now.getTime() - new Date(blocker.deadline).getTime()) / 86400000)
        if (daysOverdue > 0 && blocker.status !== 'done') {
          if (!result.has(blockedId)) result.set(blockedId, { blocked_by: [] })
          result.get(blockedId)!.blocked_by.push({
            id: blocker.id,
            title: blocker.title,
            deadline: blocker.deadline,
            days_overdue: daysOverdue,
          })
        }
      }
    }
  }

  return result
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')       // i_promised | they_promised | family
  const status = searchParams.get('status')   // pending | in_progress | waiting | done | overdue
  const view = searchParams.get('view')       // 'active' (default) | 'all' | 'done'

  let query = supabase
    .from('commitments')
    .select('*, contacts(id, name, company, email, importance)')
    .eq('user_id', user.id)

  if (type) query = query.eq('type', type)

  if (view === 'done') {
    query = query.eq('status', 'done').order('completed_at', { ascending: false }).limit(20)
  } else if (view === 'all') {
    // no status filter
  } else {
    // active view: everything that's not done or cancelled
    query = query.in('status', ['pending', 'in_progress', 'waiting', 'overdue'])
  }

  if (status) query = query.eq('status', status)

  query = query
    .order('urgency_score', { ascending: false })
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const commitments = data || []

  // Compute blocking chains (only for active view)
  if (view !== 'done' && commitments.length > 0) {
    try {
      const blockingChains = await computeBlockingChains(user.id, commitments)
      for (const c of commitments) {
        const blocking = blockingChains.get(c.id)
        if (blocking) {
          (c as any).blocked_by = blocking.blocked_by
        }
      }
    } catch {
      // Non-fatal — return commitments without blocking info
    }
  }

  return NextResponse.json(commitments)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Dedup check: skip if similar active commitment exists
  if (body.title) {
    const { data: existing } = await supabase
      .from('commitments')
      .select('id, title')
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress', 'waiting', 'overdue'])

    const isDupe = (existing || []).some(c =>
      c.title.toLowerCase().trim() === body.title.toLowerCase().trim()
    )
    if (isDupe) {
      return NextResponse.json({ error: 'Similar commitment already exists', duplicate: true }, { status: 409 })
    }
  }

  const { data, error } = await supabase
    .from('commitments')
    .insert({
      user_id: user.id,
      type: body.type || 'i_promised',
      contact_id: body.contact_id,
      contact_name: body.contact_name,
      contact_email: body.contact_email,
      family_member: body.family_member,
      title: body.title,
      description: body.description,
      source_type: body.source_type || 'manual',
      source_ref: body.source_ref,
      source_email_id: body.source_email_id,
      deadline: body.deadline,
      deadline_fuzzy: body.deadline_fuzzy,
      urgency_score: body.urgency_score || 0,
      confidence: body.confidence,
      status: body.status || 'pending',
      trip_id: body.trip_id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  const allowedFields = [
    'type', 'contact_id', 'contact_name', 'contact_email', 'family_member',
    'title', 'description', 'deadline', 'deadline_fuzzy', 'urgency_score',
    'status', 'last_nudge_at', 'snoozed_until', 'trip_id'
  ]

  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  // Auto-set completed_at when status changes to done
  if (body.status === 'done' && !body.completed_at) {
    updates.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('commitments')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
