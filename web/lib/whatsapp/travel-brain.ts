/**
 * Travel Brain — Sophia's travel intelligence layer.
 * Handles: pre-trip bible, landing briefing, cultural brief, local recommendations.
 * Proactively pushes via WhatsApp at the right time.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import OpenAI from 'openai'
import { getConnection } from '@/lib/whatsapp/client'

function getLLM(): OpenAI {
  return new OpenAI({
    baseURL: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
    apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '',
  })
}
const MODEL = () => process.env.LLM_MODEL || 'deepseek-chat'

import { wasNotificationSent, markNotificationSent } from '@/lib/whatsapp/notification-log'

// ── Scheduler ──

export function startTravelScheduler(): void {
  setInterval(checkTravelEvents, 10 * 60 * 1000) // every 10 min
  console.log('[Sophia] Travel brain scheduler started')
}

async function checkTravelEvents(): Promise<void> {
  const supabase = createAdminClient()
  const { data: connections } = await supabase
    .from('whatsapp_connections')
    .select('user_id')
    .eq('status', 'active')

  if (!connections) return

  for (const conn of connections) {
    try {
      await checkPreTrip(conn.user_id)
      await checkLanding(conn.user_id)
    } catch (err) {
      console.error(`[Sophia] Travel check error for ${conn.user_id}:`, err)
    }
  }
}

// ── Pre-Trip Bible (1 day before departure) ──

async function checkPreTrip(userId: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('timezone').eq('id', userId).single()
  const tz = profile?.timezone || 'Asia/Singapore'
  const now = new Date()
  const today = now.toLocaleDateString('en-CA', { timeZone: tz })
  const tomorrowDate = new Date(now.getTime() + 86400000)
  const tomorrow = tomorrowDate.toLocaleDateString('en-CA', { timeZone: tz })

  const { data: trips } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', userId)
    .in('start_date', [today, tomorrow])
    .eq('status', 'upcoming')

  if (!trips) return

  for (const trip of trips) {
    if (await wasNotificationSent(userId, 'pre_trip', trip.id, today)) continue
    await markNotificationSent(userId, 'pre_trip', trip.id, today)
    await sendPreTripBible(userId, trip)
    // Mark trip as active
    await supabase.from('trips').update({ status: 'active' }).eq('id', trip.id)
  }
}

async function sendPreTripBible(userId: string, trip: any): Promise<void> {
  const sock = getConnection(userId)
  if (!sock?.user) return

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .single()
  const tz = profile?.timezone || 'Asia/Singapore'

  // Gather context
  const [eventsRes, contactsRes] = await Promise.all([
    // Events during trip
    supabase
      .from('calendar_events')
      .select('title, start_time, end_time, location, attendees')
      .eq('user_id', userId)
      .gte('start_time', `${trip.start_date}T00:00:00`)
      .lte('start_time', `${trip.end_date}T23:59:59`)
      .order('start_time'),
    // Contacts in destination city
    supabase
      .from('contacts')
      .select('name, company, role, last_contact_at')
      .eq('user_id', userId)
      .not('name', 'is', null)
      .limit(100),
  ])

  const events = eventsRes.data || []
  const contacts = contactsRes.data || []

  const prompt = buildPreTripPrompt(trip, events, contacts, tz)
  const briefing = await callLLM(PRE_TRIP_SYSTEM, prompt)
  if (!briefing) return

  await sendToSelfChat(userId, sock, briefing)
  console.log(`[Sophia] Pre-trip bible sent for trip ${trip.id} (${trip.destination_city})`)
}

const PRE_TRIP_SYSTEM = `你是 Sophia，老板的 AI 首席幕僚。现在生成出差行前整理。

格式要求：
- 以 🍎 开头
- 分为几个小节：行程、工作安排、提醒
- 每个小节用换行分隔，不用 markdown 标题
- 简洁实用，不要废话
- 如果有航班信息就列出，没有就跳过
- 如果有会议就列出时间和地点
- 加上实用提醒（入境要求、交通建议、汇率等）
- 整体不超过 15 行`

function buildPreTripPrompt(trip: any, events: any[], contacts: any[], tz: string): string {
  const parts = [`出差信息：
目的地：${trip.destination_city || ''}, ${trip.destination_country || ''}
日期：${trip.start_date} ~ ${trip.end_date}
航班：${trip.flight_info ? JSON.stringify(trip.flight_info) : '未知'}
酒店：${trip.hotel_info ? JSON.stringify(trip.hotel_info) : '未知'}`]

  if (events.length > 0) {
    parts.push(`\n出差期间的会议（${events.length}个）：`)
    for (const e of events) {
      const start = new Date(e.start_time).toLocaleString('zh-CN', { timeZone: tz, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      parts.push(`- ${start} ${e.title}${e.location ? ' @ ' + e.location : ''}`)
    }
  }

  parts.push(`\n请生成行前整理，包含行程概览、工作安排、实用提醒。`)
  return parts.join('\n')
}

// ── Landing Briefing ──

async function checkLanding(userId: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('timezone').eq('id', userId).single()
  const tz = profile?.timezone || 'Asia/Singapore'
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz })

  const { data: trips } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', userId)
    .eq('start_date', today)
    .eq('status', 'active')

  if (!trips) return

  for (const trip of trips) {
    if (await wasNotificationSent(userId, 'landing', trip.id, today)) continue
    // Check if it's after estimated arrival time (use user's timezone)
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false })
    const hour = parseInt(formatter.formatToParts(new Date()).find(p => p.type === 'hour')?.value || '0')
    if (hour < 10) continue // Too early, wait until at least 10am local
    await markNotificationSent(userId, 'landing', trip.id, today)
    await sendLandingBriefing(userId, trip)
  }
}

async function sendLandingBriefing(userId: string, trip: any): Promise<void> {
  const sock = getConnection(userId)
  if (!sock?.user) return

  const prompt = `老板刚到达 ${trip.destination_city || '目的地'}（${trip.destination_country || ''}）。
出差日期：${trip.start_date} ~ ${trip.end_date}
请生成落地简报，包含：
1. 当地时间和与新加坡的时差
2. 当天剩余安排
3. 交通建议（打车软件、注意事项）
4. 汇率
5. 晚上的推荐（如果没安排的话）`

  const briefing = await callLLM(LANDING_SYSTEM, prompt)
  if (!briefing) return

  await sendToSelfChat(userId, sock, briefing)
  console.log(`[Sophia] Landing briefing sent for trip ${trip.id}`)
}

const LANDING_SYSTEM = `你是 Sophia，老板的 AI 首席幕僚。老板刚到达出差目的地。
生成一条简短的落地简报。

格式要求：
- 以 🍎 开头，"老板，XX落地了。"
- 列出当地时间、时差、汇率、交通建议
- 如果今天没安排，推荐一个当地值得去的地方
- 不超过 8 行
- 不要用 markdown 标题`

// ── Cultural Brief (called on demand) ──

export async function generateCulturalBrief(country: string): Promise<string | null> {
  const prompt = `国家/城市：${country}
请生成商务文化简报，包含：
1. 见面礼仪（握手/鞠躬/名片交换）
2. 饮食注意（宗教禁忌、餐桌礼仪、敬酒文化）
3. 着装要求
4. 禁忌事项
5. 实用小贴士`

  return callLLM(CULTURAL_SYSTEM, prompt)
}

const CULTURAL_SYSTEM = `你是 Sophia，生成当地商务文化简报。
- 以 🍎 开头
- 实用、具体、不要泛泛而谈
- 列出真正会踩的坑
- 不超过 10 行
- 不要用 markdown 标题`

// ── Local Recommendations (called on demand via tool) ──

export async function generateLocalRecommendations(
  city: string,
  scenario: 'business_dinner' | 'casual_meal' | 'evening' | 'weekend' | 'gift',
  preferences?: string,
  guestPreferences?: string,
): Promise<string | null> {
  const scenarioLabels: Record<string, string> = {
    business_dinner: '商务宴请',
    casual_meal: '自己吃饭',
    evening: '晚上消遣',
    weekend: '周末半日游',
    gift: '伴手礼',
  }

  const prompt = `城市：${city}
场景：${scenarioLabels[scenario] || scenario}
${preferences ? `老板偏好：${preferences}` : ''}
${guestPreferences ? `客户偏好：${guestPreferences}` : ''}

请推荐 2-3 个选项，每个包含：
- 名称
- 为什么推荐（一句话）
- 价位/距离等实用信息`

  return callLLM(RECOMMENDATION_SYSTEM, prompt)
}

const RECOMMENDATION_SYSTEM = `你是 Sophia，推荐当地的餐厅/体验/礼品。
- 以 🍎 开头
- 推荐本地人去的地方，不要旅游景点
- 如果有客户偏好（如清真、不喝酒），必须匹配
- 每个选项 2-3 行
- 不要用 markdown 标题
- 实用为主：价位、距离、是否需要预订`

// ── Meeting Pre-Brief (called before meetings) ──

export async function generateMeetingPreBrief(
  userId: string,
  eventTitle: string,
  attendeeInfo: string,
): Promise<string | null> {
  // Get contact interaction history
  const prompt = `会议：${eventTitle}
参会人信息：${attendeeInfo}

请生成会前简报，包含：
1. 对方的背景（如果有）
2. 你们之间的历史交互（如果有）
3. 对方公司近况（如果知道）
4. 建议聊什么/注意什么`

  return callLLM(MEETING_BRIEF_SYSTEM, prompt)
}

const MEETING_BRIEF_SYSTEM = `你是 Sophia，为老板准备会前简报。
- 以 🍎 开头
- 简短、有用、不编造
- 如果信息不足就如实说"我了解有限"
- 不超过 8 行`

// ── Helpers ──

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    const client = getLLM()
    const completion = await client.chat.completions.create({
      model: MODEL(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 800,
    })
    return completion.choices[0]?.message?.content?.trim() || null
  } catch (err) {
    console.error('[Sophia] LLM call error:', err)
    return null
  }
}

async function sendToSelfChat(userId: string, sock: any, text: string): Promise<void> {
  const supabase = createAdminClient()
  const myNumber = sock.user.id.split(':')[0]
  const myLid = sock.user.lid?.split(':')[0]
  const selfJid = myLid ? `${myLid}@lid` : `${myNumber}@s.whatsapp.net`

  await sock.sendMessage(selfJid, { text })

  await supabase.from('whatsapp_messages').insert({
    user_id: userId,
    wa_message_id: `travel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from_number: 'sophia',
    from_name: 'Sophia',
    to_number: myNumber,
    body: text,
    message_type: 'text',
    direction: 'inbound',
    received_at: new Date().toISOString(),
  })
}
