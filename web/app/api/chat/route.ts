import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken } from '@/lib/google/tokens'
import {
  getMessage,
  parseEmailBody,
  createForwardEmail,
  sendMessage,
} from '@/lib/google/gmail'
import { createUserAIClient } from '@/lib/ai/unified-client'
import {
  CHAT_SYSTEM_PROMPT,
  formatUserContext,
  type UserContext,
} from '@/lib/ai/prompts/chat'
import { detectAlerts, formatAlertsForPrompt } from '@/lib/alerts/detect'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { message, history } = await request.json()

  if (!message || typeof message !== 'string') {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const admin = createAdminClient()

  // Gather user context in parallel
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const [profileResult, tasksResult, eventsResult, emailsResult, followUpsResult] =
    await Promise.all([
      // User profile for timezone
      admin
        .from('profiles')
        .select('timezone')
        .eq('id', user.id)
        .single(),

      // Pending tasks, top 5 by priority
      admin
        .from('tasks')
        .select('title, priority, status, due_date')
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(5),

      // Today's calendar events
      admin
        .from('calendar_events')
        .select('title, start_time, end_time, location')
        .eq('user_id', user.id)
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString())
        .order('start_time', { ascending: true }),

      // Recent emails needing reply, top 3
      admin
        .from('emails')
        .select('subject, from_name, from_address, snippet, received_at')
        .eq('user_id', user.id)
        .eq('is_reply_needed', true)
        .order('received_at', { ascending: false })
        .limit(3),

      // Active follow-ups, top 3
      admin
        .from('follow_ups')
        .select('type, contact_name, subject, commitment_text, due_date')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(3),
    ])

  const timezone = profileResult.data?.timezone || 'Asia/Singapore'

  const userContext: UserContext = {
    tasks: tasksResult.data || [],
    events: eventsResult.data || [],
    emails: emailsResult.data || [],
    followUps: followUpsResult.data || [],
    timezone,
  }

  const contextBlock = formatUserContext(userContext)

  // Detect alerts in parallel (non-blocking — if it fails, we continue without)
  let alertsBlock = ''
  try {
    const alertResult = await detectAlerts(admin, user.id)
    if (alertResult.alerts.length > 0) {
      alertsBlock = `\n\n--- ${formatAlertsForPrompt(alertResult)} ---`
    }
  } catch {
    // Alert detection is best-effort — don't block chat
  }

  // Build messages array
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: `${CHAT_SYSTEM_PROMPT}\n\n--- USER CONTEXT ---\n${contextBlock}${alertsBlock}`,
    },
  ]

  // Include chat history if provided
  if (Array.isArray(history)) {
    for (const msg of history) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content })
      }
    }
  }

  // Add the current message
  messages.push({ role: 'user', content: message })

  // Stream the response using user's configured LLM
  const { client, model } = await createUserAIClient(user.id)
  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 2048,
  })

  // Convert to ReadableStream for SSE
  const encoder = new TextEncoder()
  let fullResponse = ''

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content
          if (content) {
            fullResponse += content
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
            )
          }
        }

        // Parse and execute actions from the full response
        const actions = parseActions(fullResponse)
        if (actions.length > 0) {
          const results = await executeActions(actions, user.id, admin)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ actions: results })}\n\n`)
          )
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: errorMessage })}\n\n`
          )
        )
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// Parse [ACTION:TYPE]{json}[/ACTION] blocks from AI response
function parseActions(text: string): Array<{ type: string; params: any }> {
  const regex = new RegExp('\\[ACTION:(\\w+)\\](.*?)\\[\\/ACTION\\]', 'gs')
  const actions: Array<{ type: string; params: any }> = []
  let match
  while ((match = regex.exec(text)) !== null) {
    try {
      actions.push({ type: match[1], params: JSON.parse(match[2]) })
    } catch {
      // Skip malformed actions
    }
  }
  return actions
}

// Execute parsed actions
async function executeActions(
  actions: Array<{ type: string; params: any }>,
  userId: string,
  admin: any
): Promise<Array<{ type: string; status: string; detail?: string }>> {
  const results: Array<{ type: string; status: string; detail?: string }> = []

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'CREATE_TASK': {
          const { title, priority, due_date, due_reason } = action.params
          await admin.from('tasks').insert({
            user_id: userId,
            title,
            priority: priority || 2,
            status: 'pending',
            source_type: 'manual',
            due_date: due_date || null,
            due_reason: due_reason || null,
            ai_confidence: 1.0,
          })
          results.push({ type: 'CREATE_TASK', status: 'ok', detail: title })
          break
        }
        case 'COMPLETE_TASK': {
          const { title } = action.params
          const { data: tasks } = await admin
            .from('tasks')
            .select('id')
            .eq('user_id', userId)
            .ilike('title', `%${title}%`)
            .eq('status', 'pending')
            .limit(1)
          if (tasks?.[0]) {
            await admin.from('tasks').update({
              status: 'done',
              completed_at: new Date().toISOString(),
            }).eq('id', tasks[0].id)
            results.push({ type: 'COMPLETE_TASK', status: 'ok', detail: title })
          } else {
            results.push({ type: 'COMPLETE_TASK', status: 'not_found', detail: title })
          }
          break
        }
        case 'DRAFT_REPLY': {
          const { to, subject, body } = action.params
          // Store as a draft for user review — don't send
          results.push({ type: 'DRAFT_REPLY', status: 'drafted', detail: `To: ${to}, Subject: ${subject}` })
          break
        }
        case 'FORWARD_EMAIL': {
          const { subject_match, to, note } = action.params
          // Security: Forward requires user confirmation — don't auto-send
          const { data: matchingEmails } = await admin
            .from('emails')
            .select('id, subject, from_name, from_address, snippet')
            .eq('user_id', userId)
            .ilike('subject', `%${subject_match}%`)
            .order('received_at', { ascending: false })
            .limit(1)

          if (!matchingEmails?.[0]) {
            results.push({ type: 'FORWARD_EMAIL', status: 'not_found', detail: `No email matching "${subject_match}"` })
            break
          }

          // Return needs_confirmation instead of auto-sending
          results.push({
            type: 'FORWARD_EMAIL',
            status: 'needs_confirmation',
            detail: `Ready to forward "${matchingEmails[0].subject}" to ${to}. Please confirm in the Forward panel.`,
          })
          break
        }
        case 'FORWARD_EMAIL_CONFIRMED_DISABLED': {
          // Old auto-forward code — disabled for security
          const { subject_match, to, note } = action.params
          const { data: matchingEmails } = await admin
            .from('emails')
            .select('id, subject, from_name, from_address, snippet, gmail_id, received_at')
            .eq('user_id', userId)
            .ilike('subject', `%${subject_match}%`)
            .order('received_at', { ascending: false })
            .limit(1)

          if (!matchingEmails?.[0]) {
            results.push({ type: 'FORWARD_EMAIL', status: 'not_found', detail: `No email matching "${subject_match}"` })
            break
          }

          const emailRecord = matchingEmails[0]
          try {
            const accessToken = await getValidAccessToken(userId)

            // Get full body from Gmail
            let fullBody = emailRecord.snippet || ''
            if (emailRecord.gmail_id) {
              try {
                const gmailMsg = await getMessage(accessToken, emailRecord.gmail_id)
                const parsedBody = parseEmailBody(gmailMsg.payload)
                if (parsedBody) fullBody = parsedBody
              } catch { /* fall back to snippet */ }
            }

            const originalFrom = emailRecord.from_name
              ? `${emailRecord.from_name} <${emailRecord.from_address}>`
              : emailRecord.from_address

            const originalDate = emailRecord.received_at
              ? new Date(emailRecord.received_at).toLocaleString('en-US', {
                  weekday: 'short', year: 'numeric', month: 'short',
                  day: 'numeric', hour: '2-digit', minute: '2-digit',
                  timeZoneName: 'short',
                })
              : 'Unknown date'

            const raw = createForwardEmail(
              to,
              emailRecord.subject || '(no subject)',
              originalFrom,
              originalDate,
              fullBody,
              undefined,
              note || undefined,
            )

            await sendMessage(accessToken, raw)
            results.push({ type: 'FORWARD_EMAIL', status: 'ok', detail: `Forwarded "${emailRecord.subject}" to ${to}` })
          } catch (err: any) {
            results.push({ type: 'FORWARD_EMAIL', status: 'error', detail: err.message })
          }
          break
        }
        case 'SEARCH': {
          const { query } = action.params
          const [emails, tasks] = await Promise.all([
            admin.from('emails').select('subject, from_name, snippet')
              .eq('user_id', userId).ilike('subject', `%${query}%`).limit(3),
            admin.from('tasks').select('title, status')
              .eq('user_id', userId).ilike('title', `%${query}%`).limit(3),
          ])
          results.push({
            type: 'SEARCH',
            status: 'ok',
            detail: `Found ${(emails.data?.length || 0) + (tasks.data?.length || 0)} results`,
          })
          break
        }
        case 'CREATE_EVENT': {
          const { title, start_time, end_time, attendee_emails, location, description, create_meet_link } = action.params
          if (!title || !start_time || !end_time) {
            results.push({ type: 'CREATE_EVENT', status: 'error', detail: 'Missing required fields: title, start_time, end_time' })
            break
          }
          try {
            const accessToken = await getValidAccessToken(userId)
            const { createEvent } = await import('@/lib/google/calendar')
            const googleEvent = await createEvent(accessToken, {
              title,
              description: description || undefined,
              startTime: start_time,
              endTime: end_time,
              location: location || undefined,
              attendeeEmails: attendee_emails || [],
              createMeetLink: !!create_meet_link,
            })

            // Upsert into local calendar_events table
            const attendees = (googleEvent.attendees || []).map((a: any) => ({
              email: a.email,
              name: a.displayName,
              status: a.responseStatus,
            }))
            await admin.from('calendar_events').upsert({
              user_id: userId,
              google_event_id: googleEvent.id,
              title: googleEvent.summary,
              description: googleEvent.description || null,
              start_time: googleEvent.start?.dateTime || start_time,
              end_time: googleEvent.end?.dateTime || end_time,
              attendees: JSON.stringify(attendees),
              location: googleEvent.location || null,
              meeting_link: googleEvent.hangoutLink || null,
              is_recurring: false,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,google_event_id' })

            const meetInfo = googleEvent.hangoutLink ? ` (Meet: ${googleEvent.hangoutLink})` : ''
            results.push({ type: 'CREATE_EVENT', status: 'ok', detail: `${title}${meetInfo}` })
          } catch (err: any) {
            results.push({ type: 'CREATE_EVENT', status: 'error', detail: err.message })
          }
          break
        }
        case 'RECOMMEND_PLACE': {
          const { area, type: mealType, business_meal } = action.params
          try {
            const { getPlacesByAreaWithAdjacent, isPlaceOpenAt, determineMealType, getCategoriesForMealType } = await import('@/lib/data/singapore-places')
            const effectiveArea = area || 'Raffles Place'
            const effectiveMealType = mealType || 'lunch'
            const categories = getCategoriesForMealType(effectiveMealType)
            const timeStr = effectiveMealType === 'breakfast' ? '08:00' :
              effectiveMealType === 'morning_break' ? '10:00' :
              effectiveMealType === 'lunch' ? '12:00' :
              effectiveMealType === 'afternoon_break' ? '15:00' :
              effectiveMealType === 'dinner' ? '19:00' : '22:00'

            const candidates = getPlacesByAreaWithAdjacent(effectiveArea)
              .filter(p => isPlaceOpenAt(p, timeStr))
              .filter(p => categories.includes(p.category))
              .filter(p => !business_meal || p.businessMealSuitable)
              .sort((a, b) => b.rating - a.rating)
              .slice(0, 3)

            const detail = candidates.length > 0
              ? candidates.map(p => `${p.name} (${p.priceRange}, ${p.rating}) - ${p.description}`).join('\n')
              : 'No places found matching criteria'
            results.push({ type: 'RECOMMEND_PLACE', status: 'ok', detail })
          } catch (err: any) {
            results.push({ type: 'RECOMMEND_PLACE', status: 'error', detail: err.message })
          }
          break
        }
        default:
          results.push({ type: action.type, status: 'unknown_action' })
      }
    } catch (err) {
      results.push({ type: action.type, status: 'error', detail: String(err) })
    }
  }
  return results
}
