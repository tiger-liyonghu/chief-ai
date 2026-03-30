import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/commitments/link
 * Create a dependency between two commitments.
 *
 * Body: { from_id: string, to_id: string, relation: 'depends_on' | 'blocks' }
 *
 * "A depends_on B" means A cannot be completed until B is done.
 * "A blocks B" means B cannot be completed until A is done.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { from_id, to_id, relation } = await request.json()

  if (!from_id || !to_id) {
    return NextResponse.json({ error: 'from_id and to_id required' }, { status: 400 })
  }
  if (from_id === to_id) {
    return NextResponse.json({ error: 'Cannot link a commitment to itself' }, { status: 400 })
  }

  const relationType = relation === 'blocks' ? 'blocks_commitment' : 'depends_on_commitment'

  const admin = createAdminClient()

  // Verify both commitments belong to this user
  const { data: commitments } = await admin
    .from('commitments')
    .select('id')
    .eq('user_id', user.id)
    .in('id', [from_id, to_id])

  if (!commitments || commitments.length !== 2) {
    return NextResponse.json({ error: 'One or both commitments not found' }, { status: 404 })
  }

  // Check for existing relation
  const { data: existing } = await admin
    .from('relations')
    .select('id')
    .eq('user_id', user.id)
    .eq('from_entity', from_id)
    .eq('to_entity', to_id)
    .eq('relation', relationType)
    .eq('is_active', true)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Link already exists', existing_id: existing.id }, { status: 409 })
  }

  const { data: newRelation, error } = await admin
    .from('relations')
    .insert({
      user_id: user.id,
      from_entity: from_id,
      from_type: 'commitment',
      relation: relationType,
      to_entity: to_id,
      to_type: 'commitment',
      source: 'manual',
      confidence: 1.0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(newRelation)
}

/**
 * DELETE /api/commitments/link
 * Remove a dependency between two commitments.
 * Body: { relation_id: string }
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { relation_id } = await request.json()
  if (!relation_id) return NextResponse.json({ error: 'relation_id required' }, { status: 400 })

  const admin = createAdminClient()

  const { error } = await admin
    .from('relations')
    .update({ is_active: false })
    .eq('id', relation_id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
