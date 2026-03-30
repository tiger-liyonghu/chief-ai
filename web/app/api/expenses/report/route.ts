import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createUserAIClient } from '@/lib/ai/unified-client'

/**
 * GET /api/expenses/report
 * Generate an AI expense analysis report covering:
 * - Total spending by category
 * - Per-trip breakdown
 * - Spending trends
 * - Anomalies (unusually large expenses)
 * - Actionable insights
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch all expenses with trip info
  const { data: expenses, error } = await supabase
    .from('trip_expenses')
    .select('*, trip:trips(id, title, destination_city, destination_country, start_date, end_date)')
    .eq('user_id', user.id)
    .order('expense_date', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!expenses || expenses.length === 0) {
    return NextResponse.json({ error: 'No expenses to analyze' }, { status: 404 })
  }

  // Compute summary stats for the AI
  const byCategory: Record<string, { total: number; count: number }> = {}
  const byTrip: Record<string, { trip: any; total: number; count: number }> = {}
  const byCurrency: Record<string, number> = {}
  let grandTotal = 0

  for (const e of expenses) {
    const cat = e.category || 'other'
    if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 }
    byCategory[cat].total += parseFloat(e.amount || 0)
    byCategory[cat].count++

    const tripKey = e.trip_id || 'unassigned'
    if (!byTrip[tripKey]) byTrip[tripKey] = { trip: e.trip, total: 0, count: 0 }
    byTrip[tripKey].total += parseFloat(e.amount || 0)
    byTrip[tripKey].count++

    byCurrency[e.currency || 'SGD'] = (byCurrency[e.currency || 'SGD'] || 0) + parseFloat(e.amount || 0)
    grandTotal += parseFloat(e.amount_base || e.amount || 0)
  }

  const baseCurrency = expenses.find(e => e.base_currency)?.base_currency || 'SGD'

  // Find top 3 largest individual expenses
  const sorted = [...expenses].sort((a, b) => parseFloat(b.amount || 0) - parseFloat(a.amount || 0))
  const topExpenses = sorted.slice(0, 3).map(e => ({
    merchant: e.merchant_name,
    amount: `${e.currency} ${parseFloat(e.amount).toLocaleString()}`,
    category: e.category,
    date: e.expense_date,
    trip: e.trip?.destination_city || 'unassigned',
  }))

  const { client, model } = await createUserAIClient(user.id)

  const stream = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `You are a financial analyst for a busy executive. Generate a concise expense report with:
1. Executive summary (2-3 sentences)
2. Breakdown by category (with % of total)
3. Per-trip analysis (cost per day, biggest category per trip)
4. Key observations (any anomalies, trends, or cost-saving opportunities)
5. Recommendations

Be direct and data-driven. Use the user's language (detect from trip/merchant names). Format with clear headers.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          total_expenses: expenses.length,
          grand_total: `${baseCurrency} ${grandTotal.toLocaleString()}`,
          by_category: byCategory,
          by_trip: Object.values(byTrip).map(t => ({
            destination: t.trip?.destination_city || 'Unassigned',
            dates: t.trip ? `${t.trip.start_date} to ${t.trip.end_date}` : null,
            total: t.total,
            count: t.count,
          })),
          by_currency: byCurrency,
          top_expenses: topExpenses,
          date_range: `${expenses[expenses.length - 1].expense_date} to ${expenses[0].expense_date}`,
        }),
      },
    ],
    stream: true,
    temperature: 0.4,
    max_tokens: 1000,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || ''
        if (text) controller.enqueue(encoder.encode(text))
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
