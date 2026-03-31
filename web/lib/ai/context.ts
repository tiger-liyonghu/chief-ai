/**
 * Shared context gathering logic for AI interactions.
 * Used by: chat API route, WhatsApp AI handler, briefing API.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  formatUserContext,
  type UserContext,
} from '@/lib/ai/prompts/chat'
import { detectAlerts, formatAlertsForPrompt, type AlertResult } from '@/lib/alerts/detect'

export interface GatheredContext {
  userContext: UserContext
  alertResult: AlertResult | null
  contextBlock: string
  alertsBlock: string
  timezone: string
}

/**
 * Gather all user context needed for AI interactions:
 * tasks, calendar events, emails, follow-ups, alerts, and timezone.
 */
export async function gatherUserContext(
  admin: SupabaseClient,
  userId: string,
): Promise<GatheredContext> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const todayISO = new Date().toISOString().slice(0, 10)

  const [profileResult, tasksResult, eventsResult, emailsResult, followUpsResult, commitmentsResult, vipContactsResult, tripsResult, familyResult] =
    await Promise.all([
      // User profile for timezone
      admin
        .from('profiles')
        .select('timezone')
        .eq('id', userId)
        .single(),

      // Pending tasks, top 5 by priority
      admin
        .from('tasks')
        .select('title, priority, status, due_date')
        .eq('user_id', userId)
        .in('status', ['pending', 'in_progress'])
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(5),

      // Today's calendar events
      admin
        .from('calendar_events')
        .select('title, start_time, end_time, location')
        .eq('user_id', userId)
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString())
        .order('start_time', { ascending: true }),

      // Recent emails needing reply, top 5
      admin
        .from('emails')
        .select('subject, from_name, from_address, snippet, received_at')
        .eq('user_id', userId)
        .eq('is_reply_needed', true)
        .order('received_at', { ascending: false })
        .limit(5),

      // Active follow-ups, top 3
      admin
        .from('follow_ups')
        .select('type, contact_name, subject, commitment_text, due_date')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(3),

      // Active commitments — sorted by urgency (overdue first)
      admin
        .from('commitments')
        .select('type, contact_name, contact_email, title, deadline, status, urgency_score, family_member')
        .eq('user_id', userId)
        .in('status', ['pending', 'in_progress', 'overdue', 'waiting'])
        .order('urgency_score', { ascending: false })
        .limit(10),

      // VIP and high-importance contacts
      admin
        .from('contacts')
        .select('name, email, company, relationship, importance, last_contact_at')
        .eq('user_id', userId)
        .in('importance', ['vip', 'high'])
        .limit(10),

      // Upcoming trips (next 30 days)
      admin
        .from('trips')
        .select('title, destination_city, start_date, end_date, status, family_conflicts')
        .eq('user_id', userId)
        .in('status', ['upcoming', 'active', 'pre_trip'])
        .order('start_date', { ascending: true })
        .limit(3),

      // Today's family events (recurring + one-off)
      admin
        .from('family_calendar')
        .select('title, event_type, start_date, start_time, recurrence, recurrence_day, family_member')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(10),
    ])

  const timezone = profileResult.data?.timezone || 'Asia/Singapore'

  const userContext: UserContext = {
    tasks: tasksResult.data || [],
    events: eventsResult.data || [],
    emails: emailsResult.data || [],
    followUps: followUpsResult.data || [],
    commitments: commitmentsResult.data || [],
    vipContacts: vipContactsResult.data || [],
    upcomingTrips: tripsResult.data || [],
    familyEvents: familyResult.data || [],
    timezone,
  }

  const contextBlock = formatUserContext(userContext)

  // Detect alerts (best-effort -- don't block if it fails)
  let alertResult: AlertResult | null = null
  let alertsBlock = ''
  try {
    alertResult = await detectAlerts(admin, userId)
    if (alertResult.alerts.length > 0) {
      alertsBlock = `\n\n--- BACKGROUND ALERTS (only mention if directly relevant to user's question) ---\n${formatAlertsForPrompt(alertResult)}\n--- END BACKGROUND ALERTS ---`
    }
  } catch {
    // Alert detection is best-effort
  }

  return {
    userContext,
    alertResult,
    contextBlock,
    alertsBlock,
    timezone,
  }
}
