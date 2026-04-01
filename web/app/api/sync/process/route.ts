import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken } from '@/lib/google/tokens'
import { getMessage, parseEmailHeaders, parseEmailBody } from '@/lib/google/gmail'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { TASK_EXTRACTION_SYSTEM, TASK_EXTRACTION_USER } from '@/lib/ai/prompts/task-extraction'
import { TRIP_DETECTION_SYSTEM, TRIP_DETECTION_USER } from '@/lib/ai/prompts/trip-detection'
import { COMMITMENT_EXTRACTION_SYSTEM, COMMITMENT_EXTRACTION_USER } from '@/lib/ai/prompts/commitment-extraction'
import { shouldSkipEmail, postFilterCommitments } from '@/lib/ai/commitment-filters'
import { verifyCommitmentDirections, shouldTriggerTier2 } from '@/lib/ai/commitment-verifier'
import { getImapAccountTokens } from '@/lib/imap/tokens'
import { fetchImapMessageBody, type ImapConfig } from '@/lib/imap/client'

const AI_BATCH_SIZE = 5
const PROCESS_LIMIT = 10

// Keywords that indicate travel-related emails
const TRAVEL_KEYWORDS = [
  'flight', 'booking', 'confirmation', 'itinerary', 'hotel',
  'reservation', 'boarding pass', 'check-in', 'checkin', 'e-ticket',
  'airline', 'departure', 'arrival', 'travel'
]

function looksLikeTravel(subject: string): boolean {
  const lower = (subject || '').toLowerCase()
  return TRAVEL_KEYWORDS.some(kw => lower.includes(kw))
}

export async function POST(request: NextRequest) {
  try {
    // Get current user — support both session auth and cron header
    let userId: string
    const cronUserId = request.headers.get('x-cron-user-id')
    const cronAuth = request.headers.get('authorization')
    if (cronUserId && cronAuth === `Bearer ${process.env.CRON_SECRET}`) {
      userId = cronUserId
    } else {
      const supabase = await createClient()
      const { data: { user: sessionUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !sessionUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = sessionUser.id
    }
    const admin = createAdminClient()

    // Fetch user email for pre-filter
    const { data: profile } = await admin.from('profiles').select('email').eq('id', userId).single()
    const user = { id: userId, email: profile?.email || '' }

    const { client: aiClient, model: aiModel } = await createUserAIClient(user.id)

    // Get Gmail access token (may not exist if user only has IMAP accounts)
    let accessToken: string | null = null
    try {
      accessToken = await getValidAccessToken(user.id)
    } catch {
      // No Gmail account — that's fine, we'll use IMAP for those emails
    }

    // Build IMAP config lookup: source_account_email → ImapConfig
    const imapAccounts = await getImapAccountTokens(user.id)
    const imapConfigMap = new Map<string, ImapConfig>()
    for (const acc of imapAccounts) {
      imapConfigMap.set(acc.email.toLowerCase(), acc.imapConfig)
    }

    // Query unprocessed emails
    const { data: unprocessedEmails, error: queryErr } = await admin
      .from('emails')
      .select('id, gmail_message_id, from_address, from_name, subject, snippet, to_addresses, source_account_email, body_text')
      .eq('user_id', user.id)
      .eq('body_processed', false)
      .order('received_at', { ascending: false })
      .limit(PROCESS_LIMIT)

    if (queryErr) {
      console.error('Failed to query unprocessed emails:', queryErr)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    if (!unprocessedEmails || unprocessedEmails.length === 0) {
      // Count remaining just in case
      const { count } = await admin
        .from('emails')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('body_processed', false)

      return NextResponse.json({ processed: 0, remaining: count || 0 })
    }

    let processed = 0

    // Process in batches of AI_BATCH_SIZE (parallel within batch, sequential between batches)
    for (let i = 0; i < unprocessedEmails.length; i += AI_BATCH_SIZE) {
      const batch = unprocessedEmails.slice(i, i + AI_BATCH_SIZE)

      const results = await Promise.allSettled(
        batch.map(async (emailRow) => {
          try {
            // Pre-filter: skip emails unlikely to contain commitments
            const toAddr = (Array.isArray(emailRow.to_addresses) ? emailRow.to_addresses[0] : emailRow.to_addresses) || ''
            const preFilter = shouldSkipEmail({
              from_address: emailRow.from_address || '',
              from_name: emailRow.from_name || '',
              subject: emailRow.subject || '',
              snippet: emailRow.snippet || '',
              to_address: toAddr,
            }, user.email || undefined)

            if (preFilter.skip) {
              // Mark as processed but don't call LLM
              await admin.from('emails').update({
                body_processed: true,
                commitment_scanned: true,
              }).eq('id', emailRow.id)
              return { skipped: true, reason: preFilter.reason }
            }

            // Fetch full message body — route by account type
            let headers = { from: emailRow.from_name || emailRow.from_address || '', subject: emailRow.subject || '', date: '' }
            let body = ''
            const sourceEmail = (emailRow.source_account_email || '').toLowerCase()
            const imapConfig = imapConfigMap.get(sourceEmail)

            // Priority: body_text (pre-stored) > IMAP fetch > Gmail API > snippet
            if (emailRow.body_text) {
              body = emailRow.body_text
            } else if (imapConfig && emailRow.gmail_message_id.startsWith('imap-')) {
              // IMAP account (163, QQ, Outlook IMAP, etc.) — fetch body via IMAP
              const uidMatch = emailRow.gmail_message_id.match(/^imap-[a-f0-9-]{36}-(\d+)-/)
              const uid = uidMatch ? parseInt(uidMatch[1], 10) : 0
              if (uid > 0) {
                try {
                  body = await fetchImapMessageBody(imapConfig, uid)
                } catch {
                  body = emailRow.snippet || ''
                }
              } else {
                body = emailRow.snippet || ''
              }
            } else if (accessToken) {
              // Gmail/Outlook OAuth — fetch body via API
              const fullMessage = await getMessage(accessToken, emailRow.gmail_message_id)
              const gmailHeaders = parseEmailHeaders(fullMessage.payload?.headers as any)
              headers = gmailHeaders
              body = parseEmailBody(fullMessage.payload)
            } else {
              // No way to fetch body — use snippet
              body = emailRow.snippet || ''
            }

            // AI task extraction
            const aiResponse = await aiClient.chat.completions.create({
              model: aiModel,
              messages: [
                { role: 'system', content: TASK_EXTRACTION_SYSTEM },
                { role: 'user', content: TASK_EXTRACTION_USER({ from: headers.from, subject: headers.subject, body, date: headers.date }) },
              ],
              temperature: 0.3,
              response_format: { type: 'json_object' },
            })

            const content = aiResponse.choices[0]?.message?.content
            if (content) {
              const parsed = JSON.parse(content)

              // Update email: mark as processed + reply status + persist body
              await admin.from('emails').update({
                body_processed: true,
                body_text: body || null,
                is_reply_needed: parsed.reply_needed || false,
                reply_urgency: parsed.reply_urgency || 0,
              }).eq('id', emailRow.id)

              // Insert extracted tasks
              for (const task of parsed.tasks || []) {
                if (task.confidence < 0.5) continue

                await admin.from('tasks').insert({
                  user_id: user.id,
                  title: task.title,
                  priority: task.priority || 2,
                  status: 'pending',
                  source_type: 'email',
                  source_email_id: emailRow.id,
                  due_date: task.due_date || null,
                  due_reason: task.due_reason || null,
                  ai_confidence: task.confidence,
                })
              }

              // Insert commitments
              if (parsed.tasks) {
                for (const task of parsed.tasks) {
                  if (task.type === 'follow_up' && task.confidence >= 0.5) {
                    await admin.from('commitments').insert({
                      user_id: user.id,
                      type: 'they_promised',
                      contact_email: emailRow.from_address,
                      contact_name: emailRow.from_name || emailRow.from_address,
                      title: task.title,
                      description: task.due_reason,
                      source_email_id: emailRow.id,
                      deadline: task.due_date || null,
                    })
                  }
                }
              }
            } else {
              // No AI content but mark as processed to avoid retrying
              await admin.from('emails').update({
                body_processed: true,
              }).eq('id', emailRow.id)
            }

            return emailRow.id
          } catch (aiErr) {
            console.error('AI extraction failed for email:', emailRow.gmail_message_id, aiErr)
            // Don't mark as processed so it can be retried
            throw aiErr
          }
        })
      )

      processed += results.filter(r => r.status === 'fulfilled').length
    }

    // Count remaining unprocessed
    const { count: remaining } = await admin
      .from('emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('body_processed', false)

    // Lightweight contact detection: upsert new email addresses not yet in contacts table
    const newAddresses = new Set<string>()
    for (const emailRow of unprocessedEmails) {
      if (emailRow.from_address) {
        newAddresses.add(emailRow.from_address.toLowerCase().trim())
      }
    }

    for (const email of newAddresses) {
      const { data: existing } = await admin
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .eq('email', email)
        .single()

      if (!existing) {
        const matchingEmail = unprocessedEmails.find(e =>
          e.from_address.toLowerCase().trim() === email
        )
        await admin.from('contacts').upsert({
          user_id: user.id,
          email,
          name: matchingEmail?.from_name || null,
          email_count: 1,
          last_contact_at: new Date().toISOString(),
        }, { onConflict: 'user_id,email', ignoreDuplicates: true })
      }
    }

    // --- Auto trip detection for travel-looking emails ---
    let tripsDetected = 0

    // Fetch subjects for processed emails to check for travel keywords
    const processedIds = unprocessedEmails.map(e => e.id)
    const { data: emailsWithSubjects } = await admin
      .from('emails')
      .select('id, subject, from_address, from_name, snippet, received_at, gmail_message_id, source_account_email')
      .in('id', processedIds)

    const travelCandidates = (emailsWithSubjects || []).filter(e => looksLikeTravel(e.subject || ''))

    if (travelCandidates.length > 0) {
      for (const email of travelCandidates) {
        try {
          // Fetch full body for better detection
          let body = email.snippet || ''
          const travelSourceEmail = (email.source_account_email || '').toLowerCase()
          const travelImapConfig = imapConfigMap.get(travelSourceEmail)
          if (travelImapConfig && email.gmail_message_id.startsWith('imap-')) {
            const uidMatch = email.gmail_message_id.match(/^imap-[a-f0-9-]{36}-(\d+)-/)
            const uid = uidMatch ? parseInt(uidMatch[1], 10) : 0
            if (uid > 0) {
              try { body = await fetchImapMessageBody(travelImapConfig, uid) || body } catch { /* snippet fallback */ }
            }
          } else if (accessToken) {
            try {
              const fullMessage = await getMessage(accessToken, email.gmail_message_id)
              body = parseEmailBody(fullMessage.payload) || body
            } catch { /* use snippet as fallback */ }
          }

          const aiResponse = await aiClient.chat.completions.create({
            model: aiModel,
            messages: [
              { role: 'system', content: TRIP_DETECTION_SYSTEM },
              {
                role: 'user',
                content: TRIP_DETECTION_USER({
                  from: `${email.from_name || ''} <${email.from_address}>`,
                  subject: email.subject || '',
                  body: body,
                  date: email.received_at || '',
                }),
              },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
          })

          const content = aiResponse.choices[0]?.message?.content
          if (!content) continue

          const parsed = JSON.parse(content)
          if (!parsed.is_travel || !parsed.start_date) continue

          // Determine status
          const now = new Date()
          const start = new Date(parsed.start_date)
          const end = parsed.end_date ? new Date(parsed.end_date) : start
          let status: 'upcoming' | 'active' | 'completed' = 'upcoming'
          if (now > end) status = 'completed'
          else if (now >= start && now <= end) status = 'active'

          const city = parsed.destination_city || null
          const country = parsed.destination_country || null

          // Check for existing trip with same destination and overlapping dates
          const { data: existingTrips } = await admin
            .from('trips')
            .select('id')
            .eq('user_id', user.id)
            .eq('destination_city', city || '')
            .lte('start_date', parsed.end_date || parsed.start_date)
            .gte('end_date', parsed.start_date)

          if (existingTrips && existingTrips.length > 0) {
            // Update existing trip with new info
            const tripId = existingTrips[0].id
            const updateData: any = {
              status,
              updated_at: new Date().toISOString(),
            }
            if (parsed.flight_info) updateData.flight_info = [parsed.flight_info]
            if (parsed.hotel_info) updateData.hotel_info = [parsed.hotel_info]
            await admin.from('trips').update(updateData).eq('id', tripId)

            // Create expense if amount detected
            if (parsed.amount && parsed.amount > 0) {
              const { data: existingExpense } = await admin
                .from('trip_expenses')
                .select('id')
                .eq('user_id', user.id)
                .eq('source_email_id', email.id)

              if (!existingExpense || existingExpense.length === 0) {
                await admin.from('trip_expenses').insert({
                  user_id: user.id,
                  trip_id: tripId,
                  category: parsed.trip_type === 'flight' ? 'flight' : parsed.trip_type === 'hotel' ? 'hotel' : parsed.trip_type === 'transport' ? 'transport' : 'other',
                  merchant_name: parsed.merchant_name || null,
                  amount: parsed.amount,
                  currency: parsed.currency || 'SGD',
                  expense_date: parsed.start_date,
                  source_email_id: email.id,
                  status: 'pending',
                })
              }
            }
          } else {
            // Create new trip
            const title = city
              ? `Trip to ${city}`
              : `Travel - ${(email.subject || '').slice(0, 50)}`

            const { data: newTrip, error: tripError } = await admin
              .from('trips')
              .insert({
                user_id: user.id,
                title,
                destination_city: city,
                destination_country: country,
                start_date: parsed.start_date,
                end_date: parsed.end_date || parsed.start_date,
                status,
                flight_info: parsed.flight_info ? [parsed.flight_info] : [],
                hotel_info: parsed.hotel_info ? [parsed.hotel_info] : [],
                source_email_ids: [email.id],
              })
              .select('id')
              .single()

            if (!tripError && newTrip) {
              tripsDetected++

              // Write to structured tables (trip_flights / trip_hotels)
              if (parsed.trip_type === 'flight' && parsed.flight_info) {
                const fi = parsed.flight_info
                await admin.from('trip_flights').insert({
                  trip_id: newTrip.id,
                  user_id: user.id,
                  airline: fi.airline || null,
                  flight_number: fi.flight_number || null,
                  origin_airport: fi.origin || null,
                  dest_airport: fi.destination || null,
                  departure_at: parsed.start_date || null,
                  arrival_at: parsed.end_date || null,
                  booking_ref: fi.booking_ref || fi.confirmation || null,
                  cabin_class: fi.cabin_class || null,
                  seat_number: fi.seat || null,
                  signal_id: email.id,
                  signal_channel: 'email',
                })
              }

              if (parsed.trip_type === 'hotel' && parsed.hotel_info) {
                const hi = parsed.hotel_info
                await admin.from('trip_hotels').insert({
                  trip_id: newTrip.id,
                  user_id: user.id,
                  name: hi.hotel_name || hi.name || city || 'Hotel',
                  address: hi.address || null,
                  city: city || null,
                  checkin_at: parsed.start_date || null,
                  checkout_at: parsed.end_date || null,
                  booking_ref: hi.booking_ref || hi.confirmation || null,
                  room_type: hi.room_type || null,
                  signal_id: email.id,
                  signal_channel: 'email',
                })
              }

              // Create expense if amount detected
              if (parsed.amount && parsed.amount > 0) {
                await admin.from('trip_expenses').insert({
                  user_id: user.id,
                  trip_id: newTrip.id,
                  category: parsed.trip_type === 'flight' ? 'flight' : parsed.trip_type === 'hotel' ? 'hotel' : parsed.trip_type === 'transport' ? 'transport' : 'other',
                  merchant_name: parsed.merchant_name || null,
                  amount: parsed.amount,
                  currency: parsed.currency || 'SGD',
                  expense_date: parsed.start_date,
                  source_email_id: email.id,
                  status: 'pending',
                })
              }
            }
          }
        } catch (tripErr) {
          console.error('Auto trip detection failed for email:', email.id, tripErr)
          // Non-blocking — continue processing other emails
        }
      }
    }

    // --- Commitment extraction from SENT emails ---
    let commitmentsExtracted = 0
    try {
      const { data: sentEmails } = await admin
        .from('emails')
        .select('id, gmail_message_id, from_address, to_addresses, subject, snippet, labels, source_account_email')
        .eq('user_id', user.id)
        .eq('body_processed', true)
        .contains('labels', ['SENT'])
        .is('commitment_scanned', null)
        .order('received_at', { ascending: false })
        .limit(10)

      if (sentEmails && sentEmails.length > 0) {
        for (const email of sentEmails) {
          try {
            let body = email.snippet || ''
            const sentSourceEmail = (email.source_account_email || '').toLowerCase()
            const sentImapConfig = imapConfigMap.get(sentSourceEmail)
            if (sentImapConfig && email.gmail_message_id.startsWith('imap-')) {
              const uidMatch = email.gmail_message_id.match(/^imap-[a-f0-9-]{36}-(\d+)-/)
              const uid = uidMatch ? parseInt(uidMatch[1], 10) : 0
              if (uid > 0) {
                try { body = await fetchImapMessageBody(sentImapConfig, uid, '&XfJT0ZAB-') || body } catch {
                  try { body = await fetchImapMessageBody(sentImapConfig, uid, 'Sent Messages') || body } catch { /* snippet */ }
                }
              }
            } else if (accessToken) {
              try {
                const fullMsg = await getMessage(accessToken, email.gmail_message_id)
                body = parseEmailBody(fullMsg.payload) || body
              } catch { /* use snippet */ }
            }

            const toAddr = Array.isArray(email.to_addresses) ? email.to_addresses[0] : ''

            const aiRes = await aiClient.chat.completions.create({
              model: aiModel,
              messages: [
                { role: 'system', content: COMMITMENT_EXTRACTION_SYSTEM },
                { role: 'user', content: COMMITMENT_EXTRACTION_USER({
                  from: email.from_address || '',
                  to: toAddr,
                  subject: email.subject || '',
                  body,
                  date: new Date().toISOString(),
                  channel: 'email',
                }) },
              ],
              temperature: 0.3,
              response_format: { type: 'json_object' },
            })

            const content = aiRes.choices[0]?.message?.content
            if (content) {
              const parsed = JSON.parse(content)
              let commitments = (parsed.commitments || []).filter((c: any) => (c.confidence || 0) >= 0.5)

              // Tier 2: Reasoner direction verification (if triggered)
              if (commitments.length > 0) {
                const isOutbound = (email.labels || []).includes('SENT')
                const shouldVerify = shouldTriggerTier2(
                  commitments,
                  { body, subject: email.subject || '', to_addresses: email.to_addresses },
                  false,
                )

                if (shouldVerify) {
                  try {
                    commitments = await verifyCommitmentDirections(
                      aiClient as any,
                      commitments,
                      {
                        from: email.from_address || '',
                        to: toAddr,
                        subject: email.subject || '',
                        body,
                        direction: isOutbound ? 'outbound' : 'inbound',
                      },
                    )
                  } catch (verifyErr) {
                    console.error('Tier 2 verification failed, using Tier 1 results:', verifyErr)
                  }
                }
              }

              for (const c of commitments) {
                await admin.from('commitments').insert({
                  user_id: user.id,
                  type: c.type === 'waiting_on_them' ? 'they_promised' : 'i_promised',
                  contact_email: toAddr,
                  contact_name: null,
                  title: c.title,
                  description: c.due_reason || null,
                  source_email_id: email.id,
                  signal_id: email.id,
                  signal_channel: 'email',
                  deadline: c.due_date || null,
                  status: 'pending',
                })
                commitmentsExtracted++
              }
            }

            // Mark as scanned
            await admin.from('emails').update({
              commitment_scanned: true,
            }).eq('id', email.id)
          } catch (err) {
            console.error('Commitment extraction failed for:', email.id, err)
          }
        }
      }
    } catch (commitErr) {
      console.error('Commitment extraction pass failed:', commitErr)
    }

    // --- WhatsApp: commitment tracking + contact recognition ---
    let waProcessed = 0
    try {
      const { data: unprocessedWa } = await admin
        .from('whatsapp_messages')
        .select('id, from_number, from_name, to_number, body, direction, received_at')
        .eq('user_id', user.id)
        .eq('is_task_extracted', false)
        .not('body', 'is', null)
        .order('received_at', { ascending: false })
        .limit(20)

      if (unprocessedWa && unprocessedWa.length > 0) {
        // Contact recognition: upsert WhatsApp contacts
        const waContacts = new Map<string, string>()
        for (const m of unprocessedWa) {
          if (m.direction === 'inbound' && m.from_name && m.from_number) {
            waContacts.set(m.from_number, m.from_name)
          }
        }

        for (const [phone, name] of waContacts) {
          try {
            await admin.from('contacts').upsert({
              user_id: user.id,
              phone,
              name,
              email: `wa-${phone}@whatsapp.placeholder`,
              last_contact_at: new Date().toISOString(),
            }, { onConflict: 'user_id,email', ignoreDuplicates: true })
          } catch { /* ignore duplicates */ }
        }

        // Commitment extraction from outbound WhatsApp
        const outboundWa = unprocessedWa.filter(m => m.direction === 'outbound' && m.body)
        for (const msg of outboundWa.slice(0, 5)) {
          try {
            const aiRes = await aiClient.chat.completions.create({
              model: aiModel,
              messages: [
                { role: 'system', content: COMMITMENT_EXTRACTION_SYSTEM },
                { role: 'user', content: COMMITMENT_EXTRACTION_USER({
                  to: msg.to_number || '',
                  subject: 'WhatsApp message',
                  body: msg.body || '',
                  date: msg.received_at || new Date().toISOString(),
                  channel: 'whatsapp',
                }) },
              ],
              temperature: 0.3,
              response_format: { type: 'json_object' },
            })

            const content = aiRes.choices[0]?.message?.content
            if (content) {
              const parsed = JSON.parse(content)
              for (const c of parsed.commitments || []) {
                if ((c.confidence || 0) < 0.5) continue
                await admin.from('commitments').insert({
                  user_id: user.id,
                  type: c.type === 'waiting_on_them' ? 'they_promised' : 'i_promised',
                  contact_email: `wa-${msg.to_number}@whatsapp.placeholder`,
                  contact_name: null,
                  title: c.title,
                  description: c.due_reason || null,
                  deadline: c.due_date || null,
                  status: 'pending',
                })
              }
            }
          } catch { /* non-critical */ }
        }

        // Mark all as processed
        const waIds = unprocessedWa.map(m => m.id)
        await admin.from('whatsapp_messages').update({ is_task_extracted: true }).in('id', waIds)
        waProcessed = unprocessedWa.length
      }
    } catch (waErr) {
      console.error('WhatsApp processing failed:', waErr)
    }

    return NextResponse.json({
      processed,
      remaining: remaining || 0,
      trips_detected: tripsDetected,
      commitments_extracted: commitmentsExtracted,
      whatsapp_processed: waProcessed,
    })
  } catch (error: any) {
    console.error('Process error:', error)
    return NextResponse.json({ error: error.message || 'Processing failed' }, { status: 500 })
  }
}
