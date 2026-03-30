import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { TRIP_DETECTION_SYSTEM, TRIP_DETECTION_USER } from '@/lib/ai/prompts/trip-detection'

interface TravelDetection {
  is_travel: boolean
  trip_type: 'flight' | 'hotel' | 'transport' | 'other'
  destination_city: string | null
  destination_country: string | null
  start_date: string | null
  end_date: string | null
  flight_info: any | null
  hotel_info: any | null
  amount: number | null
  currency: string | null
  merchant_name: string | null
}

interface DetectedBooking extends TravelDetection {
  email_id: string
  email_subject: string
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Fetch emails from the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: emails, error: emailError } = await admin
      .from('emails')
      .select('id, subject, from_address, from_name, snippet, received_at')
      .eq('user_id', user.id)
      .gte('received_at', thirtyDaysAgo.toISOString())
      .order('received_at', { ascending: false })

    if (emailError) {
      return NextResponse.json({ error: emailError.message }, { status: 500 })
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json({ trips_found: 0, expenses_found: 0 })
    }

    // Analyze each email for travel content
    const detectedBookings: DetectedBooking[] = []

    const { client, model } = await createUserAIClient(user.id)
    for (const email of emails) {
      try {
        const aiResponse = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: TRIP_DETECTION_SYSTEM },
            {
              role: 'user',
              content: TRIP_DETECTION_USER({
                from: `${email.from_name || ''} <${email.from_address}>`,
                subject: email.subject || '',
                body: email.snippet || '',
                date: email.received_at || '',
              }),
            },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        })

        const content = aiResponse.choices[0]?.message?.content
        if (!content) continue

        const parsed: TravelDetection = JSON.parse(content)
        if (parsed.is_travel && parsed.start_date) {
          detectedBookings.push({
            ...parsed,
            email_id: email.id,
            email_subject: email.subject || '',
          })
        }
      } catch (aiErr) {
        console.error('Trip detection AI failed for email:', email.id, aiErr)
      }
    }

    if (detectedBookings.length === 0) {
      return NextResponse.json({ trips_found: 0, expenses_found: 0 })
    }

    // Group bookings by destination + overlapping date range into trips
    const tripGroups = groupBookingsIntoTrips(detectedBookings)

    let tripsCreated = 0
    let expensesCreated = 0

    for (const group of tripGroups) {
      const primaryBooking = group[0]
      const city = group.find(b => b.destination_city)?.destination_city || null
      const country = group.find(b => b.destination_country)?.destination_country || null

      // Calculate date range across all bookings in the group
      const startDates = group.map(b => b.start_date!).sort()
      const endDates = group.map(b => b.end_date || b.start_date!).sort()
      const startDate = startDates[0]
      const endDate = endDates[endDates.length - 1]

      // Collect flight and hotel info
      const flightInfos = group.filter(b => b.flight_info).map(b => b.flight_info)
      const hotelInfos = group.filter(b => b.hotel_info).map(b => b.hotel_info)
      const sourceEmailIds = group.map(b => b.email_id)

      const title = city
        ? `Trip to ${city}`
        : `Travel - ${primaryBooking.email_subject.slice(0, 50)}`

      // Determine status
      const now = new Date()
      const start = new Date(startDate)
      const end = new Date(endDate)
      let status: 'upcoming' | 'active' | 'completed' = 'upcoming'
      if (now > end) status = 'completed'
      else if (now >= start && now <= end) status = 'active'

      // Check for existing trip with same destination and overlapping dates
      const { data: existingTrips } = await admin
        .from('trips')
        .select('id')
        .eq('user_id', user.id)
        .eq('destination_city', city || '')
        .lte('start_date', endDate)
        .gte('end_date', startDate)

      let tripId: string

      if (existingTrips && existingTrips.length > 0) {
        // Update existing trip
        tripId = existingTrips[0].id
        await admin.from('trips').update({
          flight_info: flightInfos,
          hotel_info: hotelInfos,
          source_email_ids: sourceEmailIds,
          status,
          updated_at: new Date().toISOString(),
        }).eq('id', tripId)
      } else {
        // Detect family conflicts for the new trip
        let familyConflicts: Array<{ title: string; date: string; family_member?: string; conflict_type: string }> | null = null
        try {
          const { data: familyEvents } = await admin
            .from('family_calendar')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
          if (familyEvents && familyEvents.length > 0) {
            const conflicts: Array<{ title: string; date: string; family_member?: string; conflict_type: string }> = []
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              const dateStr = d.toISOString().split('T')[0]
              const dayOfWeek = d.getDay()
              for (const fe of familyEvents) {
                let isConflict = false
                let conflictType = ''
                if (fe.recurrence === 'weekly' && fe.recurrence_day === dayOfWeek) { isConflict = true; conflictType = 'weekly_conflict' }
                if (fe.recurrence === 'none' && fe.start_date <= dateStr && (!fe.end_date || fe.end_date >= dateStr)) { isConflict = true; conflictType = fe.event_type }
                if (fe.recurrence === 'yearly') {
                  const feDate = new Date(fe.start_date)
                  if (d.getMonth() === feDate.getMonth() && d.getDate() === feDate.getDate()) { isConflict = true; conflictType = 'important_date' }
                }
                if (isConflict && !conflicts.some(c => c.title === fe.title && c.date === dateStr)) {
                  conflicts.push({ title: fe.title, date: dateStr, family_member: fe.family_member || undefined, conflict_type: conflictType })
                }
              }
            }
            if (conflicts.length > 0) familyConflicts = conflicts
          }
        } catch { /* non-fatal */ }

        // Create new trip
        const { data: newTrip, error: tripError } = await admin
          .from('trips')
          .insert({
            user_id: user.id,
            title,
            destination_city: city,
            destination_country: country,
            start_date: startDate,
            end_date: endDate,
            status,
            flight_info: flightInfos,
            hotel_info: hotelInfos,
            source_email_ids: sourceEmailIds,
            family_conflicts: familyConflicts,
          })
          .select('id')
          .single()

        if (tripError) {
          console.error('Failed to create trip:', tripError)
          continue
        }

        tripId = newTrip.id
        tripsCreated++
      }

      // Create expenses for detected amounts
      for (const booking of group) {
        if (booking.amount && booking.amount > 0) {
          // Check for duplicate expense
          const { data: existingExpense } = await admin
            .from('trip_expenses')
            .select('id')
            .eq('user_id', user.id)
            .eq('source_email_id', booking.email_id)

          if (existingExpense && existingExpense.length > 0) continue

          const category = booking.trip_type === 'flight' ? 'flight'
            : booking.trip_type === 'hotel' ? 'hotel'
            : booking.trip_type === 'transport' ? 'transport'
            : 'other'

          await admin.from('trip_expenses').insert({
            user_id: user.id,
            trip_id: tripId,
            category,
            merchant_name: booking.merchant_name || null,
            amount: booking.amount,
            currency: booking.currency || 'SGD',
            expense_date: booking.start_date!,
            source_email_id: booking.email_id,
            status: 'pending',
          })

          expensesCreated++
        }
      }
    }

    return NextResponse.json({
      trips_found: tripsCreated,
      expenses_found: expensesCreated,
      bookings_detected: detectedBookings.length,
    })
  } catch (error: any) {
    console.error('Trip detection error:', error)
    return NextResponse.json({ error: error.message || 'Detection failed' }, { status: 500 })
  }
}

/**
 * Group bookings into trips by matching destination + overlapping or adjacent dates.
 * Bookings to the same city within 2 days of each other are grouped together.
 */
function groupBookingsIntoTrips(bookings: DetectedBooking[]): DetectedBooking[][] {
  const sorted = [...bookings].sort((a, b) =>
    (a.start_date || '').localeCompare(b.start_date || '')
  )

  const groups: DetectedBooking[][] = []
  const used = new Set<number>()

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue

    const group: DetectedBooking[] = [sorted[i]]
    used.add(i)

    const groupCity = sorted[i].destination_city?.toLowerCase()
    const groupEnd = new Date(sorted[i].end_date || sorted[i].start_date!)

    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(j)) continue

      const candidate = sorted[j]
      const candidateCity = candidate.destination_city?.toLowerCase()
      const candidateStart = new Date(candidate.start_date!)

      // Same city (or either is null) and within 2 days of group end
      const cityMatch = !groupCity || !candidateCity || groupCity === candidateCity
      const daysDiff = (candidateStart.getTime() - groupEnd.getTime()) / (1000 * 60 * 60 * 24)

      if (cityMatch && daysDiff <= 2) {
        group.push(candidate)
        used.add(j)
        // Extend group end date
        const candidateEnd = new Date(candidate.end_date || candidate.start_date!)
        if (candidateEnd > groupEnd) {
          groupEnd.setTime(candidateEnd.getTime())
        }
      }
    }

    groups.push(group)
  }

  return groups
}
