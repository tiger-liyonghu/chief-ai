import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const tripId = new URL(request.url).searchParams.get('trip_id')
  if (!tripId) return NextResponse.json({ error: 'trip_id required' }, { status: 400 })

  // Get trip destination
  const { data: trip } = await admin
    .from('trips')
    .select('destination_city, destination_country')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .single()

  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  // Find contacts with company/notes matching the destination
  // Simple heuristic: search company field for city/country name
  const city = trip.destination_city || ''
  const country = trip.destination_country || ''

  const { data: contacts } = await admin
    .from('contacts')
    .select('id, name, email, company, importance, last_contact_at')
    .eq('user_id', user.id)
    .or(`company.ilike.%${city}%,company.ilike.%${country}%,notes.ilike.%${city}%`)
    .limit(10)

  const enriched = (contacts || []).map(c => {
    const daysSince = c.last_contact_at
      ? Math.floor((Date.now() - new Date(c.last_contact_at).getTime()) / 86400000)
      : null
    return { ...c, days_since_contact: daysSince }
  })

  return NextResponse.json({
    trip_destination: `${city}, ${country}`,
    contacts: enriched,
    total: enriched.length,
  })
}
