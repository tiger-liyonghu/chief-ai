import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const tripId = searchParams.get('trip_id')
  const status = searchParams.get('status')

  let query = supabase
    .from('trip_expenses')
    .select('*, trip:trips(id, destination)')
    .eq('user_id', user.id)
    .order('expense_date', { ascending: false })

  if (tripId) query = query.eq('trip_id', tripId)
  if (status) query = query.eq('status', status)

  const { data: expenses, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(expenses || [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { trip_id, category, merchant_name, amount, currency, expense_date, notes } = body

  if (!category || !merchant_name || !amount || !currency || !expense_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: expense, error } = await supabase
    .from('trip_expenses')
    .insert({
      user_id: user.id,
      trip_id: trip_id || null,
      category,
      merchant_name,
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      amount_base: parseFloat(amount), // Same as amount for now; exchange rate conversion can be added later
      base_currency: currency.toUpperCase(),
      expense_date,
      notes: notes || null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(expense)
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status } = await request.json()

  if (!id || !status) {
    return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })
  }

  if (!['pending', 'approved', 'exported'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { error } = await supabase
    .from('trip_expenses')
    .update({ status })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
