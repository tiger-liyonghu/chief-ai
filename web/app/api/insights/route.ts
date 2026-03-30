import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch existing insights snapshots
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const periodType = searchParams.get('period') || 'weekly'
  const limit = parseInt(searchParams.get('limit') || '12')

  const { data, error } = await supabase
    .from('insights_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .eq('period_type', periodType)
    .order('period_start', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}

// POST: Generate a new insights snapshot
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const periodType = body.period || 'weekly'

  // Calculate period dates
  const now = new Date()
  let periodStart: Date
  let periodEnd: Date

  if (periodType === 'weekly') {
    periodEnd = new Date(now)
    periodStart = new Date(now)
    periodStart.setDate(periodStart.getDate() - 7)
  } else {
    periodEnd = new Date(now)
    periodStart = new Date(now)
    periodStart.setMonth(periodStart.getMonth() - 1)
  }

  const startStr = periodStart.toISOString().split('T')[0]
  const endStr = periodEnd.toISOString().split('T')[0]

  // Gather commitment stats
  const { data: commitments } = await supabase
    .from('commitments')
    .select('id, type, status, deadline, completed_at, created_at')
    .eq('user_id', user.id)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())

  const allC = commitments || []
  const completed = allC.filter(c => c.status === 'done')
  const overdue = allC.filter(c => c.status === 'overdue')
  const familyAll = allC.filter(c => c.type === 'family')
  const familyDone = familyAll.filter(c => c.status === 'done')

  const commitmentStats = {
    total: allC.length,
    completed: completed.length,
    overdue: overdue.length,
    pending: allC.filter(c => c.status === 'pending').length,
    compliance_rate: (completed.length + overdue.length) > 0
      ? Math.round((completed.length / (completed.length + overdue.length)) * 100) : 100,
    family_total: familyAll.length,
    family_completed: familyDone.length,
    family_compliance_rate: familyAll.length > 0
      ? Math.round((familyDone.length / familyAll.length) * 100) : 100,
  }

  // Gather relationship stats
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, company, importance, last_contact_at, email_count')
    .eq('user_id', user.id)
    .order('last_contact_at', { ascending: false })

  const allContacts = contacts || []
  const activeContacts = allContacts.filter(c =>
    c.last_contact_at && new Date(c.last_contact_at) >= periodStart
  )
  const coldVips = allContacts
    .filter(c => c.importance === 'vip' && c.last_contact_at)
    .filter(c => {
      const daysSince = Math.floor((now.getTime() - new Date(c.last_contact_at!).getTime()) / 86400000)
      return daysSince > 90
    })
    .map(c => ({
      name: c.name,
      company: c.company,
      days_since: Math.floor((now.getTime() - new Date(c.last_contact_at!).getTime()) / 86400000)
    }))

  const relationshipStats = {
    active_contacts: activeContacts.length,
    total_contacts: allContacts.length,
    cold_vips: coldVips,
  }

  // Gather travel stats
  const { data: trips } = await supabase
    .from('trips')
    .select('id, destination_city, start_date, end_date, total_expense')
    .eq('user_id', user.id)
    .gte('start_date', startStr)
    .lte('start_date', endStr)

  const allTrips = trips || []
  const totalDays = allTrips.reduce((sum, t) => {
    const days = Math.ceil((new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / 86400000)
    return sum + days
  }, 0)

  const travelStats = {
    trips_count: allTrips.length,
    total_days: totalDays,
    total_expense: allTrips.reduce((sum, t) => sum + (Number(t.total_expense) || 0), 0),
    cities: allTrips.map(t => t.destination_city).filter(Boolean),
  }

  // Gather family stats
  const { data: familyEvents } = await supabase
    .from('family_calendar')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .lte('start_date', endStr)
    .or(`end_date.gte.${startStr},end_date.is.null`)

  const familyStats = {
    events_in_period: (familyEvents || []).length,
    conflicts_detected: 0, // TODO: compute from trip overlaps
    family_commitments_kept: familyDone.length,
    family_commitments_total: familyAll.length,
  }

  // Upsert snapshot
  const { data: snapshot, error } = await supabase
    .from('insights_snapshots')
    .upsert({
      user_id: user.id,
      period_type: periodType,
      period_start: startStr,
      period_end: endStr,
      commitment_stats: commitmentStats,
      relationship_stats: relationshipStats,
      travel_stats: travelStats,
      family_stats: familyStats,
    }, {
      onConflict: 'user_id,period_type,period_start'
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(snapshot)
}
