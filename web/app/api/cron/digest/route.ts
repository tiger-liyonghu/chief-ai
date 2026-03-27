import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDigestForUser } from '@/lib/digest/send-digest'

/**
 * Vercel Cron calls this every hour.
 * It checks which users have digest enabled and if it's their scheduled time,
 * then sends the digest directly (no user session required).
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const currentHour = now.getUTCHours()

  // Find users with digest enabled
  const { data: users, error } = await admin
    .from('profiles')
    .select('id, email, timezone, daily_brief_time')
    .eq('daily_brief_enabled', true)

  if (error || !users) {
    return NextResponse.json({ error: 'Failed to fetch users', detail: error?.message }, { status: 500 })
  }

  let sent = 0
  const errors: string[] = []

  for (const user of users) {
    try {
      // Convert user's scheduled time to UTC and check if it matches now
      const [scheduledHour] = (user.daily_brief_time || '08:00').split(':').map(Number)

      // Get the UTC offset for the user's timezone
      const userNow = new Date(now.toLocaleString('en-US', { timeZone: user.timezone || 'Asia/Singapore' }))
      const offsetMs = userNow.getTime() - now.getTime()
      const offsetHours = Math.round(offsetMs / 3600000)

      const scheduledUtcHour = (scheduledHour - offsetHours + 24) % 24

      // Only send if current UTC hour matches their scheduled UTC hour
      if (currentHour !== scheduledUtcHour) continue

      // Send digest directly using the shared logic (no HTTP call, no session needed)
      const result = await sendDigestForUser(user.id)

      if (result.ok) {
        sent++
      } else {
        errors.push(`${user.email}: ${result.error}`)
      }
    } catch (err: any) {
      errors.push(`${user.email}: ${err.message}`)
    }
  }

  return NextResponse.json({
    ok: true,
    users_checked: users.length,
    digests_sent: sent,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: now.toISOString(),
  })
}
