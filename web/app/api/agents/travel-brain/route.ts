import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'

/**
 * GET /api/agents/travel-brain
 * Travel Brain Agent — orchestrates the full travel experience.
 * Detects active/upcoming trips and generates a travel-aware context package.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)

  // Find active or upcoming trips (next 7 days)
  const sevenDaysLater = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)

  const { data: trips } = await admin
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active', 'upcoming'])
    .lte('start_date', sevenDaysLater)
    .order('start_date', { ascending: true })
    .limit(3)

  if (!trips || trips.length === 0) {
    return NextResponse.json({ active_trip: null, upcoming_trips: [], message: 'No active or upcoming trips' })
  }

  const results = []

  for (const trip of trips) {
    // Gather trip context in parallel
    const [expensesRes, eventsRes, contactsRes, commitmentsRes] = await Promise.all([
      // Trip expenses
      admin
        .from('trip_expenses')
        .select('category, amount, currency, merchant_name')
        .eq('trip_id', trip.id)
        .eq('user_id', user.id),

      // Calendar events during trip dates
      admin
        .from('calendar_events')
        .select('title, start_time, end_time, location, attendees, meeting_link')
        .eq('user_id', user.id)
        .gte('start_time', `${trip.start_date}T00:00:00`)
        .lte('start_time', `${trip.end_date}T23:59:59`)
        .order('start_time', { ascending: true }),

      // Contacts in destination city (by company location or timezone)
      admin
        .from('contacts')
        .select('email, name, company, relationship, importance')
        .eq('user_id', user.id)
        .in('importance', ['vip', 'high'])
        .limit(20),

      // Open commitments
      admin
        .from('commitments')
        .select('contact_email, contact_name, title, type, deadline')
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress', 'overdue'])
        .lte('deadline', trip.end_date)
        .order('deadline', { ascending: true })
        .limit(10),
    ])

    // Calculate expense totals
    const expenses = expensesRes.data || []
    const totalExpense = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    const expenseByCategory: Record<string, number> = {}
    for (const e of expenses) {
      expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + (e.amount || 0)
    }

    const isActive = trip.status === 'active'
    const daysUntilTrip = isActive ? 0 : Math.ceil((new Date(trip.start_date).getTime() - now.getTime()) / 86400000)

    results.push({
      trip: {
        id: trip.id,
        title: trip.title,
        destination: `${trip.destination_city || ''}${trip.destination_country ? ', ' + trip.destination_country : ''}`,
        dates: `${trip.start_date} → ${trip.end_date}`,
        status: trip.status,
        days_until: daysUntilTrip,
        flight_info: trip.flight_info || [],
        hotel_info: trip.hotel_info || [],
      },
      meetings_during_trip: (eventsRes.data || []).length,
      meetings: (eventsRes.data || []).slice(0, 5).map((e: any) => ({
        title: e.title,
        time: e.start_time,
        location: e.location,
        has_link: !!e.meeting_link,
      })),
      expenses: {
        total: totalExpense,
        currency: expenses[0]?.currency || 'SGD',
        by_category: expenseByCategory,
      },
      open_commitments: (commitmentsRes.data || []).map((f: any) => ({
        contact: f.contact_name || f.contact_email,
        title: f.title,
        type: f.type,
        deadline: f.deadline,
      })),
      vip_contacts_count: (contactsRes.data || []).length,
    })
  }

  // Generate AI travel brief for active trip
  let travelBrief = ''
  const activeTrip = results.find(r => r.trip.status === 'active')
  if (activeTrip) {
    try {
      const { client, model } = await createUserAIClient(user.id)
      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `You are Travel Brain, an AI travel assistant. Generate a concise travel status update (3-5 sentences).
Include: today's schedule, pending follow-ups to handle, expense status, any logistics reminders.
Be practical and actionable. Detect language from trip title.`,
          },
          { role: 'user', content: JSON.stringify(activeTrip) },
        ],
        temperature: 0.3,
        max_tokens: 250,
      })
      travelBrief = completion.choices[0]?.message?.content?.trim() || ''
    } catch {
      // Non-critical
    }
  }

  return NextResponse.json({
    active_trip: results.find(r => r.trip.status === 'active') || null,
    upcoming_trips: results.filter(r => r.trip.status === 'upcoming'),
    travel_brief: travelBrief,
  })
}
