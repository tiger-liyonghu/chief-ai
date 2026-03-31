/**
 * Sophia Context Engine — 分层注入
 *
 * 不是把所有数据塞进 prompt，而是根据用户消息的意图决定注入什么。
 *
 * 三层：
 *   永远注入（~300 tokens）：overdue commitments + 今日日历摘要 + alerts
 *   按需注入（意图匹配后加载）：承诺/联系人/出差/家庭/邮件 的详情
 *   不注入（工具去查）：具体邮件内容、历史消息、费用明细
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

// ─── Intent Detection（关键词匹配，零成本） ───

type Intent = 'schedule' | 'commitment' | 'person' | 'trip' | 'family' | 'email' | 'general' | 'emotional'

function detectIntent(message: string): Intent[] {
  const msg = message.toLowerCase()
  const intents: Intent[] = []

  // Schedule / calendar
  if (/日程|日历|安排|会议|schedule|calendar|meeting|today|明天|这周|下周|几点/.test(msg)) {
    intents.push('schedule')
  }

  // Commitments / follow-ups
  if (/承诺|逾期|overdue|跟进|follow|催|promise|deadline|到期|完成率/.test(msg)) {
    intents.push('commitment')
  }

  // Person / relationship
  if (/谁|联系人|关系|contact|Lisa|David|Sarah|张|Kevin|Tom|Maria|VIP|投资人|客户/.test(msg)) {
    intents.push('person')
  }

  // Trip / travel
  if (/出差|旅行|trip|travel|航班|flight|酒店|hotel|上海|东京|吉隆坡|北京|签证/.test(msg)) {
    intents.push('trip')
  }

  // Family
  if (/家|老婆|孩子|女儿|Emily|Emma|妈妈|钢琴|接送|生日|纪念日|family/.test(msg)) {
    intents.push('family')
  }

  // Email
  if (/邮件|回复|email|reply|draft|草拟|forward/.test(msg)) {
    intents.push('email')
  }

  // Emotional
  if (/累|烦|完了|怎么办|头疼|不行|喘不上气|tired|stressed|help|紧急|urgent/.test(msg)) {
    intents.push('emotional')
  }

  // If nothing matched, it's general — load core context
  if (intents.length === 0) {
    intents.push('general')
  }

  return intents
}

// ─── Core Context（永远注入，~300 tokens） ───

async function gatherCoreContext(admin: SupabaseClient, userId: string) {
  const now = new Date()
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const [profileResult, overdueResult, todayEventsResult] = await Promise.all([
    admin.from('profiles').select('timezone').eq('id', userId).single(),

    // Only overdue commitments (always relevant)
    admin
      .from('commitments')
      .select('type, contact_name, title, deadline, urgency_score')
      .eq('user_id', userId)
      .eq('status', 'overdue')
      .order('urgency_score', { ascending: false })
      .limit(5),

    // Upcoming events from NOW (not from midnight — past events are irrelevant)
    admin
      .from('calendar_events')
      .select('title, start_time', { count: 'exact', head: false })
      .eq('user_id', userId)
      .gte('start_time', now.toISOString())
      .lte('start_time', todayEnd.toISOString())
      .order('start_time', { ascending: true })
      .limit(3),
  ])

  return {
    timezone: profileResult.data?.timezone || 'Asia/Singapore',
    overdueCommitments: overdueResult.data || [],
    todayEventsSummary: todayEventsResult.data || [],
  }
}

// ─── On-Demand Context（按意图加载） ───

async function gatherScheduleContext(admin: SupabaseClient, userId: string, timezone: string) {
  const now = new Date()
  const weekEnd = new Date(Date.now() + 7 * 86400000)

  const [events, tasks] = await Promise.all([
    admin
      .from('calendar_events')
      .select('title, start_time, end_time, location, attendees')
      .eq('user_id', userId)
      .gte('start_time', now.toISOString())
      .lte('start_time', weekEnd.toISOString())
      .order('start_time', { ascending: true })
      .limit(10),
    admin
      .from('tasks')
      .select('title, priority, status, due_date')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .order('priority', { ascending: true })
      .limit(5),
  ])

  return { events: events.data || [], tasks: tasks.data || [] }
}

async function gatherCommitmentContext(admin: SupabaseClient, userId: string) {
  const [commitments, followUps] = await Promise.all([
    admin
      .from('commitments')
      .select('type, contact_name, contact_email, title, deadline, status, urgency_score, family_member')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress', 'overdue', 'waiting'])
      .order('urgency_score', { ascending: false })
      .limit(10),
    admin
      .from('follow_ups')
      .select('type, contact_name, subject, commitment_text, due_date')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(3),
  ])

  return { commitments: commitments.data || [], followUps: followUps.data || [] }
}

async function gatherPersonContext(admin: SupabaseClient, userId: string) {
  const [vipContacts] = await Promise.all([
    admin
      .from('contacts')
      .select('name, email, company, relationship, importance, last_contact_at')
      .eq('user_id', userId)
      .in('importance', ['vip', 'high'])
      .limit(10),
  ])

  return { vipContacts: vipContacts.data || [] }
}

async function gatherTripContext(admin: SupabaseClient, userId: string) {
  const [trips] = await Promise.all([
    admin
      .from('trips')
      .select('title, destination_city, start_date, end_date, status, family_conflicts')
      .eq('user_id', userId)
      .in('status', ['upcoming', 'active', 'pre_trip'])
      .order('start_date', { ascending: true })
      .limit(3),
  ])

  return { upcomingTrips: trips.data || [] }
}

async function gatherFamilyContext(admin: SupabaseClient, userId: string) {
  const [familyEvents] = await Promise.all([
    admin
      .from('family_calendar')
      .select('title, event_type, start_date, start_time, recurrence, recurrence_day, family_member')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(10),
  ])

  return { familyEvents: familyEvents.data || [] }
}

async function gatherEmailContext(admin: SupabaseClient, userId: string) {
  const [emails] = await Promise.all([
    admin
      .from('emails')
      .select('subject, from_name, from_address, snippet, received_at')
      .eq('user_id', userId)
      .eq('is_reply_needed', true)
      .order('received_at', { ascending: false })
      .limit(5),
  ])

  return { emails: emails.data || [] }
}

// ─── Main Entry Point ───

/**
 * Gather context based on user message intent.
 * @param message - Optional user message for intent detection. If not provided, loads general context.
 */
export async function gatherUserContext(
  admin: SupabaseClient,
  userId: string,
  message?: string,
): Promise<GatheredContext> {
  // 1. Always load core context (overdue + today summary)
  const core = await gatherCoreContext(admin, userId)
  const timezone = core.timezone

  // 2. Detect intent from message
  const intents = message ? detectIntent(message) : ['general']

  // 3. Load on-demand context based on intents
  const userContext: UserContext = {
    tasks: [],
    events: [],
    emails: [],
    followUps: [],
    commitments: [],
    vipContacts: [],
    upcomingTrips: [],
    familyEvents: [],
    timezone,
  }

  // Core: always inject overdue commitments
  if (core.overdueCommitments.length > 0) {
    userContext.commitments = core.overdueCommitments.map(c => ({
      ...c, contact_email: null, family_member: null, status: 'overdue',
    }))
  }

  // Core: today's calendar summary
  userContext.events = core.todayEventsSummary.map(e => ({
    ...e, end_time: '', location: null,
  }))

  // On-demand loading (parallel for matched intents)
  const loaders: Promise<void>[] = []

  if (intents.includes('schedule') || intents.includes('general')) {
    loaders.push(
      gatherScheduleContext(admin, userId, timezone).then(data => {
        userContext.events = data.events
        userContext.tasks = data.tasks
      })
    )
  }

  if (intents.includes('commitment') || intents.includes('general') || intents.includes('emotional')) {
    loaders.push(
      gatherCommitmentContext(admin, userId).then(data => {
        userContext.commitments = data.commitments
        userContext.followUps = data.followUps
      })
    )
  }

  if (intents.includes('person') || intents.includes('general')) {
    loaders.push(
      gatherPersonContext(admin, userId).then(data => {
        userContext.vipContacts = data.vipContacts
      })
    )
  }

  if (intents.includes('trip')) {
    loaders.push(
      gatherTripContext(admin, userId).then(data => {
        userContext.upcomingTrips = data.upcomingTrips
      })
    )
    // Trips always need family context too (conflict detection)
    loaders.push(
      gatherFamilyContext(admin, userId).then(data => {
        userContext.familyEvents = data.familyEvents
      })
    )
  }

  if (intents.includes('family')) {
    loaders.push(
      gatherFamilyContext(admin, userId).then(data => {
        userContext.familyEvents = data.familyEvents
      })
    )
  }

  if (intents.includes('email')) {
    loaders.push(
      gatherEmailContext(admin, userId).then(data => {
        userContext.emails = data.emails
      })
    )
  }

  await Promise.all(loaders)

  // 4. Format context
  const contextBlock = formatUserContext(userContext)

  // 5. Alerts (always, best-effort)
  let alertResult: AlertResult | null = null
  let alertsBlock = ''
  try {
    alertResult = await detectAlerts(admin, userId)
    if (alertResult.alerts.length > 0) {
      alertsBlock = `\n\n--- BACKGROUND ALERTS ---\n${formatAlertsForPrompt(alertResult)}\n--- END ALERTS ---`
    }
  } catch {
    // best-effort
  }

  return {
    userContext,
    alertResult,
    contextBlock,
    alertsBlock,
    timezone,
  }
}
