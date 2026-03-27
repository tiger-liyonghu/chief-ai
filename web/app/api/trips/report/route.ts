import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { TRIP_REPORT_SYSTEM, buildTripReportPrompt } from '@/lib/ai/prompts/landing-briefing'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { trip_id } = await request.json()
    if (!trip_id) {
      return NextResponse.json({ error: 'trip_id is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Fetch trip details
    const { data: trip, error: tripError } = await admin
      .from('trips')
      .select('*')
      .eq('id', trip_id)
      .eq('user_id', user.id)
      .single()

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    const tripStart = trip.start_date
    const tripEnd = trip.end_date
    const tripStartTime = tripStart + 'T00:00:00.000Z'
    const tripEndTime = tripEnd + 'T23:59:59.999Z'

    // Fetch meetings during the trip
    const { data: meetings } = await admin
      .from('calendar_events')
      .select('id, title, start_time, end_time, location, meeting_link, attendees')
      .eq('user_id', user.id)
      .gte('start_time', tripStartTime)
      .lte('start_time', tripEndTime)
      .order('start_time', { ascending: true })

    // Fetch tasks created during the trip
    const { data: tasks } = await admin
      .from('tasks')
      .select('id, title, priority, status, due_date, created_at')
      .eq('user_id', user.id)
      .gte('created_at', tripStartTime)
      .lte('created_at', tripEndTime)
      .order('priority', { ascending: true })

    // Fetch follow-ups created during the trip
    const { data: followUps } = await admin
      .from('follow_ups')
      .select('id, contact_name, contact_email, subject, type, due_date, created_at')
      .eq('user_id', user.id)
      .gte('created_at', tripStartTime)
      .lte('created_at', tripEndTime)
      .order('due_date', { ascending: true })

    // Fetch expenses for this trip
    const { data: expenses } = await admin
      .from('trip_expenses')
      .select('id, category, merchant_name, amount, currency, expense_date, status')
      .eq('trip_id', trip_id)
      .order('expense_date', { ascending: true })

    // Fetch key emails during the trip
    const { data: emailsDuringTrip } = await admin
      .from('emails')
      .select('id, from_name, from_address, subject, snippet, received_at, is_reply_needed')
      .eq('user_id', user.id)
      .gte('received_at', tripStartTime)
      .lte('received_at', tripEndTime)
      .order('received_at', { ascending: false })
      .limit(30)

    // Build prompt context
    const promptContext = buildTripReportPrompt({
      destination_city: trip.destination_city,
      destination_country: trip.destination_country,
      trip_start: tripStart,
      trip_end: tripEnd,
      meetings: (meetings || []).map(m => ({
        title: m.title,
        start_time: m.start_time,
        end_time: m.end_time,
        attendees: m.attendees,
        location: m.location,
      })),
      tasks: (tasks || []).map(t => ({
        title: t.title,
        priority: t.priority,
        status: t.status,
        due_date: t.due_date,
      })),
      followUps: (followUps || []).map(f => ({
        contact_name: f.contact_name,
        contact_email: f.contact_email,
        subject: f.subject,
        type: f.type,
        due_date: f.due_date,
      })),
      expenses: (expenses || []).map(e => ({
        category: e.category,
        merchant_name: e.merchant_name,
        amount: parseFloat(e.amount),
        currency: e.currency,
      })),
      emailsDuringTrip: (emailsDuringTrip || []).map(e => ({
        from_name: e.from_name,
        from_address: e.from_address,
        subject: e.subject,
        snippet: e.snippet,
      })),
    })

    // Generate report with user's configured LLM
    const { client, model } = await createUserAIClient(user.id)
    const aiResponse = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: TRIP_REPORT_SYSTEM },
        {
          role: 'user',
          content: `Generate a structured post-trip report in JSON format with these fields:
- executive_summary: string (3-5 sentences)
- meetings_attended: array of { title, date, outcome } (infer outcomes from context)
- action_items: array of { title, assignee, due_date }
- expense_summary: { total, currency, by_category: Record<string, number> }
- follow_ups_needed: array of { contact, subject, due_date }
- key_decisions: array of strings (infer from meetings and emails context)

Context:
${promptContext}

Respond ONLY with valid JSON.`,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const content = aiResponse.choices[0]?.message?.content
    let report: any = {}

    if (content) {
      try {
        report = JSON.parse(content)
      } catch {
        report = { executive_summary: content }
      }
    }

    // Compute expense totals from actual data
    const expenseTotal = (expenses || []).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)
    const expenseCurrency = expenses?.[0]?.currency || 'SGD'
    const expenseByCategory: Record<string, number> = {}
    for (const e of (expenses || [])) {
      expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + parseFloat(e.amount || 0)
    }

    return NextResponse.json({
      trip: {
        id: trip.id,
        title: trip.title,
        destination_city: trip.destination_city,
        destination_country: trip.destination_country,
        start_date: tripStart,
        end_date: tripEnd,
      },
      report: {
        executive_summary: report.executive_summary || 'No summary available.',
        meetings_attended: report.meetings_attended || (meetings || []).map((m: any) => ({
          title: m.title,
          date: new Date(m.start_time).toLocaleDateString(),
          outcome: 'No notes available',
        })),
        action_items: report.action_items || (tasks || []).map((t: any) => ({
          title: t.title,
          assignee: 'You',
          due_date: t.due_date,
        })),
        expense_summary: {
          total: expenseTotal,
          currency: expenseCurrency,
          by_category: expenseByCategory,
          items: (expenses || []).map(e => ({
            category: e.category,
            merchant: e.merchant_name,
            amount: parseFloat(e.amount),
            currency: e.currency,
            date: e.expense_date,
          })),
        },
        follow_ups_needed: report.follow_ups_needed || (followUps || []).map((f: any) => ({
          contact: f.contact_name || f.contact_email,
          subject: f.subject,
          due_date: f.due_date,
        })),
        key_decisions: report.key_decisions || [],
      },
      stats: {
        meetings_count: meetings?.length || 0,
        tasks_created: tasks?.length || 0,
        follow_ups_count: followUps?.length || 0,
        emails_received: emailsDuringTrip?.length || 0,
        total_expenses: expenseTotal,
        expense_currency: expenseCurrency,
      },
    })
  } catch (error: any) {
    console.error('Trip report error:', error)
    return NextResponse.json({ error: error.message || 'Report generation failed' }, { status: 500 })
  }
}
