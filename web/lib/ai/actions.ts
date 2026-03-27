/**
 * Shared action parsing and execution logic.
 * Used by: chat API route, WhatsApp AI handler, briefing API.
 *
 * Supports two modes:
 * 1. Function calling (tool_calls) — preferred for providers that support it
 * 2. Text-based [ACTION:] parsing — fallback for providers without tool support
 */

import { getValidAccessToken } from '@/lib/google/tokens'
import {
  getMessage,
  parseEmailBody,
  createForwardEmail,
  sendMessage,
} from '@/lib/google/gmail'
import { TOOL_TO_ACTION_TYPE } from '@/lib/ai/tools'

export interface ParsedAction {
  type: string
  params: any
}

export interface ActionResult {
  type: string
  status: string
  detail?: string
}

/**
 * Execute a single tool call from the LLM's function calling response.
 * Maps tool names to legacy action types and delegates to executeActions().
 */
export async function executeToolCall(
  toolName: string,
  args: Record<string, any>,
  userId: string,
  admin: any,
): Promise<ActionResult> {
  const actionType = TOOL_TO_ACTION_TYPE[toolName]
  if (!actionType) {
    return { type: toolName, status: 'unknown_action' }
  }
  const results = await executeActions(
    [{ type: actionType, params: args }],
    userId,
    admin,
  )
  return results[0] || { type: actionType, status: 'error', detail: 'No result' }
}

/**
 * Parse [ACTION:TYPE]{json}[/ACTION] blocks from AI response text.
 */
export function parseActions(text: string): ParsedAction[] {
  const regex = new RegExp('\\[ACTION:(\\w+)\\](.*?)\\[\\/ACTION\\]', 'gs')
  const actions: ParsedAction[] = []
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

/**
 * Strip [ACTION:...]...[/ACTION] blocks from text, returning clean display text.
 */
export function stripActionBlocks(text: string): string {
  const regex = new RegExp('\\[ACTION:\\w+\\].*?\\[\\/ACTION\\]', 'gs')
  return text.replace(regex, '').trim()
}

/**
 * Execute parsed actions against Supabase and external services.
 */
export async function executeActions(
  actions: ParsedAction[],
  userId: string,
  admin: any,
): Promise<ActionResult[]> {
  const results: ActionResult[] = []

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
            await admin
              .from('tasks')
              .update({
                status: 'done',
                completed_at: new Date().toISOString(),
              })
              .eq('id', tasks[0].id)
            results.push({ type: 'COMPLETE_TASK', status: 'ok', detail: title })
          } else {
            results.push({ type: 'COMPLETE_TASK', status: 'not_found', detail: title })
          }
          break
        }
        case 'DRAFT_REPLY': {
          const { to, subject } = action.params
          results.push({
            type: 'DRAFT_REPLY',
            status: 'drafted',
            detail: `To: ${to}, Subject: ${subject}`,
          })
          break
        }
        case 'FORWARD_EMAIL': {
          const { subject_match, to } = action.params
          const { data: matchingEmails } = await admin
            .from('emails')
            .select('id, subject, from_name, from_address, snippet')
            .eq('user_id', userId)
            .ilike('subject', `%${subject_match}%`)
            .order('received_at', { ascending: false })
            .limit(1)

          if (!matchingEmails?.[0]) {
            results.push({
              type: 'FORWARD_EMAIL',
              status: 'not_found',
              detail: `No email matching "${subject_match}"`,
            })
            break
          }

          results.push({
            type: 'FORWARD_EMAIL',
            status: 'needs_confirmation',
            detail: `Ready to forward "${matchingEmails[0].subject}" to ${to}. Please confirm in the Forward panel.`,
          })
          break
        }
        case 'SEARCH': {
          const { query } = action.params
          const [emails, tasks] = await Promise.all([
            admin
              .from('emails')
              .select('subject, from_name, snippet')
              .eq('user_id', userId)
              .ilike('subject', `%${query}%`)
              .limit(3),
            admin
              .from('tasks')
              .select('title, status')
              .eq('user_id', userId)
              .ilike('title', `%${query}%`)
              .limit(3),
          ])
          results.push({
            type: 'SEARCH',
            status: 'ok',
            detail: `Found ${(emails.data?.length || 0) + (tasks.data?.length || 0)} results`,
          })
          break
        }
        case 'CREATE_EVENT': {
          const {
            title,
            start_time,
            end_time,
            attendee_emails,
            location,
            description,
            create_meet_link,
          } = action.params
          if (!title || !start_time || !end_time) {
            results.push({
              type: 'CREATE_EVENT',
              status: 'error',
              detail: 'Missing required fields: title, start_time, end_time',
            })
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

            const attendees = (googleEvent.attendees || []).map((a: any) => ({
              email: a.email,
              name: a.displayName,
              status: a.responseStatus,
            }))
            await admin.from('calendar_events').upsert(
              {
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
              },
              { onConflict: 'user_id,google_event_id' },
            )

            const meetInfo = googleEvent.hangoutLink
              ? ` (Meet: ${googleEvent.hangoutLink})`
              : ''
            results.push({
              type: 'CREATE_EVENT',
              status: 'ok',
              detail: `${title}${meetInfo}`,
            })
          } catch (err: any) {
            results.push({
              type: 'CREATE_EVENT',
              status: 'error',
              detail: err.message,
            })
          }
          break
        }
        case 'RECOMMEND_PLACE': {
          const { area, type: mealType, business_meal } = action.params
          try {
            const {
              getPlacesByAreaWithAdjacent,
              isPlaceOpenAt,
              getCategoriesForMealType,
            } = await import('@/lib/data/singapore-places')
            const effectiveArea = area || 'Raffles Place'
            const effectiveMealType = mealType || 'lunch'
            const categories = getCategoriesForMealType(effectiveMealType)
            const timeStr =
              effectiveMealType === 'breakfast'
                ? '08:00'
                : effectiveMealType === 'morning_break'
                  ? '10:00'
                  : effectiveMealType === 'lunch'
                    ? '12:00'
                    : effectiveMealType === 'afternoon_break'
                      ? '15:00'
                      : effectiveMealType === 'dinner'
                        ? '19:00'
                        : '22:00'

            const candidates = getPlacesByAreaWithAdjacent(effectiveArea)
              .filter((p) => isPlaceOpenAt(p, timeStr))
              .filter((p) => categories.includes(p.category))
              .filter((p) => !business_meal || p.businessMealSuitable)
              .sort((a, b) => b.rating - a.rating)
              .slice(0, 3)

            const detail =
              candidates.length > 0
                ? candidates
                    .map(
                      (p) =>
                        `${p.name} (${p.priceRange}, ${p.rating}) - ${p.description}`,
                    )
                    .join('\n')
                : 'No places found matching criteria'
            results.push({ type: 'RECOMMEND_PLACE', status: 'ok', detail })
          } catch (err: any) {
            results.push({
              type: 'RECOMMEND_PLACE',
              status: 'error',
              detail: err.message,
            })
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

/**
 * Format action results for WhatsApp display (plain text with emoji confirmations).
 */
export function formatActionResultsForWhatsApp(results: ActionResult[]): string {
  if (results.length === 0) return ''

  const lines: string[] = []
  for (const r of results) {
    switch (r.type) {
      case 'CREATE_TASK':
        if (r.status === 'ok') lines.push(`\u2705 Task created: ${r.detail}`)
        else lines.push(`\u274c Failed to create task: ${r.detail}`)
        break
      case 'COMPLETE_TASK':
        if (r.status === 'ok') lines.push(`\u2705 Task completed: ${r.detail}`)
        else lines.push(`\u26a0\ufe0f Task not found: ${r.detail}`)
        break
      case 'CREATE_EVENT':
        if (r.status === 'ok') lines.push(`\ud83d\udcc5 Event created: ${r.detail}`)
        else lines.push(`\u274c Failed to create event: ${r.detail}`)
        break
      case 'DRAFT_REPLY':
        lines.push(`\ud83d\udce7 Draft ready: ${r.detail}`)
        break
      case 'FORWARD_EMAIL':
        if (r.status === 'needs_confirmation')
          lines.push(`\ud83d\udce8 ${r.detail}`)
        else if (r.status === 'not_found')
          lines.push(`\u26a0\ufe0f ${r.detail}`)
        break
      case 'SEARCH':
        lines.push(`\ud83d\udd0d ${r.detail}`)
        break
      case 'RECOMMEND_PLACE':
        if (r.status === 'ok') lines.push(`\ud83c\udf7d\ufe0f ${r.detail}`)
        break
    }
  }
  return lines.join('\n')
}
