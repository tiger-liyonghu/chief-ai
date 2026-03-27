import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllAccountTokens, updateAccountHistoryId } from '@/lib/google/tokens'
import { listMessages, getMessageMetadata, parseEmailHeaders, listHistory, getProfile } from '@/lib/google/gmail'
import { listEvents } from '@/lib/google/calendar'
import type { AccountWithToken } from '@/lib/google/tokens'

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Log sync start
    const { data: syncLog } = await admin.from('sync_log').insert({
      user_id: user.id,
      sync_type: 'incremental',
      status: 'running',
    }).select('id').single()

    // Get all connected accounts
    const accounts = await getAllAccountTokens(user.id)

    let totalEmailsSynced = 0
    let totalEventsSynced = 0
    let usedIncremental = false
    const accountResults: { email: string; emails: number; events: number; error?: string }[] = []

    // Sync each account
    for (const account of accounts) {
      const result = await syncOneAccount(admin, user.id, account)
      accountResults.push(result)
      totalEmailsSynced += result.emails
      totalEventsSynced += result.events
      if (result.emails > 0) usedIncremental = true
    }

    // Update sync log
    if (syncLog?.id) {
      await admin.from('sync_log').update({
        sync_type: usedIncremental ? 'incremental' : 'full',
        status: 'completed',
        messages_processed: totalEmailsSynced,
        completed_at: new Date().toISOString(),
      }).eq('id', syncLog.id)
    }

    return NextResponse.json({
      ok: true,
      emails_synced: totalEmailsSynced,
      events_synced: totalEventsSynced,
      accounts_synced: accountResults.length,
      account_details: accountResults,
      ai_processing: 'pending',
    })
  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 })
  }
}

async function syncOneAccount(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  account: AccountWithToken,
): Promise<{ email: string; emails: number; events: number; error?: string }> {
  const { accessToken, googleEmail, accountId, gmailHistoryId: storedHistoryId } = account
  let emailsSynced = 0
  let eventsSynced = 0

  try {
    // === SYNC EMAILS ===
    const { count: existingEmailCount } = await admin
      .from('emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('source_account_email', googleEmail)

    const isFirstSync = !existingEmailCount || existingEmailCount === 0
    const fullSyncLimit = isFirstSync ? 200 : 100

    let messageIdsToSync: string[] = []
    let usedIncremental = false
    let newHistoryId: string | null = null

    if (storedHistoryId) {
      try {
        const historyData = await listHistory(accessToken, storedHistoryId)
        newHistoryId = historyData.historyId || null

        const histories = historyData.history || []
        const ids = new Set<string>()
        for (const h of histories) {
          for (const added of h.messagesAdded || []) {
            if (added.message?.id) ids.add(added.message.id)
          }
        }
        messageIdsToSync = Array.from(ids)
        usedIncremental = true
      } catch (histErr: any) {
        console.warn(`Incremental sync failed for ${googleEmail}, falling back to full sync:`, histErr.message)
      }
    }

    if (!usedIncremental) {
      const messageList = await listMessages(accessToken, fullSyncLimit)
      messageIdsToSync = (messageList.messages || [])
        .map((m: any) => m.id!)
        .filter(Boolean)
    }

    if (!newHistoryId) {
      try {
        const profile = await getProfile(accessToken)
        newHistoryId = profile.historyId?.toString() || null
      } catch {
        // non-critical
      }
    }

    // Fetch metadata in batches of 10
    const METADATA_BATCH_SIZE = 10
    for (let i = 0; i < messageIdsToSync.length; i += METADATA_BATCH_SIZE) {
      const batch = messageIdsToSync.slice(i, i + METADATA_BATCH_SIZE)

      const results = await Promise.allSettled(
        batch.map(async (msgId) => {
          const { data: existing } = await admin
            .from('emails')
            .select('id, body_processed')
            .eq('user_id', userId)
            .eq('gmail_message_id', msgId)
            .single()

          if (existing?.body_processed) return null

          const metaMessage = await getMessageMetadata(accessToken, msgId)
          const headers = parseEmailHeaders(metaMessage.payload?.headers as any)

          const fromMatch = headers.from.match(/^(.+?)\s*<(.+?)>$/)
          const fromName = fromMatch ? fromMatch[1].replace(/"/g, '').trim() : null
          const fromAddress = fromMatch ? fromMatch[2] : headers.from

          await admin.from('emails').upsert({
            user_id: userId,
            gmail_message_id: msgId,
            thread_id: metaMessage.threadId || msgId,
            subject: headers.subject,
            from_address: fromAddress,
            from_name: fromName,
            received_at: headers.date ? new Date(headers.date).toISOString() : new Date().toISOString(),
            snippet: metaMessage.snippet || '',
            labels: metaMessage.labelIds || [],
            body_processed: false,
            source_account_email: googleEmail,
          }, { onConflict: 'user_id,gmail_message_id' })

          return msgId
        })
      )

      emailsSynced += results.filter(r => r.status === 'fulfilled' && r.value !== null).length
    }

    // Store historyId for next incremental sync
    if (newHistoryId) {
      await updateAccountHistoryId(accountId, newHistoryId)
    }

    // === SYNC CALENDAR ===
    try {
      const now = new Date()
      const twoWeeksLater = new Date(now.getTime() + 14 * 86400000)
      const events = await listEvents(accessToken, now.toISOString(), twoWeeksLater.toISOString())

      for (const event of events) {
        if (!event.id || !event.summary) continue

        const startTime = event.start?.dateTime || event.start?.date
        const endTime = event.end?.dateTime || event.end?.date
        if (!startTime || !endTime) continue

        const attendees = (event.attendees || []).map((a: any) => ({
          email: a.email,
          name: a.displayName,
          status: a.responseStatus,
        }))

        await admin.from('calendar_events').upsert({
          user_id: userId,
          google_event_id: event.id,
          title: event.summary,
          description: event.description || null,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          attendees: JSON.stringify(attendees),
          location: event.location || null,
          meeting_link: event.hangoutLink || null,
          is_recurring: !!event.recurringEventId,
          source_account_email: googleEmail,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,google_event_id' })

        eventsSynced++
      }
    } catch (calErr) {
      console.error(`Calendar sync failed for ${googleEmail}:`, calErr)
    }

    return { email: googleEmail, emails: emailsSynced, events: eventsSynced }
  } catch (err: any) {
    console.error(`Sync failed for account ${googleEmail}:`, err)
    return { email: googleEmail, emails: emailsSynced, events: eventsSynced, error: err.message }
  }
}
