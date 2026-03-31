import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { COMMITMENT_EXTRACTION_SYSTEM } from '@/lib/ai/prompts/commitment-extraction'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { shouldSkipEmail, postFilterCommitments } from '@/lib/ai/commitment-filters'
import { getPersonalizedPrompt } from '@/lib/ai/personalized-prompt'
import { calculateUrgencyScores } from '@/lib/commitments/score'

/**
 * Streaming Commitment Scanner — the "30-second wow moment".
 * SSE endpoint: users see commitments appearing in real-time as emails are analyzed.
 *
 * Stream events:
 *   status     — initial scan summary (total, filtered, skipped counts)
 *   commitment — each extracted commitment as it's found
 *   progress   — batch progress update
 *   error      — non-fatal error in a batch
 *   done       — final summary
 */

// Inbound extraction prompt (same as scan route)
const INBOUND_EXTRACTION_SYSTEM = `You are an AI assistant that extracts commitments from INBOUND emails (emails received BY the user FROM others).

Analyze the received message and identify two types of commitments:

1. **they_promised**: Things the sender committed to do for the user.
   - Patterns: "I'll send you", "We will", "Let me get back", "Will share", "I'll follow up", "我来处理", "下周给你", "回头发给你"

2. **i_promised**: Things the sender is ASKING the user to do (creating an obligation).
   - Patterns: "Could you please", "Can you send", "We need you to", "Please review", "请帮忙", "麻烦你", "能不能"

For each commitment found, provide:
- type: "i_promised" | "they_promised"
- due_date: ISO date if a deadline is mentioned or implied, null otherwise
- confidence: 0.0-1.0

Rules:
- Only extract genuine commitments, not pleasantries or FYI messages
- Be conservative: confidence < 0.5 will be filtered out
- CC/newsletter emails typically have NO commitments
- Detect language automatically (English/Chinese/mixed)

Respond in JSON:
{
  "commitments": [...],
  "summary": "One sentence summary"
}`

// Outbound address patterns to determine email direction
const OUTBOUND_PATTERNS = ['tiger', 'actuaryhelp', 'nkliyonghu']

interface EmailRow {
  id: string
  gmail_message_id: string | null
  from_address: string | null
  from_name: string | null
  to_addresses: string | string[] | null
  subject: string | null
  snippet: string | null
  body_text: string | null
  source_account_email: string | null
  received_at: string | null
  labels: string[] | null
}

interface StreamCommitment {
  type: string
  title: string
  contact_name: string | null
  contact_email: string
  deadline: string | null
  confidence: number
  source_subject: string | null
  source_email_id: string
}

// ─── Concurrency helper ───

async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
) {
  const queue = [...items]
  const running: Promise<void>[] = []
  while (queue.length > 0 || running.length > 0) {
    while (running.length < concurrency && queue.length > 0) {
      const item = queue.shift()!
      const p = fn(item).then(() => {
        running.splice(running.indexOf(p), 1)
      })
      running.push(p)
    }
    if (running.length > 0) await Promise.race(running)
  }
}

// ─── SSE helpers ───

function sseEvent(type: string, data: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...data })}\n\n`
}

// ─── Main handler ───

export async function GET(req: NextRequest) {
  const startTime = Date.now()

  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(
      sseEvent('error', { message: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'text/event-stream' } },
    )
  }

  // Query params
  const searchParams = req.nextUrl.searchParams
  const rawHours = Number(searchParams.get('hours'))
  const hours = Number.isFinite(rawHours) && rawHours > 0 ? Math.min(rawHours, 168) : 168
  const mode = searchParams.get('mode') || 'normal'
  const isFirstScan = mode === 'first_scan'
  const since = new Date(Date.now() - hours * 3600000).toISOString()

  // Create the SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: Record<string, unknown>) => {
        try {
          controller.enqueue(new TextEncoder().encode(sseEvent(type, data)))
        } catch {
          // Controller may be closed if client disconnected
        }
      }

      try {
        // 1. Fetch recent emails
        let query = supabase
          .from('emails')
          .select('id, gmail_message_id, from_address, from_name, to_addresses, subject, snippet, body_text, source_account_email, received_at, labels')
          .eq('user_id', user.id)
          .gte('received_at', since)
          .order('received_at', { ascending: false })
          .limit(100)

        // In normal mode, only unscanned emails
        if (!isFirstScan) {
          query = query.eq('commitment_scanned', false)
        }

        const { data: emails, error: fetchError } = await query

        const safeClose = async () => {
          await new Promise(r => setTimeout(r, 500))
          try { controller.close() } catch { /* already closed */ }
        }

        if (fetchError) {
          send('error', { message: `Failed to fetch emails: ${fetchError.message}` })
          await safeClose()
          return
        }

        if (!emails || emails.length === 0) {
          send('status', { message: 'No new emails to scan.', total: 0, filtered: 0, skipped: 0 })
          send('done', { total_found: 0, i_promised: 0, they_promised: 0, duration_ms: Date.now() - startTime })
          await safeClose()
          return
        }

        // 2. Pre-filter
        const filtered: EmailRow[] = []
        const skipped: Array<{ email: EmailRow; reason: string }> = []

        for (const email of emails as EmailRow[]) {
          // In first_scan mode, skip dedup check (commitment_scanned)
          if (!isFirstScan && (email as unknown as Record<string, unknown>).commitment_scanned) {
            skipped.push({ email, reason: 'already_scanned' })
            continue
          }

          const toAddr = Array.isArray(email.to_addresses) ? email.to_addresses[0] : (email.to_addresses || '')
          const isOutbound = Array.isArray(email.labels) && email.labels.includes('SENT')
          const pf = shouldSkipEmail({
            from_address: email.from_address || '',
            from_name: email.from_name || '',
            subject: email.subject || '',
            snippet: email.snippet || '',
            to_address: toAddr,
            is_outbound: isOutbound,
          })

          if (pf.skip) {
            skipped.push({ email, reason: pf.reason })
          } else {
            filtered.push(email)
          }
        }

        send('status', {
          message: `Scanning ${filtered.length} emails...`,
          total: emails.length,
          filtered: filtered.length,
          skipped: skipped.length,
        })

        if (filtered.length === 0) {
          send('done', { total_found: 0, i_promised: 0, they_promised: 0, duration_ms: Date.now() - startTime })
          controller.close()
          return
        }

        // 3. Get LLM client + personalized prompt
        const { client: ai, model } = await createUserAIClient(user.id)
        const personalizedBlock = await getPersonalizedPrompt(user.id)

        // Get existing commitments for dedup (skip in first_scan mode)
        let existingTitles: string[] = []
        if (!isFirstScan) {
          const { data: existingCommitments } = await supabase
            .from('commitments')
            .select('title')
            .eq('user_id', user.id)
            .in('status', ['pending', 'in_progress', 'overdue'])

          existingTitles = (existingCommitments || []).map(c => c.title)
        }

        // 4. Batch emails into groups of 8
        const BATCH_SIZE = 8
        const batches: EmailRow[][] = []
        for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
          batches.push(filtered.slice(i, i + BATCH_SIZE))
        }

        // Accumulate all found commitments
        const allCommitments: StreamCommitment[] = []
        let processedCount = 0

        // Process batches with concurrency of 3
        await processWithConcurrency(batches, 3, async (batch) => {
          try {
            const emailSummaries = batch.map(e => {
              const bodyPreview = e.body_text
                ? e.body_text.slice(0, 800)
                : (e.snippet || '').slice(0, 500)

              // Determine direction
              const fromLower = (e.from_address || '').toLowerCase()
              const isOutbound = (Array.isArray(e.labels) && e.labels.includes('SENT')) || OUTBOUND_PATTERNS.some(p => fromLower.includes(p))
              const toAddr = Array.isArray(e.to_addresses) ? e.to_addresses[0] : (e.to_addresses || '')

              return `---\nID: ${e.id}\nFrom: ${e.from_name || e.from_address}\nTo: ${toAddr}\nSubject: ${e.subject}\nDate: ${e.received_at}\nDirection: ${isOutbound ? 'OUTBOUND (user sent)' : 'INBOUND (user received)'}\nBody: ${bodyPreview}\n---`
            }).join('\n\n')

            let systemPrompt = `You extract commitments from a batch of emails. For INBOUND emails: ${INBOUND_EXTRACTION_SYSTEM}\nFor OUTBOUND emails: ${COMMITMENT_EXTRACTION_SYSTEM}\n\nReturn JSON: { "results": [{ "email_id": "...", "commitments": [{ "type", "title", "due_date", "confidence" }] }] }`

            if (personalizedBlock) {
              systemPrompt += '\n' + personalizedBlock
            }

            const aiRes = await ai.chat.completions.create({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Scan these ${batch.length} emails for commitments:\n\n${emailSummaries}` },
              ],
              temperature: 0.1,
              response_format: { type: 'json_object' },
            })

            const content = aiRes.choices?.[0]?.message?.content
            if (!content) {
              processedCount += batch.length
              send('progress', { processed: processedCount, total: filtered.length, found: allCommitments.length })
              return
            }

            const parsed = JSON.parse(content)

            // Extract commitments from batch results
            const batchCommitments: StreamCommitment[] = []

            for (const result of parsed.results || []) {
              const email = batch.find(e => e.id === result.email_id)
              if (!email) continue

              const fromLower = (email.from_address || '').toLowerCase()
              const isOutbound = (Array.isArray(email.labels) && email.labels.includes('SENT')) || OUTBOUND_PATTERNS.some(p => fromLower.includes(p))
              const emailToAddr = Array.isArray(email.to_addresses) ? email.to_addresses[0] : (email.to_addresses || '')

              for (const c of result.commitments || []) {
                if ((c.confidence || 0) < 0.5) continue

                batchCommitments.push({
                  type: c.type === 'waiting_on_them' ? 'they_promised' : c.type,
                  title: c.title,
                  contact_name: isOutbound ? null : (email.from_name || null),
                  contact_email: isOutbound ? (emailToAddr || '') : (email.from_address || ''),
                  deadline: c.due_date || null,
                  confidence: c.confidence,
                  source_subject: email.subject || null,
                  source_email_id: email.id,
                })
              }
            }

            // Post-filter this batch
            const { passed } = postFilterCommitments(
              batchCommitments.map(c => ({
                type: c.type,
                title: c.title,
                confidence: c.confidence,
                due_date: c.deadline,
              })),
              existingTitles,
            )

            // Stream each valid commitment
            const passedTitles = new Set(passed.map(p => p.title))
            for (const c of batchCommitments) {
              if (passedTitles.has(c.title)) {
                allCommitments.push(c)
                existingTitles.push(c.title) // Prevent cross-batch dupes

                send('commitment', {
                  data: {
                    type: c.type,
                    title: c.title,
                    contact_name: c.contact_name,
                    contact_email: c.contact_email,
                    deadline: c.deadline,
                    confidence: c.confidence,
                    source_subject: c.source_subject,
                  },
                })
              }
            }
          } catch (batchError) {
            send('error', {
              message: `Batch processing error: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`,
              batch_size: batch.length,
            })
          }

          // Update progress
          processedCount += batch.length
          send('progress', { processed: processedCount, total: filtered.length, found: allCommitments.length })
        })

        // 5. Persist to database using admin client (bypass RLS)
        const admin = createAdminClient()

        // Insert commitments
        if (allCommitments.length > 0) {
          const rows = allCommitments.map(c => ({
            user_id: user.id,
            type: c.type,
            contact_email: c.contact_email,
            contact_name: c.contact_name,
            title: c.title,
            source_type: 'email',
            source_email_id: c.source_email_id,
            deadline: c.deadline,
            confidence: c.confidence,
            status: 'pending',
          }))

          const { error: insertError } = await admin
            .from('commitments')
            .insert(rows)

          if (insertError) {
            send('error', { message: `Failed to save commitments: ${insertError.message}` })
          }
        }

        // Mark emails as commitment_scanned
        const emailIds = filtered.map(e => e.id)
        if (emailIds.length > 0) {
          const { error: updateError } = await admin
            .from('emails')
            .update({ commitment_scanned: true })
            .in('id', emailIds)

          if (updateError) {
            send('error', { message: `Failed to mark emails as scanned: ${updateError.message}` })
          }
        }

        // 6. Auto-score all commitments after scan
        try {
          const scoreResult = await calculateUrgencyScores(admin, user.id)
          console.log(`[Scan] Auto-scored ${scoreResult.updated}/${scoreResult.total} commitments`)
        } catch (err) {
          console.error('[Scan] Auto-scoring failed:', err)
        }

        // 7. Stream done event
        const iPromised = allCommitments.filter(c => c.type === 'i_promised').length
        const theyPromised = allCommitments.filter(c => c.type === 'they_promised').length

        send('done', {
          total_found: allCommitments.length,
          i_promised: iPromised,
          they_promised: theyPromised,
          duration_ms: Date.now() - startTime,
        })
      } catch (err) {
        const send = (type: string, data: Record<string, unknown>) => {
          try {
            controller.enqueue(new TextEncoder().encode(sseEvent(type, data)))
          } catch { /* client disconnected */ }
        }
        send('error', { message: `Scan failed: ${err instanceof Error ? err.message : 'Unknown error'}` })
        send('done', { total_found: 0, i_promised: 0, they_promised: 0, duration_ms: Date.now() - startTime })
      } finally {
        await new Promise(r => setTimeout(r, 500))
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
