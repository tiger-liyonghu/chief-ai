import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const status = searchParams.get('status')

  let query = supabase
    .from('organizations')
    .select('*')
    .eq('user_id', user.id)

  if (q) {
    query = query.or(`name.ilike.%${q}%,alias.ilike.%${q}%,industry.ilike.%${q}%`)
  }

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

  // Dedup: skip if organization with same name already exists for this user
  const { data: existing } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('user_id', user.id)
    .ilike('name', body.name.trim())
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'Organization already exists', duplicate: true, existing: existing[0] },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .from('organizations')
    .insert({
      user_id: user.id,
      name: body.name.trim(),
      alias: body.alias,
      industry: body.industry,
      size: body.size,
      hq_city: body.hq_city,
      hq_country: body.hq_country,
      website: body.website,
      status: body.status || 'active',
      annual_revenue: body.annual_revenue,
      employee_count: body.employee_count,
      key_products: body.key_products,
      recent_news: body.recent_news,
      stock_ticker: body.stock_ticker,
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
    'name', 'alias', 'industry', 'size', 'hq_city', 'hq_country',
    'website', 'status', 'annual_revenue', 'employee_count',
    'key_products', 'recent_news', 'news_updated_at', 'stock_ticker', 'notes',
  ]

  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
