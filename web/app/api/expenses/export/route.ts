import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { trip_id, format } = body

  if (format !== 'csv') {
    return NextResponse.json({ error: 'Only CSV format is supported' }, { status: 400 })
  }

  // Fetch expenses with trip info
  let query = supabase
    .from('trip_expenses')
    .select('*, trip:trips(id, destination)')
    .eq('user_id', user.id)
    .order('expense_date', { ascending: true })

  if (trip_id) query = query.eq('trip_id', trip_id)

  const { data: expenses, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!expenses || expenses.length === 0) {
    return NextResponse.json({ error: 'No expenses to export' }, { status: 404 })
  }

  // Build CSV
  const headers = ['Date', 'Category', 'Merchant', 'Amount', 'Currency', 'Amount (Base)', 'Base Currency', 'Trip', 'Notes', 'Status']
  const rows = expenses.map((e: any) => {
    const tripName = e.trip?.destination || ''
    return [
      e.expense_date,
      e.category,
      csvEscape(e.merchant_name),
      e.amount,
      e.currency,
      e.amount_base,
      e.base_currency,
      csvEscape(tripName),
      csvEscape(e.notes || ''),
      e.status,
    ].join(',')
  })

  const csv = [headers.join(','), ...rows].join('\n')

  // Mark exported expenses as 'exported'
  const expenseIds = expenses.map((e: any) => e.id)
  await supabase
    .from('trip_expenses')
    .update({ status: 'exported' })
    .in('id', expenseIds)
    .eq('user_id', user.id)

  const filename = trip_id
    ? `expenses-trip-${trip_id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`
    : `expenses-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
