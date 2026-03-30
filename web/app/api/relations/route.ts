import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get('entity_id')
  const direction = searchParams.get('direction') // 'from' | 'to' | null (both)
  const relation = searchParams.get('relation')
  const activeOnly = searchParams.get('active_only') !== 'false' // default true

  if (!entityId) {
    return NextResponse.json({ error: 'entity_id is required' }, { status: 400 })
  }

  const results: Record<string, unknown>[] = []

  // Outgoing relations
  if (direction !== 'to') {
    let q = supabase
      .from('relations')
      .select('*')
      .eq('user_id', user.id)
      .eq('from_entity', entityId)

    if (activeOnly) q = q.eq('is_active', true)
    if (relation) q = q.eq('relation', relation)

    const { data, error } = await q.order('created_at', { ascending: false }).limit(100)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (data) results.push(...data.map(r => ({ ...r, _direction: 'outgoing' })))
  }

  // Incoming relations
  if (direction !== 'from') {
    let q = supabase
      .from('relations')
      .select('*')
      .eq('user_id', user.id)
      .eq('to_entity', entityId)

    if (activeOnly) q = q.eq('is_active', true)
    if (relation) q = q.eq('relation', relation)

    const { data, error } = await q.order('created_at', { ascending: false }).limit(100)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (data) results.push(...data.map(r => ({ ...r, _direction: 'incoming' })))
  }

  return NextResponse.json(results)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Validate required fields
  const required = ['from_entity', 'from_type', 'relation', 'to_entity', 'to_type']
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 })
    }
  }

  // Validate relation exists in relation_types
  const { data: relType, error: relTypeErr } = await supabase
    .from('relation_types')
    .select('id, from_type, to_type')
    .eq('id', body.relation)
    .single()

  if (relTypeErr || !relType) {
    return NextResponse.json({ error: `Invalid relation type: ${body.relation}` }, { status: 400 })
  }

  // Validate from_type and to_type match the relation_type definition
  if (relType.from_type !== body.from_type || relType.to_type !== body.to_type) {
    return NextResponse.json({
      error: `Relation "${body.relation}" expects from_type="${relType.from_type}" to_type="${relType.to_type}", got from_type="${body.from_type}" to_type="${body.to_type}"`,
    }, { status: 400 })
  }

  // Dedup: check if active relation already exists
  const { data: existing } = await supabase
    .from('relations')
    .select('id')
    .eq('user_id', user.id)
    .eq('from_entity', body.from_entity)
    .eq('relation', body.relation)
    .eq('to_entity', body.to_entity)
    .eq('is_active', true)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'Relation already exists', duplicate: true, existing_id: existing[0].id },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .from('relations')
    .insert({
      user_id: user.id,
      from_entity: body.from_entity,
      from_type: body.from_type,
      relation: body.relation,
      to_entity: body.to_entity,
      to_type: body.to_type,
      properties: body.properties || {},
      confidence: body.confidence ?? 1.0,
      source: body.source || 'manual',
      valid_from: body.valid_from || new Date().toISOString(),
      valid_to: body.valid_to || null,
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
    'properties', 'confidence', 'source', 'valid_from', 'valid_to', 'is_active',
  ]

  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  const { data, error } = await supabase
    .from('relations')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // Soft delete: set is_active = false
  const { data, error } = await supabase
    .from('relations')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
