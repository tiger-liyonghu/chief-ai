import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Vercel Cron calls this every hour
// It checks which users have digest enabled and if it's their scheduled time
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const currentHour = now.getUTCHours()
  const currentMinute = now.getUTCMinutes()

  // Find users with digest enabled whose scheduled time matches current hour
  // daily_brief_time is stored as 'HH:MM' in user's local timezone
  // For simplicity, we check profiles where daily_brief_enabled = true
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
      const [scheduledHour, scheduledMinute] = (user.daily_brief_time || '08:00').split(':').map(Number)

      // Get the UTC offset for the user's timezone
      const userNow = new Date(now.toLocaleString('en-US', { timeZone: user.timezone || 'Asia/Singapore' }))
      const offsetMs = userNow.getTime() - now.getTime()
      const offsetHours = Math.round(offsetMs / 3600000)

      const scheduledUtcHour = (scheduledHour - offsetHours + 24) % 24

      // Only send if current UTC hour matches their scheduled UTC hour
      // Allow 30 min window to account for cron timing
      if (currentHour !== scheduledUtcHour) continue

      // Call the digest API for this user
      // We need to use the internal digest logic directly since we're in a cron context
      const { data: tokenData } = await admin
        .from('google_tokens')
        .select('access_token_encrypted')
        .eq('user_id', user.id)
        .single()

      if (!tokenData) continue

      // Trigger digest via internal fetch
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      // Create a temporary admin session to call the digest endpoint
      // Instead, let's directly implement the send logic here
      const digestRes = await fetch(`${baseUrl}/api/digest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-user-id': user.id, // Internal header for cron
        },
      })

      if (digestRes.ok) {
        sent++
      } else {
        errors.push(`${user.email}: ${digestRes.status}`)
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
