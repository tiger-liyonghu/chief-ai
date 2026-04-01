import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/cron/sync
 *
 * Periodic sync trigger: calls /api/sync then /api/sync/process for each active user.
 * Designed to be called by Railway cron or external scheduler every 15-30 minutes.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Find all users with at least one connected account
  const { data: accounts } = await admin
    .from('google_accounts')
    .select('user_id')

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ message: 'No accounts to sync', synced: 0 })
  }

  // Deduplicate user IDs
  const userIds = [...new Set(accounts.map((a) => a.user_id))]

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : 'http://localhost:3000'

  const results: { userId: string; sync?: any; process?: any; error?: string }[] = []

  for (const userId of userIds) {
    try {
      // Step 1: Sync new emails
      const syncRes = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-user-id': userId,
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        },
      })
      const syncData = await syncRes.json().catch(() => ({}))

      // Step 2: Process unprocessed emails (extract commitments)
      const processRes = await fetch(`${baseUrl}/api/sync/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-user-id': userId,
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        },
      })
      const processData = await processRes.json().catch(() => ({}))

      results.push({ userId: userId.substring(0, 8), sync: syncData, process: processData })
    } catch (err: any) {
      results.push({ userId: userId.substring(0, 8), error: err.message })
    }
  }

  return NextResponse.json({
    message: `Synced ${userIds.length} users`,
    results,
  })
}
