/**
 * Morning Briefing — Apple proactively pushes a daily battle plan via WhatsApp.
 * Runs on a timer, checks user's preferred briefing time, sends to self-chat.
 */

import { supabase } from './supabase'
import OpenAI from 'openai'
import { getConnection } from './client'
import { wasNotificationSent, markNotificationSent } from './notification-log'

const BRIEFING_SYSTEM = `你是 Apple，老板的 AI 首席幕僚。现在生成今日晨间简报。

格式要求：
- 以 🍎 开头
- 先打招呼（"老板早"或"Good morning boss"，看历史消息判断语言）
- 最多列 3-5 件最重要的事，不要贪多
- 逾期的承诺要用 ⚠️ 标出
- 用换行分隔，不用 bullet 符号
- 简短干练，整体不超过 10 行
- 不要用 markdown 标题或代码块
- 如果今天没什么特别的，就简短说"今天安排轻松"

内容优先级：
1. ⚠️ 逾期承诺/跟进（你答应的事过期了）
2. 今天的会议（时间+人+要准备什么）
3. 待回复邮件（等了超过2天的优先）
4. 紧急任务
5. Heads up（不紧急但应该知道的）`

export function startMorningBriefingScheduler(): void {
  // Check every minute for briefings and reminders
  setInterval(checkAndSendBriefings, 60 * 1000)
  // Check overdue items every 30 minutes
  setInterval(checkAndSendOverdueReminders, 30 * 60 * 1000)
  // Check for completed trips needing expense summary every hour
  setInterval(checkTripExpenseSummary, 60 * 60 * 1000)
  // Run scheduled custom agents every hour
  setInterval(runScheduledAgents, 60 * 60 * 1000)
  console.log('[Apple] Morning briefing + overdue reminder + expense + agent scheduler started')
}

async function checkAndSendBriefings(): Promise<void> {
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
      console.error(`[Apple] Briefing error for ${conn.user_id}:`, err)
    }
  }
}

async function maybeSendBriefing(userId: string, phoneNumber: string): Promise<void> {
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
  console.log(`[Apple] Sending morning briefing to ${userId} at ${userTime} ${tz}`)

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
    from_number: 'apple',
    from_name: 'Apple',
    to_number: myNumber,
    body: briefingText,
    message_type: 'text',
    direction: 'inbound',
    received_at: now.toISOString(),
  })

  console.log(`[Apple] Morning briefing sent to ${userId}`)
}

interface BriefingContext {
  date: string
  todayEvents: Array<{ title: string; start_time: string; end_time: string; location?: string; attendees?: any }>
  overdueFollowUps: Array<{ contact_name?: string; subject?: string; commitment_text?: string; due_date?: string; type: string }>
  pendingTasks: Array<{ title: string; priority: number; due_date?: string }>
  emailsNeedReply: Array<{ from_name?: string; from_address: string; subject: string; received_at: string; reply_urgency?: number }>
}

async function gatherBriefingContext(userId: string, tz: string): Promise<BriefingContext> {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const dayStart = `${todayStr}T00:00:00`
  const dayEnd = `${todayStr}T23:59:59`

  const [eventsRes, followUpsRes, tasksRes, emailsRes] = await Promise.all([
    // Today's events
    supabase
      .from('calendar_events')
      .select('title, start_time, end_time, location, attendees')
      .eq('user_id', userId)
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .order('start_time'),

    // Overdue follow-ups
    supabase
      .from('follow_ups')
      .select('contact_name, contact_email, subject, commitment_text, due_date, type')
      .eq('user_id', userId)
      .eq('status', 'active')
      .lte('due_date', todayStr)
      .order('due_date'),

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
  ])

  return {
    date: todayStr,
    todayEvents: eventsRes.data || [],
    overdueFollowUps: followUpsRes.data || [],
    pendingTasks: tasksRes.data || [],
    emailsNeedReply: emailsRes.data || [],
  }
}

async function generateBriefing(context: BriefingContext, tz: string): Promise<string | null> {
  const parts: string[] = [`今天是 ${context.date}，时区 ${tz}。`]

  if (context.overdueFollowUps.length > 0) {
    parts.push(`\n逾期跟进事项（${context.overdueFollowUps.length}个）：`)
    for (const f of context.overdueFollowUps) {
      const icon = f.type === 'i_promised' ? '你承诺的' : '等对方的'
      parts.push(`- ${icon}: ${f.contact_name || ''} ${f.subject || f.commitment_text || ''} (截止 ${f.due_date})`)
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
    console.error('[Apple] Briefing generation error:', err)
    return null
  }
}

// Manual trigger for testing
export async function triggerBriefingNow(userId: string): Promise<string | null> {
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
  const { data: connections } = await supabase
    .from('whatsapp_connections')
    .select('user_id, phone_number')
    .eq('status', 'active')

  if (!connections) return

  for (const conn of connections) {
    try {
      await maybeSendOverdueReminder(conn.user_id)
    } catch (err) {
      console.error(`[Apple] Overdue reminder error for ${conn.user_id}:`, err)
    }
  }
}

async function maybeSendOverdueReminder(userId: string): Promise<void> {
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

  // Check for newly overdue follow-ups (became overdue today)
  const { data: overdueFollowUps } = await supabase
    .from('follow_ups')
    .select('contact_name, subject, commitment_text, due_date, type')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('due_date', todayStr)

  // Check for overdue tasks
  const { data: overdueTasks } = await supabase
    .from('tasks')
    .select('title, due_date')
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress'])
    .lte('due_date', todayStr)
    .not('due_date', 'is', null)

  const items: string[] = []
  if (overdueFollowUps && overdueFollowUps.length > 0) {
    for (const f of overdueFollowUps) {
      const icon = f.type === 'i_promised' ? '你答应的' : '等对方的'
      items.push(`${icon}：${f.contact_name || ''} ${f.subject || f.commitment_text || ''}`)
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
    from_number: 'apple',
    from_name: 'Apple',
    to_number: myNumber,
    body: text,
    message_type: 'text',
    direction: 'inbound',
    received_at: new Date().toISOString(),
  })

  console.log(`[Apple] Overdue reminder sent to ${userId}: ${items.length} items`)
}

// ── Trip Expense Summary (post-trip) ──

// Expense summaries use notification_log for persistence

async function checkTripExpenseSummary(): Promise<void> {
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
      console.error(`[Apple] Expense summary error for trip ${trip.id}:`, err)
    }
  }
}

async function sendExpenseSummary(trip: any): Promise<void> {
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
    from_number: 'apple',
    from_name: 'Apple',
    to_number: myNumber,
    body: text,
    message_type: 'text',
    direction: 'inbound',
    received_at: new Date().toISOString(),
  })

  const summaryStr = [...totalByCurrency.entries()].map(([cur, total]) => `${cur} ${total.toFixed(0)}`).join(', ')
  console.log(`[Apple] Expense summary sent for trip ${trip.id}: ${summaryStr}`)
}

// ── Scheduled Custom Agents ──

async function runScheduledAgents(): Promise<void> {
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

      console.log(`[Apple] Running scheduled agent "${agent.name}" for ${agent.user_id}`)

      // Run agent with data access
      const { executeTool } = await import('./tools/registry')
      const { APPLE_TOOLS } = await import('./tools/registry')
      const dataTools = APPLE_TOOLS.filter((t: any) =>
        ['get_today_calendar', 'get_upcoming_events', 'get_pending_emails', 'get_tasks',
         'get_follow_ups', 'get_contact_info', 'search_company_news'].includes((t as any).function.name)
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
      console.log(`[Apple] Agent "${agent.name}" completed`)
    } catch (err) {
      console.error(`[Apple] Agent "${agent.name}" failed:`, err)
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
