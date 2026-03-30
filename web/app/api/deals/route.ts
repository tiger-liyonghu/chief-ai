import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const stage = searchParams.get('stage')
  const status = searchParams.get('status')

  let query = supabase
    .from('deals')
    .select('*')
    .eq('user_id', user.id)

  if (stage) query = query.eq('stage', stage)
  if (status) query = query.eq('status', status)

  query = query
    .order('updated_at', { ascending: false })
    .limit(200)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (!body.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('deals')
    .insert({
      user_id: user.id,
      name: body.name,
      description: body.description,
      stage: body.stage || 'latent',
      probability: body.probability || 0,
      value: body.value,
      currency: body.currency || 'SGD',
      expected_close: body.expected_close,
      status: body.status || 'active',
      notes: body.notes,
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
    'name', 'description', 'stage', 'probability', 'value', 'currency',
    'expected_close', 'status', 'stall_reason', 'loss_reason', 'notes',
  ]

  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  // Auto-set closed_at when status changes to won or lost
  if ((body.status === 'won' || body.status === 'lost') && !body.closed_at) {
    updates.closed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('deals')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
