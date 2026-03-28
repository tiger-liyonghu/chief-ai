import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllAccountTokens, updateAccountHistoryId } from '@/lib/google/tokens'
import { listMessages, getMessageMetadata, parseEmailHeaders, listHistory, getProfile } from '@/lib/google/gmail'
import { listEvents } from '@/lib/google/calendar'
import { getMicrosoftAccountTokens, updateMicrosoftDeltaLink } from '@/lib/microsoft/tokens'
import { listMessages as msListMessages, parseGraphMessage } from '@/lib/microsoft/mail'
import { listEvents as msListEvents, parseGraphEvent } from '@/lib/microsoft/calendar'
import { getImapAccountTokens, updateImapSyncState } from '@/lib/imap/tokens'
import { listImapMessages, listImapSentMessages, type ImapConfig } from '@/lib/imap/client'
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

    let totalEmailsSynced = 0
    let totalEventsSynced = 0
    let usedIncremental = false
    const accountResults: { email: string; emails: number; events: number; error?: string }[] = []

    // Sync Google accounts
    const googleAccounts = await getAllAccountTokens(user.id)
    for (const account of googleAccounts) {
      const result = await syncOneGoogleAccount(admin, user.id, account)
      accountResults.push(result)
      totalEmailsSynced += result.emails
      totalEventsSynced += result.events
      if (result.emails > 0) usedIncremental = true
    }

    // Sync Microsoft accounts
    const msAccounts = await getMicrosoftAccountTokens(user.id)
    for (const account of msAccounts) {
      const result = await syncOneMicrosoftAccount(admin, user.id, account)
      accountResults.push(result)
      totalEmailsSynced += result.emails
      totalEventsSynced += result.events
    }

    // Sync IMAP accounts (163, QQ, etc.)
    const imapAccounts = await getImapAccountTokens(user.id)
    for (const account of imapAccounts) {
      const result = await syncOneImapAccount(admin, user.id, account)
      accountResults.push(result)
      totalEmailsSynced += result.emails
      totalEventsSynced += result.events
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

async function syncOneGoogleAccount(
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
      // Sync both inbox and sent emails
      const [inboxList, sentList] = await Promise.all([
        listMessages(accessToken, fullSyncLimit, undefined, 'in:inbox'),
        listMessages(accessToken, Math.min(fullSyncLimit, 50), undefined, 'in:sent'),
      ])
      const allIds = new Set<string>()
      for (const m of (inboxList.messages || [])) { if (m.id) allIds.add(m.id) }
      for (const m of (sentList.messages || [])) { if (m.id) allIds.add(m.id) }
      messageIdsToSync = Array.from(allIds)
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

// ─── Microsoft Account Sync ───

async function syncOneMicrosoftAccount(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  account: { accountId: string; email: string; accessToken: string; deltaLink: string | null },
): Promise<{ email: string; emails: number; events: number; error?: string }> {
  const { accessToken, email, accountId, deltaLink } = account
  let emailsSynced = 0
  let eventsSynced = 0

  try {
    // === SYNC EMAILS via Microsoft Graph ===
    const { count: existingEmailCount } = await admin
      .from('emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('source_account_email', email)

    const isFirstSync = !existingEmailCount || existingEmailCount === 0
    const limit = isFirstSync ? 200 : 100

    const { messages, deltaLink: newDeltaLink } = await msListMessages(
      accessToken,
      limit,
      deltaLink || undefined,
    )

    for (const msg of messages) {
      if (msg.isDraft) continue

      const parsed = parseGraphMessage(msg)

      const { data: existing } = await admin
        .from('emails')
        .select('id, body_processed')
        .eq('user_id', userId)
        .eq('gmail_message_id', parsed.messageId)
        .single()

      if (existing?.body_processed) continue

      await admin.from('emails').upsert({
        user_id: userId,
        gmail_message_id: parsed.messageId,
        thread_id: parsed.threadId,
        subject: parsed.subject,
        from_address: parsed.fromAddress,
        from_name: parsed.fromName,
        to_addresses: parsed.toAddresses,
        received_at: new Date(parsed.receivedAt).toISOString(),
        snippet: parsed.snippet,
        labels: parsed.labels,
        body_processed: false,
        source_account_email: email,
      }, { onConflict: 'user_id,gmail_message_id' })

      emailsSynced++
    }

    // Save delta link for next incremental sync
    if (newDeltaLink) {
      await updateMicrosoftDeltaLink(accountId, newDeltaLink)
    }

    // === SYNC CALENDAR via Microsoft Graph ===
    try {
      const now = new Date()
      const twoWeeksLater = new Date(now.getTime() + 14 * 86400000)
      const events = await msListEvents(accessToken, now.toISOString(), twoWeeksLater.toISOString())

      for (const event of events) {
        const parsed = parseGraphEvent(event)

        await admin.from('calendar_events').upsert({
          user_id: userId,
          google_event_id: parsed.googleEventId,
          title: parsed.title,
          description: parsed.description,
          start_time: parsed.startTime,
          end_time: parsed.endTime,
          attendees: JSON.stringify(parsed.attendees),
          location: parsed.location,
          meeting_link: parsed.meetingLink,
          is_recurring: parsed.isRecurring,
          source_account_email: email,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,google_event_id' })

        eventsSynced++
      }
    } catch (calErr) {
      console.error(`Microsoft Calendar sync failed for ${email}:`, calErr)
    }

    return { email, emails: emailsSynced, events: eventsSynced }
  } catch (err: any) {
    console.error(`Microsoft sync failed for ${email}:`, err)
    return { email, emails: emailsSynced, events: eventsSynced, error: err.message }
  }
}

// ─── IMAP Account Sync (163, QQ, etc.) ───

interface ImapAccountForSync {
  accountId: string
  email: string
  password: string
  imapConfig: ImapConfig
  uidValidity: string | null
  lastUid: string | null
}

async function syncOneImapAccount(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  account: ImapAccountForSync,
): Promise<{ email: string; emails: number; events: number; error?: string }> {
  const { email, imapConfig, accountId } = account
  let emailsSynced = 0

  try {
    // Determine sync strategy
    const { count: existingEmailCount } = await admin
      .from('emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('source_account_email', email)

    const isFirstSync = !existingEmailCount || existingEmailCount === 0
    const limit = isFirstSync ? 200 : 100

    // Check if UID validity changed (mailbox was recreated)
    const storedUidValidity = account.uidValidity
    const storedLastUid = account.lastUid ? parseInt(account.lastUid, 10) : undefined

    // Fetch inbox messages
    const sinceUid = storedUidValidity && storedLastUid ? storedLastUid : undefined
    const { messages: inboxMessages, uidValidity, lastUid } = await listImapMessages(
      imapConfig,
      limit,
      sinceUid,
    )

    // If UID validity changed, do a full sync (ignore stored UID)
    let messagesToSync = inboxMessages
    if (storedUidValidity && storedUidValidity !== String(uidValidity)) {
      console.warn(`IMAP UID validity changed for ${email}, doing full re-sync`)
      const fullResult = await listImapMessages(imapConfig, limit)
      messagesToSync = fullResult.messages
    }

    // Also fetch sent messages on first sync
    if (isFirstSync) {
      try {
        const sentMessages = await listImapSentMessages(imapConfig, 30)
        messagesToSync = [...messagesToSync, ...sentMessages]
      } catch {
        // Sent folder is non-critical
      }
    }

    // Deduplicate by messageId
    const seen = new Set<string>()
    const unique = messagesToSync.filter((m) => {
      if (seen.has(m.messageId)) return false
      seen.add(m.messageId)
      return true
    })

    // Upsert into emails table
    for (const msg of unique) {
      const imapMessageId = `imap-${accountId}-${msg.uid}-${msg.messageId}`

      const { data: existing } = await admin
        .from('emails')
        .select('id, body_processed')
        .eq('user_id', userId)
        .eq('gmail_message_id', imapMessageId)
        .single()

      if (existing?.body_processed) continue

      // Determine labels based on flags
      const labels: string[] = []
      if (msg.flags.includes('\\Seen')) labels.push('UNREAD')
      else labels.push('INBOX')
      if (msg.flags.includes('\\Flagged')) labels.push('STARRED')

      // Build to_addresses array
      const toAddresses = msg.to.map((t) => t.address).filter(Boolean)

      await admin.from('emails').upsert({
        user_id: userId,
        gmail_message_id: imapMessageId,
        thread_id: msg.messageId, // Use message-id as thread grouping
        subject: msg.subject,
        from_address: msg.from.address,
        from_name: msg.from.name,
        to_addresses: toAddresses,
        received_at: msg.date,
        snippet: msg.snippet || msg.subject,
        labels,
        body_processed: false,
        source_account_email: email,
      }, { onConflict: 'user_id,gmail_message_id' })

      emailsSynced++
    }

    // Update sync state for incremental sync next time
    await updateImapSyncState(accountId, String(uidValidity), String(lastUid))

    // IMAP doesn't have calendar — events = 0
    return { email, emails: emailsSynced, events: 0 }
  } catch (err: any) {
    console.error(`IMAP sync failed for ${email}:`, err)
    return { email, emails: emailsSynced, events: 0, error: err.message }
  }
}
