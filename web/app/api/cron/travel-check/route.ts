import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { shouldNotify } from '@/lib/scheduler/should-notify'
import { wasNotificationSent, markNotificationSent } from '@/lib/whatsapp/notification-log'
import { getBestContactWindow } from '@/lib/travel/timezone'

/**
 * GET /api/cron/travel-check
 *
 * Daily travel lifecycle check. Runs once per morning.
 *
 * Three jobs:
 * 1. Landing briefing — trip starts today → push briefing
 * 2. Contact activation — destination has clients → include in briefing
 * 3. Trip closure — trip ended → auto debrief + mark completed
 *
 * Manifesto: "差旅不乱 — 效率"
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const todayISO = new Date().toISOString().slice(0, 10)
  const yesterdayISO = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  const { data: users } = await admin
    .from('profiles')
    .select('id')
    .not('onboarding_completed_at', 'is', null)
    .limit(100)

  if (!users || users.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  const results: Array<{ userId: string; landingBriefings: number; closedTrips: number }> = []

  for (const user of users) {
    let landingBriefings = 0
    let closedTrips = 0

    try {
      // ─── 1. Landing Briefings (trip starts today or started yesterday) ───

      const { data: startingTrips } = await admin
        .from('trips')
        .select('id, title, destination_city, destination_country, start_date, end_date, cities')
        .eq('user_id', user.id)
        .in('status', ['planned', 'confirmed', 'active'])
        .lte('start_date', todayISO)
        .gte('end_date', todayISO)

      for (const trip of startingTrips || []) {
        const dedupKey = `landing_${trip.id}`
        if (await wasNotificationSent(user.id, 'trip_briefing', dedupKey, todayISO)) continue

        const decision = await shouldNotify(admin, user.id, 'high', 'trip_briefing')
        if (!decision.allowed) continue

        // Get destination city (from destination_city or first city in cities array)
        const city = trip.destination_city || (Array.isArray(trip.cities) ? trip.cities[0] : null)

        // Get contacts in destination city
        const localContacts = city ? await getContactsInCity(admin, user.id, city) : []

        // Get commitments due during trip
        const { data: tripCommitments } = await admin
          .from('commitments')
          .select('title, contact_name, deadline, type')
          .eq('user_id', user.id)
          .in('status', ['pending', 'in_progress', 'overdue'])
          .lte('deadline', trip.end_date)
          .order('deadline')
          .limit(10)

        // Push landing briefing
        const pushed = await pushLandingBriefing(user.id, {
          trip,
          city: city || trip.title,
          localContacts,
          commitments: tripCommitments || [],
        })

        if (pushed) {
          // Update trip status to active
          await admin.from('trips').update({ status: 'active' }).eq('id', trip.id)
          await markNotificationSent(user.id, 'trip_briefing', dedupKey, todayISO)
          landingBriefings++
        }
      }

      // ─── 2. Trip Closure (trip ended yesterday or before, still active) ───

      const { data: endedTrips } = await admin
        .from('trips')
        .select('id, title, start_date, end_date')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .lt('end_date', todayISO)

      for (const trip of endedTrips || []) {
        // Mark completed
        await admin.from('trips').update({ status: 'completed' }).eq('id', trip.id)

        // Auto debrief (non-blocking)
        const dedupKey = `debrief_${trip.id}`
        if (await wasNotificationSent(user.id, 'trip_debrief', dedupKey, todayISO)) continue

        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          await fetch(`${baseUrl}/api/agents/debrief`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-cron-user-id': user.id,
              'Authorization': `Bearer ${process.env.CRON_SECRET}`,
            },
            body: JSON.stringify({
              period: 'custom',
              start_date: trip.start_date,
              end_date: trip.end_date,
            }),
          })
        } catch {
          // Non-fatal: debrief failure shouldn't block trip closure
        }

        await markNotificationSent(user.id, 'trip_debrief', dedupKey, todayISO)
        closedTrips++
      }
    } catch (err) {
      console.error(`[Travel Check] Error for user ${user.id}:`, err)
    }

    results.push({ userId: user.id.substring(0, 8), landingBriefings, closedTrips })
  }

  return NextResponse.json({
    processed: users.length,
    results,
  })
}

// ─── Helpers ───

async function getContactsInCity(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  city: string,
): Promise<Array<{ name: string; email: string; daysSince: number; importance: string }>> {
  const { data } = await admin
    .from('contacts')
    .select('name, email, importance, last_contact_at')
    .eq('user_id', userId)
    .ilike('city', `%${city}%`)
    .in('importance', ['vip', 'high', 'normal'])
    .limit(10)

  if (!data) return []

  return data
    .map(c => ({
      name: c.name || c.email,
      email: c.email,
      daysSince: c.last_contact_at
        ? Math.ceil((Date.now() - new Date(c.last_contact_at).getTime()) / 86400000)
        : 999,
      importance: c.importance,
    }))
    .sort((a, b) => b.daysSince - a.daysSince) // longest no-contact first
}

async function pushLandingBriefing(
  userId: string,
  data: {
    trip: any
    city: string
    localContacts: Array<{ name: string; daysSince: number; importance: string }>
    commitments: Array<{ title: string; contact_name: string; deadline: string; type: string }>
  },
): Promise<boolean> {
  try {
    const { getConnection } = await import('@/lib/whatsapp/client')
    const sock = getConnection(userId)
    if (!sock?.user) return false

    const myNumber = sock.user.id.split(':')[0]
    const myLid = sock.user.lid?.split(':')[0]
    const selfJid = myLid ? `${myLid}@lid` : `${myNumber}@s.whatsapp.net`

    const lines: string[] = [
      `✈️ Landing Briefing: ${data.city}`,
      `${data.trip.title} (${data.trip.start_date} → ${data.trip.end_date})`,
      '',
    ]

    // Local contacts
    if (data.localContacts.length > 0) {
      lines.push(`👥 Contacts in ${data.city}:`)
      for (const c of data.localContacts.slice(0, 5)) {
        const badge = c.importance === 'vip' ? '⭐ ' : ''
        lines.push(`  ${badge}${c.name} — ${c.daysSince}d no contact`)
      }
      lines.push('')
    }

    // Commitments due during trip
    if (data.commitments.length > 0) {
      lines.push('📋 Due during this trip:')
      for (const c of data.commitments.slice(0, 5)) {
        const icon = c.type === 'i_promised' ? '🔴' : '🟡'
        lines.push(`  ${icon} ${c.title}${c.contact_name ? ` (${c.contact_name})` : ''} → ${c.deadline}`)
      }
      lines.push('')
    }

    // Timezone recommendation (if destination differs from Singapore)
    const homeCity = 'Singapore' // TODO: read from user profile
    if (data.city !== homeCity) {
      const window = getBestContactWindow(data.city, homeCity)
      if (window) {
        lines.push(`🕐 ${window.recommendation}`)
        lines.push('')
      }
    }

    lines.push('━━━')
    lines.push('Reply: prep [name] | reconnect [name]')

    await sock.sendMessage(selfJid, { text: lines.join('\n') })
    return true
  } catch {
    return false
  }
}
