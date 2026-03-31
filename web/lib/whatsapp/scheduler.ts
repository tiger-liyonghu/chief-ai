/**
 * Morning Briefing — Sophia proactively pushes a daily battle plan via WhatsApp.
 * Runs on a timer, checks user's preferred briefing time, sends to self-chat.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import OpenAI from 'openai'
import { getConnection } from '@/lib/whatsapp/client'
import { wasNotificationSent, markNotificationSent } from '@/lib/whatsapp/notification-log'
import { startTravelScheduler } from '@/lib/whatsapp/travel-brain'
import { SOPHIE_BRIEFING_SYSTEM, SOPHIE_SELF_REVIEW_SYSTEM } from '@/lib/ai/prompts/sophia-voice'
import { createUserAIClient } from '@/lib/ai/unified-client'

const BRIEFING_SYSTEM = SOPHIE_BRIEFING_SYSTEM

export function startSchedulers(): void {
  startMorningBriefingScheduler()
  startTravelScheduler()
  startSelfReviewScheduler()
  startHeartbeatScheduler()
  startBehaviorAnalysisScheduler()
}

// 🧠 Brain — Analyze user behavior weekly
function startBehaviorAnalysisScheduler(): void {
  // Run every 24 hours, but only actually analyze weekly
  setInterval(checkAndRunBehaviorAnalysis, 24 * 60 * 60 * 1000)
  // Also run once on startup (after 5 min delay to let system settle)
  setTimeout(checkAndRunBehaviorAnalysis, 5 * 60 * 1000)
  console.log('[Sophia] Behavior analysis scheduler started (weekly)')
}

let lastBehaviorRun = 0

async function checkAndRunBehaviorAnalysis(): Promise<void> {
  const now = Date.now()
  const oneWeek = 7 * 24 * 60 * 60 * 1000
  if (now - lastBehaviorRun < oneWeek) return
  lastBehaviorRun = now

  const admin = createAdminClient()
  const { data: profiles } = await admin
    .from('profiles')
    .select('id')
    .not('onboarding_completed_at', 'is', null)
    .limit(50)

  if (!profiles) return

  const { analyzeBehavior } = await import('@/lib/ai/memory/behavior-model')

  for (const profile of profiles) {
    try {
      const result = await analyzeBehavior(admin, profile.id)
      console.log(`[Sophia] Behavior analyzed for ${profile.id}: ${result.data_points} data points`)
    } catch (err) {
      console.error(`[Sophia] Behavior analysis error for ${profile.id}:`, err)
    }
  }
}

// 🫀 Heart — Check intervention conditions every 30 minutes
function startHeartbeatScheduler(): void {
  setInterval(checkAndRunInterventions, 30 * 60 * 1000)
  console.log('[Sophia] Heart intervention scheduler started (every 30 min)')
}

async function checkAndRunInterventions(): Promise<void> {
  const admin = createAdminClient()
  const { data: connections } = await admin
    .from('whatsapp_connections')
    .select('user_id, phone_number')
    .eq('status', 'active')

  if (!connections) return

  const { checkInterventions, recordIntervention } = await import('@/lib/ai/heart/intervention')

  for (const conn of connections) {
    try {
      const interventions = await checkInterventions(admin, conn.user_id)
      if (interventions.length === 0) continue

      // Send only the most important one
      const intervention = interventions[0]
      const sock = getConnection(conn.user_id)
      if (!sock) continue

      const selfJid = `${conn.phone_number}@s.whatsapp.net`
      await sock.sendMessage(selfJid, { text: `🍎 ${intervention.message}` })
      await recordIntervention(admin, conn.user_id, intervention, 'whatsapp')
      console.log(`[Sophia] Heart intervention sent to ${conn.user_id}: ${intervention.type}`)
    } catch (err) {
      console.error(`[Sophia] Heart check error for ${conn.user_id}:`, err)
    }
  }
}

export function startMorningBriefingScheduler(): void {
  // Check every minute for briefings and reminders
  setInterval(checkAndSendBriefings, 60 * 1000)
  // Check overdue items every 30 minutes
  setInterval(checkAndSendOverdueReminders, 30 * 60 * 1000)
  // Check commitment alerts every 15 minutes
  setInterval(checkAndSendCommitmentAlerts, 15 * 60 * 1000)
  // Check for completed trips needing expense summary every hour
  setInterval(checkTripExpenseSummary, 60 * 60 * 1000)
  // Run scheduled custom agents every hour
  setInterval(runScheduledAgents, 60 * 60 * 1000)
  console.log('[Sophia] Morning briefing + overdue reminder + commitment alerts + expense + agent scheduler started')
}

async function checkAndSendBriefings(): Promise<void> {
  const supabase = createAdminClient()
  // Get all active connections
  const { data: connections } = await supabase
    .from('whatsapp_connections')
    .select('user_id, phone_number')
    .eq('status', 'active')

  if (!connections) return

  for (const conn of connections) {
    try {
      await maybeSendBriefing(conn.user_id, conn.phone_number)
    } catch (err) {
      console.error(`[Sophia] Briefing error for ${conn.user_id}:`, err)
    }
  }
}

async function maybeSendBriefing(userId: string, phoneNumber: string): Promise<void> {
  const supabase = createAdminClient()
  // Get user profile for timezone and briefing time
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone, daily_brief_time, daily_brief_enabled')
    .eq('id', userId)
    .single()

  if (!profile) return
  if (profile.daily_brief_enabled === false) return

  const tz = profile.timezone || 'Asia/Singapore'
  const briefTime = profile.daily_brief_time || '08:00'

  // Current time in user's timezone — use numeric comparison for reliability
  const now = new Date()
  const userDate = now.toLocaleDateString('en-CA', { timeZone: tz })
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false })
  const parts = formatter.formatToParts(now)
  const userHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
  const userMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
  const [briefHour, briefMinute] = briefTime.split(':').map(Number)

  // Check if it's briefing time (exact hour:minute match)
  if (userHour !== briefHour || userMinute !== briefMinute) return

  // Check if already sent today (persistent)
  if (await wasNotificationSent(userId, 'briefing', 'daily', userDate)) return

  // Check if WhatsApp is connected
  const sock = getConnection(userId)
  if (!sock?.user) return

  const userTime = `${String(userHour).padStart(2, '0')}:${String(userMinute).padStart(2, '0')}`
  console.log(`[Sophia] Sending morning briefing to ${userId} at ${userTime} ${tz}`)

  // Mark as sent before starting (prevent double-send)
  await markNotificationSent(userId, 'briefing', 'daily', userDate)

  // Gather context
  const context = await gatherBriefingContext(userId, tz)

  // Generate briefing via LLM
  const briefingText = await generateBriefing(context, tz)
  if (!briefingText) return

  // Send to self-chat
  const myNumber = sock.user.id.split(':')[0]
  const myLid = sock.user.lid?.split(':')[0]
  const selfJid = myLid ? `${myLid}@lid` : `${myNumber}@s.whatsapp.net`

  await sock.sendMessage(selfJid, { text: briefingText })

  // Store in DB
  await supabase.from('whatsapp_messages').insert({
    user_id: userId,
    wa_message_id: `briefing-${userDate}-${Math.random().toString(36).slice(2, 8)}`,
    from_number: 'sophia',
    from_name: 'Sophia',
    to_number: myNumber,
    body: briefingText,
    message_type: 'text',
    direction: 'inbound',
    received_at: now.toISOString(),
  })

  console.log(`[Sophia] Morning briefing sent to ${userId}`)
}

interface BriefingContext {
  date: string
  todayEvents: Array<{ title: string; start_time: string; end_time: string; location?: string; attendees?: any }>
  overdueCommitments: Array<{ contact_name?: string; title?: string; description?: string; deadline?: string; type: string }>
  pendingTasks: Array<{ title: string; priority: number; due_date?: string }>
  emailsNeedReply: Array<{ from_name?: string; from_address: string; subject: string; received_at: string; reply_urgency?: number }>
  commitmentsDueToday: Array<{ title?: string; contact_name?: string; type: string; deadline?: string }>
  commitmentsOverdue: Array<{ title?: string; contact_name?: string; type: string; days_overdue: number }>
  commitmentsThisWeek: number
}

async function gatherBriefingContext(userId: string, tz: string): Promise<BriefingContext> {
  const supabase = createAdminClient()
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const dayStart = `${todayStr}T00:00:00`
  const dayEnd = `${todayStr}T23:59:59`

  // Calculate end of week (Sunday) for this-week query
  const todayDate = new Date(todayStr)
  const daysUntilSunday = 7 - todayDate.getDay()
  const endOfWeek = new Date(todayDate.getTime() + daysUntilSunday * 86400000)
  const endOfWeekStr = endOfWeek.toISOString().split('T')[0]

  const [eventsRes, commitmentsRes, tasksRes, emailsRes, dueTodayRes, overdueRes, thisWeekRes] = await Promise.all([
    // Today's events
    supabase
      .from('calendar_events')
      .select('title, start_time, end_time, location, attendees')
      .eq('user_id', userId)
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .order('start_time'),

    // Overdue commitments (legacy query for briefing text generation)
    supabase
      .from('commitments')
      .select('contact_name, contact_email, title, description, deadline, type')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress', 'overdue'])
      .lte('deadline', todayStr)
      .order('deadline'),

    // Pending tasks (urgent + this week)
    supabase
      .from('tasks')
      .select('title, priority, due_date')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .lte('priority', 2)
      .order('priority')
      .limit(5),

    // Emails needing reply
    supabase
      .from('emails')
      .select('from_name, from_address, subject, received_at, reply_urgency')
      .eq('user_id', userId)
      .eq('is_reply_needed', true)
      .order('reply_urgency', { ascending: false })
      .limit(5),

    // Commitments due today
    supabase
      .from('commitments')
      .select('title, contact_name, type, deadline')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .eq('deadline', todayStr),

    // Overdue commitments (deadline < today)
    supabase
      .from('commitments')
      .select('title, contact_name, type, deadline')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .lt('deadline', todayStr),

    // Commitments this week (count)
    supabase
      .from('commitments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .gte('deadline', todayStr)
      .lte('deadline', endOfWeekStr),
  ])

  // Calculate days_overdue for each overdue commitment
  const commitmentsOverdue = (overdueRes.data || []).map(c => ({
    ...c,
    days_overdue: Math.floor(
      (new Date(todayStr).getTime() - new Date(c.deadline || todayStr).getTime()) / 86400000
    ),
  }))

  return {
    date: todayStr,
    todayEvents: eventsRes.data || [],
    overdueCommitments: commitmentsRes.data || [],
    pendingTasks: tasksRes.data || [],
    emailsNeedReply: emailsRes.data || [],
    commitmentsDueToday: dueTodayRes.data || [],
    commitmentsOverdue,
    commitmentsThisWeek: thisWeekRes.count || 0,
  }
}

async function generateBriefing(context: BriefingContext, tz: string): Promise<string | null> {
  const parts: string[] = [`今天是 ${context.date}，时区 ${tz}。`]

  if (context.overdueCommitments.length > 0) {
    parts.push(`\n逾期承诺事项（${context.overdueCommitments.length}个）：`)
    for (const f of context.overdueCommitments) {
      const icon = f.type === 'i_promised' ? '你承诺的' : '对方承诺的'
      parts.push(`- ${icon}: ${f.contact_name || ''} ${f.title || f.description || ''} (截止 ${f.deadline})`)
    }
  }

  if (context.todayEvents.length > 0) {
    parts.push(`\n今天的会议（${context.todayEvents.length}个）：`)
    for (const e of context.todayEvents) {
      const start = new Date(e.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: tz })
      parts.push(`- ${start} ${e.title}${e.location ? ' @ ' + e.location : ''}`)
    }
  }

  if (context.emailsNeedReply.length > 0) {
    parts.push(`\n待回复邮件（${context.emailsNeedReply.length}封）：`)
    for (const e of context.emailsNeedReply) {
      const ago = Math.floor((Date.now() - new Date(e.received_at).getTime()) / 86400000)
      parts.push(`- ${e.from_name || e.from_address}: "${e.subject}" (${ago}天前)`)
    }
  }

  if (context.commitmentsDueToday.length > 0) {
    parts.push(`\n今天到期的承诺（${context.commitmentsDueToday.length}个）：`)
    for (const c of context.commitmentsDueToday) {
      const icon = c.type === 'i_promised' ? '你承诺的' : '对方承诺的'
      parts.push(`- ${icon}: ${c.contact_name || ''} ${c.title || ''}`)
    }
  }

  if (context.commitmentsOverdue.length > 0) {
    parts.push(`\n逾期承诺（${context.commitmentsOverdue.length}个）：`)
    for (const c of context.commitmentsOverdue) {
      const icon = c.type === 'i_promised' ? '你承诺的' : '对方承诺的'
      parts.push(`- ${icon}: ${c.contact_name || ''} ${c.title || ''} (逾期${c.days_overdue}天)`)
    }
  }

  if (context.commitmentsThisWeek > 0) {
    parts.push(`\n本周还有 ${context.commitmentsThisWeek} 个承诺待完成。`)
  }

  if (context.pendingTasks.length > 0) {
    parts.push(`\n紧急任务（${context.pendingTasks.length}个）：`)
    for (const t of context.pendingTasks) {
      const due = t.due_date ? ` (截止 ${t.due_date})` : ''
      parts.push(`- ${t.title}${due}`)
    }
  }

  if (parts.length === 1) {
    parts.push('\n今天没有特别的安排。')
  }

  const userPrompt = parts.join('\n')

  try {
    const client = new OpenAI({
      baseURL: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
      apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '',
    })

    const completion = await client.chat.completions.create({
      model: process.env.LLM_MODEL || 'deepseek-chat',
      messages: [
        { role: 'system', content: BRIEFING_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 512,
    })

    return completion.choices[0]?.message?.content?.trim() || null
  } catch (err) {
    console.error('[Sophia] Briefing generation error:', err)
    return null
  }
}

// Manual trigger for testing
export async function triggerBriefingNow(userId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .single()

  const tz = profile?.timezone || 'Asia/Singapore'
  const context = await gatherBriefingContext(userId, tz)
  return generateBriefing(context, tz)
}

// ── Overdue Reminder ──

// Overdue reminders use notification_log with 4-hour window

async function checkAndSendOverdueReminders(): Promise<void> {
  const supabase = createAdminClient()
  const { data: connections } = await supabase
    .from('whatsapp_connections')
    .select('user_id, phone_number')
    .eq('status', 'active')

  if (!connections) return

  for (const conn of connections) {
    try {
      await maybeSendOverdueReminder(conn.user_id)
    } catch (err) {
      console.error(`[Sophia] Overdue reminder error for ${conn.user_id}:`, err)
    }
  }
}

async function maybeSendOverdueReminder(userId: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone, daily_brief_enabled')
    .eq('id', userId)
    .single()

  if (!profile || profile.daily_brief_enabled === false) return
  const tz = profile.timezone || 'Asia/Singapore'

  // Only send during working hours (9-18)
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false })
  const hour = parseInt(formatter.formatToParts(new Date()).find(p => p.type === 'hour')?.value || '0')
  if (hour < 9 || hour > 18) return

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz })

  // Max 1 overdue reminder per 4-hour window
  const windowId = `${todayStr}-${Math.floor(hour / 4)}`
  if (await wasNotificationSent(userId, 'overdue_reminder', windowId, todayStr)) return

  // Check for newly overdue commitments (became overdue today)
  const { data: overdueCommitments } = await supabase
    .from('commitments')
    .select('contact_name, title, description, deadline, type')
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress', 'overdue'])
    .eq('deadline', todayStr)

  // Check for overdue tasks
  const { data: overdueTasks } = await supabase
    .from('tasks')
    .select('title, due_date')
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress'])
    .lte('due_date', todayStr)
    .not('due_date', 'is', null)

  const items: string[] = []
  if (overdueCommitments && overdueCommitments.length > 0) {
    for (const f of overdueCommitments) {
      const icon = f.type === 'i_promised' ? '你答应的' : '对方承诺的'
      items.push(`${icon}：${f.contact_name || ''} ${f.title || f.description || ''}`)
    }
  }
  if (overdueTasks && overdueTasks.length > 0) {
    for (const t of overdueTasks) {
      items.push(`任务到期：${t.title}`)
    }
  }

  if (items.length === 0) return

  // Send reminder
  const sock = getConnection(userId)
  if (!sock?.user) return

  const myNumber = sock.user.id.split(':')[0]
  const myLid = sock.user.lid?.split(':')[0]
  const selfJid = myLid ? `${myLid}@lid` : `${myNumber}@s.whatsapp.net`

  const text = `🍎 老板，有 ${items.length} 件事今天到期：\n\n${items.join('\n')}\n\n需要我帮你处理哪个？`

  await sock.sendMessage(selfJid, { text })
  await markNotificationSent(userId, 'overdue_reminder', windowId, todayStr)

  // Store
  await supabase.from('whatsapp_messages').insert({
    user_id: userId,
    wa_message_id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from_number: 'sophia',
    from_name: 'Sophia',
    to_number: myNumber,
    body: text,
    message_type: 'text',
    direction: 'inbound',
    received_at: new Date().toISOString(),
  })

  console.log(`[Sophia] Overdue reminder sent to ${userId}: ${items.length} items`)
}

// ── Commitment Alert Scheduler ──

async function checkAndSendCommitmentAlerts(): Promise<void> {
  const supabase = createAdminClient()
  const { data: connections } = await supabase
    .from('whatsapp_connections')
    .select('user_id, phone_number')
    .eq('status', 'active')

  if (!connections) return

  for (const conn of connections) {
    try {
      await maybeSendCommitmentAlerts(conn.user_id)
    } catch (err) {
      console.error(`[Sophia] Commitment alert error for ${conn.user_id}:`, err)
    }
  }
}

async function maybeSendCommitmentAlerts(userId: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone, daily_brief_enabled')
    .eq('id', userId)
    .single()

  if (!profile || profile.daily_brief_enabled === false) return
  const tz = profile.timezone || 'Asia/Singapore'

  // Only send during working hours (9-18)
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false })
  const hour = parseInt(formatter.formatToParts(new Date()).find(p => p.type === 'hour')?.value || '0')
  if (hour < 9 || hour > 18) return

  const sock = getConnection(userId)
  if (!sock?.user) return

  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz })
  const tomorrowDate = new Date(now.getTime() + 86400000)
  const tomorrowStr = tomorrowDate.toLocaleDateString('en-CA', { timeZone: tz })

  // Fetch all active commitments with deadlines
  const { data: commitments } = await supabase
    .from('commitments')
    .select('id, contact_name, contact_email, title, description, type, deadline, status')
    .eq('user_id', userId)
    .in('type', ['i_promised', 'they_promised'])
    .in('status', ['pending', 'in_progress'])
    .not('deadline', 'is', null)

  if (!commitments || commitments.length === 0) return

  const myNumber = sock.user.id.split(':')[0]
  const myLid = sock.user.lid?.split(':')[0]
  const selfJid = myLid ? `${myLid}@lid` : `${myNumber}@s.whatsapp.net`

  for (const c of commitments) {
    const deadlineStr = c.deadline?.split('T')[0] || c.deadline
    if (!deadlineStr) continue

    const shortId = c.id.slice(0, 6)
    const contactName = c.contact_name || c.contact_email || '对方'
    const title = c.title || c.description || '(无标题)'

    let alertText: string | null = null
    let dedupKey: string | null = null

    if (deadlineStr === tomorrowStr) {
      // Due tomorrow — 24h alert
      dedupKey = `commitment_due_24h_${c.id}`
      if (await wasNotificationSent(userId, dedupKey, c.id, todayStr)) continue

      if (c.type === 'i_promised') {
        alertText = `⚠️ 老板，你答应了${contactName}明天前${title}，还剩不到24小时。\n\n回复操作：\n• 完成 ${shortId} → 标记完成\n• 起草 ${shortId} → 帮你起草邮件\n• 延期 ${shortId} → 延期7天`
      } else {
        alertText = `📌 提醒：${contactName}答应的「${title}」明天到期。\n\n回复操作：\n• 催 ${shortId} → 帮你发催促邮件\n• 完成 ${shortId} → 对方已完成`
      }
    } else if (deadlineStr === todayStr) {
      // Due today
      dedupKey = `commitment_due_today_${c.id}`
      if (await wasNotificationSent(userId, dedupKey, c.id, todayStr)) continue

      if (c.type === 'i_promised') {
        alertText = `🔴 今天到期：你答应了${contactName}「${title}」\n\n回复操作：\n• 完成 ${shortId} → 标记完成\n• 起草 ${shortId} → 帮你起草邮件`
      } else {
        alertText = `🔴 今天到期：${contactName}答应的「${title}」\n\n回复操作：\n• 催 ${shortId} → 帮你发催促邮件\n• 完成 ${shortId} → 对方已完成`
      }
    } else if (deadlineStr < todayStr) {
      // Overdue — send once per 24h
      dedupKey = `commitment_overdue_${c.id}`
      if (await wasNotificationSent(userId, dedupKey, c.id, todayStr)) continue

      const daysOverdue = Math.floor(
        (new Date(todayStr).getTime() - new Date(deadlineStr).getTime()) / 86400000
      )

      if (c.type === 'i_promised') {
        alertText = `⚠️ 老板，你答应${contactName}的「${title}」已经逾期${daysOverdue}天了。\n\n回复操作：\n• 完成 ${shortId} → 标记完成\n• 起草 ${shortId} → 帮你起草邮件\n• 延期 ${shortId} → 延期7天`
      } else {
        alertText = `📌 ${contactName} 答应的「${title}」已经逾期${daysOverdue}天了。\n\n回复操作：\n• 催 ${shortId} → 帮你发催促邮件\n• 完成 ${shortId} → 对方已完成\n• 升级 ${shortId} → 换种方式跟进`
      }
    }

    if (alertText && dedupKey) {
      await sock.sendMessage(selfJid, { text: alertText })
      await markNotificationSent(userId, dedupKey, c.id, todayStr)

      // Store in DB
      await supabase.from('whatsapp_messages').insert({
        user_id: userId,
        wa_message_id: `commitment-alert-${c.id.slice(0, 8)}-${Date.now()}`,
        from_number: 'sophia',
        from_name: 'Sophia',
        to_number: myNumber,
        body: alertText,
        message_type: 'text',
        direction: 'inbound',
        received_at: now.toISOString(),
      })

      console.log(`[Sophia] Commitment alert sent: ${dedupKey} for ${userId}`)
    }
  }
}

// ── Trip Expense Summary (post-trip) ──

// Expense summaries use notification_log for persistence

async function checkTripExpenseSummary(): Promise<void> {
  const supabase = createAdminClient()
  // Find trips that ended yesterday or today (give 1 day buffer)
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  const { data: completedTrips } = await supabase
    .from('trips')
    .select('id, user_id, title, destination_city, start_date, end_date')
    .in('end_date', [yesterday, today])
    .in('status', ['active', 'completed'])

  if (!completedTrips) return

  for (const trip of completedTrips) {
    if (await wasNotificationSent(trip.user_id, 'expense_summary', trip.id, today)) continue
    try {
      await sendExpenseSummary(trip)
      await markNotificationSent(trip.user_id, 'expense_summary', trip.id, today)
      // Mark trip as completed
      await supabase.from('trips').update({ status: 'completed' }).eq('id', trip.id)
    } catch (err) {
      console.error(`[Sophia] Expense summary error for trip ${trip.id}:`, err)
    }
  }
}

async function sendExpenseSummary(trip: any): Promise<void> {
  const supabase = createAdminClient()
  const sock = getConnection(trip.user_id)
  if (!sock?.user) return

  // Get all expenses for this trip
  const { data: expenses } = await supabase
    .from('trip_expenses')
    .select('category, merchant_name, amount, currency, expense_date')
    .eq('trip_id', trip.id)
    .order('expense_date')

  if (!expenses || expenses.length === 0) {
    // No expenses recorded — remind to submit
    const myNumber = sock.user.id.split(':')[0]
    const myLid = sock.user.lid?.split(':')[0]
    const selfJid = myLid ? `${myLid}@lid` : `${myNumber}@s.whatsapp.net`

    const text = `🍎 老板，${trip.title || trip.destination_city}出差结束了。\n还没有收到任何发票/收据，需要整理报销吗？拍照发给我就行。`
    await sock.sendMessage(selfJid, { text })
    return
  }

  // Group by category
  const categoryLabels: Record<string, string> = {
    flight: '✈️ 机票',
    hotel: '🏨 酒店',
    transport: '🚕 交通',
    meal: '🍽 餐饮',
    other: '📦 其他',
  }

  // Group by category AND currency to avoid cross-currency summing
  const byCatCurrency = new Map<string, { total: number; count: number }>()
  const currencySeen = new Set<string>()

  for (const exp of expenses) {
    const cur = exp.currency || 'SGD'
    currencySeen.add(cur)
    const key = `${exp.category || 'other'}|${cur}`
    const existing = byCatCurrency.get(key) || { total: 0, count: 0 }
    existing.total += exp.amount
    existing.count++
    byCatCurrency.set(key, existing)
  }

  // Grand totals per currency
  const totalByCurrency = new Map<string, number>()
  for (const [key, data] of byCatCurrency) {
    const cur = key.split('|')[1]
    totalByCurrency.set(cur, (totalByCurrency.get(cur) || 0) + data.total)
  }

  const lines = [`🍎 老板，${trip.title || trip.destination_city}出差报销整理好了（${trip.start_date} ~ ${trip.end_date}）：\n`]

  for (const [key, data] of byCatCurrency) {
    const [cat, cur] = key.split('|')
    const label = categoryLabels[cat] || cat
    lines.push(`${label}    ${cur} ${data.total.toFixed(0)}（${data.count}笔）`)
  }
  lines.push(`━━━━━━━━━━━`)
  for (const [cur, total] of totalByCurrency) {
    lines.push(`合计       ${cur} ${total.toFixed(0)}`)
  }

  // Check for missing receipts — look for booking emails without matching expenses
  const missingChecks: string[] = []
  const categories = new Set([...byCatCurrency.keys()].map(k => k.split('|')[0]))
  const hasHotel = categories.has('hotel')
  const hasFlight = categories.has('flight')
  if (!hasHotel) missingChecks.push('酒店发票')
  if (!hasFlight) missingChecks.push('机票行程单')

  if (missingChecks.length > 0) {
    lines.push(`\n⚠️ 还缺：${missingChecks.join('、')}`)
  }

  lines.push(`\n📎 需要导出报销单吗？`)

  const text = lines.join('\n')
  const myNumber = sock.user.id.split(':')[0]
  const myLid = sock.user.lid?.split(':')[0]
  const selfJid = myLid ? `${myLid}@lid` : `${myNumber}@s.whatsapp.net`

  await sock.sendMessage(selfJid, { text })

  await supabase.from('whatsapp_messages').insert({
    user_id: trip.user_id,
    wa_message_id: `expense-summary-${trip.id}-${Math.random().toString(36).slice(2, 8)}`,
    from_number: 'sophia',
    from_name: 'Sophia',
    to_number: myNumber,
    body: text,
    message_type: 'text',
    direction: 'inbound',
    received_at: new Date().toISOString(),
  })

  const summaryStr = [...totalByCurrency.entries()].map(([cur, total]) => `${cur} ${total.toFixed(0)}`).join(', ')
  console.log(`[Sophia] Expense summary sent for trip ${trip.id}: ${summaryStr}`)
}

// ── Scheduled Custom Agents ──

async function runScheduledAgents(): Promise<void> {
  const supabase = createAdminClient()
  const now = new Date()
  const dayOfWeek = now.getUTCDay() // 0=Sun, 1=Mon...
  const hour = now.getUTCHours()

  // Only run daily agents in the morning (8-9 UTC ~ afternoon in Asia)
  // and weekly agents on Monday
  const { data: agents } = await supabase
    .from('custom_agents')
    .select('id, user_id, name, system_prompt, schedule, last_run_at')
    .eq('is_active', true)
    .in('schedule', ['daily', 'weekly'])

  if (!agents) return

  for (const agent of agents) {
    try {
      const shouldRun = shouldRunAgent(agent, now, dayOfWeek, hour)
      if (!shouldRun) continue

      // Check dedup
      const todayStr = now.toISOString().split('T')[0]
      if (await wasNotificationSent(agent.user_id, `agent_${agent.id}`, agent.id, todayStr)) continue

      const sock = getConnection(agent.user_id)
      if (!sock?.user) continue

      console.log(`[Sophia] Running scheduled agent "${agent.name}" for ${agent.user_id}`)

      // Run agent with data access
      const { executeTool } = await import('@/lib/whatsapp/tools/registry')
      const { APPLE_TOOLS } = await import('@/lib/whatsapp/tools/registry')
      const dataTools = APPLE_TOOLS.filter((t: any) =>
        ['get_today_calendar', 'get_upcoming_events', 'get_pending_emails', 'get_tasks',
         'get_commitments', 'get_contact_info', 'search_company_news'].includes((t as any).function.name)
      )

      const OpenAI = (await import('openai')).default
      const client = new OpenAI({
        baseURL: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
        apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '',
      })

      const msgs: any[] = [
        { role: 'system', content: agent.system_prompt },
        { role: 'user', content: `今天是 ${todayStr}。请执行你的定期任务并汇报结果。` },
      ]

      let completion = await client.chat.completions.create({
        model: process.env.LLM_MODEL || 'deepseek-chat',
        messages: msgs,
        tools: dataTools.length > 0 ? dataTools : undefined,
        temperature: 0.5,
        max_tokens: 1000,
      })

      let assistantMsg = completion.choices[0]?.message
      let rounds = 0
      while (assistantMsg?.tool_calls && rounds < 3) {
        rounds++
        msgs.push(assistantMsg)
        for (const tc of assistantMsg.tool_calls) {
          let toolArgs: any = {}
          try { toolArgs = JSON.parse((tc as any).function.arguments || '{}') } catch {}
          const result = await executeTool(agent.user_id, (tc as any).function.name, toolArgs)
          msgs.push({ role: 'tool', tool_call_id: tc.id, content: result })
        }
        completion = await client.chat.completions.create({
          model: process.env.LLM_MODEL || 'deepseek-chat',
          messages: msgs,
          tools: dataTools,
          temperature: 0.5,
          max_tokens: 1000,
        })
        assistantMsg = completion.choices[0]?.message
      }

      const result = assistantMsg?.content?.trim()
      if (result) {
        const myNumber = sock.user.id.split(':')[0]
        const myLid = sock.user.lid?.split(':')[0]
        const selfJid = myLid ? `${myLid}@lid` : `${myNumber}@s.whatsapp.net`
        await sock.sendMessage(selfJid, { text: `🤖 *${agent.name}* 定期报告：\n\n${result}` })
      }

      await markNotificationSent(agent.user_id, `agent_${agent.id}`, agent.id, todayStr)
      await supabase.from('custom_agents').update({ last_run_at: now.toISOString() }).eq('id', agent.id)
      console.log(`[Sophia] Agent "${agent.name}" completed`)
    } catch (err) {
      console.error(`[Sophia] Agent "${agent.name}" failed:`, err)
    }
  }
}

function shouldRunAgent(agent: any, now: Date, dayOfWeek: number, hour: number): boolean {
  // Daily: run once per day, check if not run today
  if (agent.schedule === 'daily') {
    if (agent.last_run_at) {
      const lastRun = new Date(agent.last_run_at)
      if (lastRun.toISOString().split('T')[0] === now.toISOString().split('T')[0]) return false
    }
    return hour >= 8 && hour <= 10 // Run between 8-10 UTC
  }
  // Weekly: run on Monday
  if (agent.schedule === 'weekly') {
    if (dayOfWeek !== 1) return false // Monday only
    if (agent.last_run_at) {
      const daysSince = (now.getTime() - new Date(agent.last_run_at).getTime()) / 86400000
      if (daysSince < 6) return false
    }
    return hour >= 8 && hour <= 10
  }
  return false
}

// ── Self-Review Scheduler ──
// Sophia 的复盘引擎：每 8 小时用推理模型复核最近的承诺
// 对了 → 沉默。错了 → 先改数据库，再 WhatsApp 通知。

let lastSelfReviewRun = 0

function startSelfReviewScheduler(): void {
  // Run every 30 minutes, but only actually execute every 8 hours
  setInterval(checkAndRunSelfReview, 30 * 60 * 1000)
  console.log('[Sophia] Self-review scheduler started (every 8 hours)')
}

async function checkAndRunSelfReview(): Promise<void> {
  const now = Date.now()
  const eightHours = 8 * 60 * 60 * 1000
  if (now - lastSelfReviewRun < eightHours) return
  lastSelfReviewRun = now

  const admin = createAdminClient()
  const eightHoursAgo = new Date(now - eightHours).toISOString()

  // Find commitments created in the last 8 hours
  const { data: recentCommitments, error } = await admin
    .from('commitments')
    .select('id, user_id, type, title, contact_name, contact_email, deadline, status, source_email_id, confidence, created_at')
    .gte('created_at', eightHoursAgo)
    .in('status', ['pending', 'in_progress', 'overdue'])
    .order('created_at', { ascending: false })
    .limit(50)

  if (error || !recentCommitments || recentCommitments.length === 0) {
    console.log('[Sophia] Self-review: no recent commitments to review')
    return
  }

  // Group by user
  const byUser = new Map<string, typeof recentCommitments>()
  for (const c of recentCommitments) {
    const existing = byUser.get(c.user_id) || []
    existing.push(c)
    byUser.set(c.user_id, existing)
  }

  let totalReviewed = 0
  let totalFixed = 0
  let totalDeleted = 0

  for (const [userId, commitments] of byUser) {
    try {
      // Fetch source emails
      const emailIds = commitments.map(c => c.source_email_id).filter(Boolean)
      const emailMap = new Map<string, any>()
      if (emailIds.length > 0) {
        const { data: emails } = await admin
          .from('emails')
          .select('id, subject, from_address, to_address, body_text, date')
          .in('id', emailIds)
        for (const e of emails || []) emailMap.set(e.id, e)
      }

      // Build review items
      const reviewItems = commitments.map(c => {
        const email = c.source_email_id ? emailMap.get(c.source_email_id) : null
        return {
          commitment_id: c.id,
          type: c.type,
          title: c.title,
          contact_name: c.contact_name,
          contact_email: c.contact_email,
          deadline: c.deadline,
          confidence: c.confidence,
          source_email: email ? {
            subject: email.subject,
            from: email.from_address,
            to: email.to_address,
            date: email.date,
            body: (email.body_text || '').slice(0, 2000),
          } : null,
        }
      })

      // Call reasoning model
      const { client: ai } = await createUserAIClient(userId)
      const res = await ai.chat.completions.create({
        model: 'deepseek-reasoner',
        messages: [
          { role: 'system', content: SOPHIE_SELF_REVIEW_SYSTEM },
          { role: 'user', content: `请复核以下 ${reviewItems.length} 个承诺：\n\n${JSON.stringify(reviewItems, null, 2)}` },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      })

      const reviewResult = res.choices?.[0]?.message?.content
      if (!reviewResult) continue

      // Parse result
      let verdicts: any[] = []
      try {
        const jsonMatch = reviewResult.match(/\[[\s\S]*\]/) || reviewResult.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.all_correct) { totalReviewed += commitments.length; continue }
          verdicts = Array.isArray(parsed) ? parsed : [parsed]
        }
      } catch {
        console.error(`[Sophia] Self-review: failed to parse result for user ${userId}`)
        continue
      }

      // Process verdicts
      const userCorrections: string[] = []
      for (const verdict of verdicts) {
        if (!verdict.commitment_id || verdict.verdict === 'correct') continue
        const commitment = commitments.find(c => c.id === verdict.commitment_id)
        if (!commitment) continue

        if (verdict.verdict === 'should_delete') {
          await admin.from('commitments').delete().eq('id', verdict.commitment_id)
          totalDeleted++
          await admin.from('commitment_feedback').upsert({
            user_id: userId, commitment_id: verdict.commitment_id,
            feedback_type: 'rejected', original_title: commitment.title,
            llm_confidence: commitment.confidence,
            llm_rejected_reason: `Self-review: ${(verdict.issues || []).join('; ')}`,
          }, { onConflict: 'commitment_id' })
          userCorrections.push(`「${commitment.title}」不是承诺，已删除。${verdict.issues?.[0] ? `（${verdict.issues[0]}）` : ''}`)
        } else if (verdict.verdict === 'needs_fix' && verdict.fix) {
          const updates: Record<string, any> = { updated_at: new Date().toISOString() }
          for (const [field, value] of Object.entries(verdict.fix)) {
            if (['title', 'deadline', 'type', 'contact_name', 'contact_email', 'status'].includes(field)) {
              updates[field] = value
            }
          }
          if (Object.keys(updates).length > 1) {
            await admin.from('commitments').update(updates).eq('id', verdict.commitment_id)
            totalFixed++
            userCorrections.push(`「${commitment.title}」${verdict.issues?.[0] || '信息有误'}，已更正。`)
          }
        }
        totalReviewed++
      }

      // Send WhatsApp notification if corrections found
      if (userCorrections.length > 0) {
        const message = `🍎 复核了最近的承诺，有 ${userCorrections.length} 处修正：\n\n${userCorrections.join('\n')}`

        // Store as alert
        await admin.from('alerts').insert({
          user_id: userId, type: 'self_review_correction',
          title: `复核修正 ${userCorrections.length} 处`, body: message, severity: 'info',
        })

        // Send via WhatsApp
        try {
          const { data: waConn } = await admin
            .from('whatsapp_connections')
            .select('phone_number')
            .eq('user_id', userId).eq('status', 'active').single()
          if (waConn) {
            const sock = getConnection(userId)
            if (sock) {
              const selfJid = `${waConn.phone_number}@s.whatsapp.net`
              await sock.sendMessage(selfJid, { text: message })
            }
          }
        } catch (err) {
          console.error(`[Sophia] Self-review: failed to notify ${userId}:`, err)
        }
      }
    } catch (err) {
      console.error(`[Sophia] Self-review error for user ${userId}:`, err)
    }
  }

  console.log(`[Sophia] Self-review complete: reviewed=${totalReviewed}, fixed=${totalFixed}, deleted=${totalDeleted}`)
}
