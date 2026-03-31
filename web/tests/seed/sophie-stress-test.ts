/**
 * Sophie Stress Test — 压测种子数据
 *
 * 目标：创建高度真实的多国、多文化、多时区场景
 * - 15 个联系人（SG/CN/US/EU/IN/JP/KR）
 * - 8 个家庭日历事件（孩子辅导班、周末、纪念日）
 * - 2 趟出差（和家庭高度冲突）
 * - 20 个承诺（逾期/今天/本周/家庭/被阻塞）
 * - 12 个日历事件（填满一周）
 * - 30 封邮件（中英文混合）
 *
 * 用法：
 *   npx tsx tests/seed/sophie-stress-test.ts          # 灌入数据
 *   npx tsx tests/seed/sophie-stress-test.ts --clean   # 清除数据
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local manually
const envPath = resolve(__dirname, '../../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match && !process.env[match[1].trim()]) {
    process.env[match[1].trim()] = match[2].trim()
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Tiger's user ID — will be looked up dynamically
let USER_ID = ''
const USER_EMAIL = 'tigerliyonghu@gmail.com'

// ─── Helpers ───

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function dateTimeFromNow(days: number, hour: number, min = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}

function uuid(): string {
  return crypto.randomUUID()
}

// ─── Contacts（多国多文化） ───

function contacts() {
  return [
    // VIP 投资人
    { email: 'lisa.tan@temasek.com.sg', name: 'Lisa Tan', company: 'Temasek Holdings', role: 'Managing Director', relationship: 'investor', importance: 'vip' },
    { email: 'david.chen@sequoia.com', name: 'David Chen', company: 'Sequoia Capital', role: 'Partner', relationship: 'investor', importance: 'vip' },
    { email: 'maria.santos@gic.com.sg', name: 'Maria Santos', company: 'GIC', role: 'Investment Director', relationship: 'investor', importance: 'vip' },
    { email: 'tom.wilson@ycombinator.com', name: 'Tom Wilson', company: 'Y Combinator', role: 'Group Partner', relationship: 'investor', importance: 'vip' },
    // High — 各国客户
    { email: 'sarah.wong@grab.com', name: 'Sarah Wong', company: 'Grab', role: 'VP Product', relationship: 'client', importance: 'high' },
    { email: 'zhangwei@huaxin.cn', name: '张伟', company: '华信科技', role: 'CTO', relationship: 'client', importance: 'high' },
    { email: 'kevin.lim@monkshill.com', name: 'Kevin Lim', company: 'Monks Hill Ventures', role: 'Partner', relationship: 'investor', importance: 'high' },
    { email: 'daniel.ng@govtech.gov.sg', name: 'Daniel Ng', company: 'GovTech Singapore', role: 'Director', relationship: 'client', importance: 'high' },
    { email: 'tanaka.yuki@softbank.co.jp', name: '田中裕樹', company: 'SoftBank Vision Fund', role: 'Investment Manager', relationship: 'investor', importance: 'high' },
    // Normal — 合作伙伴 & 供应商
    { email: 'james.miller@stripe.com', name: 'James Miller', company: 'Stripe', role: 'Head of APAC Partnerships', relationship: 'partner', importance: 'normal' },
    { email: 'rachel.lim@wongpartners.sg', name: 'Rachel Lim', company: 'Wong & Partners LLP', role: 'Senior Associate', relationship: 'vendor', importance: 'normal' },
    { email: 'amy.zhang@dbs.com.sg', name: 'Amy Zhang', company: 'DBS Bank', role: 'Innovation Team Lead', relationship: 'client', importance: 'normal' },
    { email: 'michael.park@samsung.com', name: 'Michael Park (박민수)', company: 'Samsung NEXT', role: 'Director', relationship: 'partner', importance: 'normal' },
    { email: 'priya.mehta@razorpay.com', name: 'Priya Mehta', company: 'Razorpay', role: 'Head of International', relationship: 'partner', importance: 'normal' },
    { email: 'hans.weber@siemens.de', name: 'Hans Weber', company: 'Siemens AG', role: 'VP Digital', relationship: 'client', importance: 'normal' },
  ].map(c => ({
    id: uuid(),
    user_id: USER_ID,
    ...c,
    auto_detected: false,
    email_count: Math.floor(Math.random() * 30) + 5,
    last_contact_at: new Date(Date.now() - Math.random() * 14 * 86400000).toISOString(),
  }))
}

// ─── Family Calendar（孩子辅导班、周末、重要日期） ───

function familyCalendar() {
  return [
    // Emily (女儿, 8岁) — 辅导班密集
    {
      event_type: 'hard_constraint', title: 'Emily 钢琴课',
      start_date: daysFromNow(-30), recurrence: 'weekly', recurrence_day: 3, // 周三
      start_time: '15:30', end_time: '16:30', family_member: 'Emily',
    },
    {
      event_type: 'hard_constraint', title: 'Emily 游泳训练',
      start_date: daysFromNow(-30), recurrence: 'weekly', recurrence_day: 6, // 周六
      start_time: '09:00', end_time: '10:30', family_member: 'Emily',
    },
    {
      event_type: 'hard_constraint', title: 'Emily 学校接送',
      start_date: daysFromNow(-30), recurrence: 'daily',
      start_time: '14:45', end_time: '15:15', family_member: 'Emily',
      description: '周一到周五，周末和假期除外',
    },
    {
      event_type: 'hard_constraint', title: 'Emily 钢琴比赛 (Singapore Piano Festival)',
      start_date: daysFromNow(7), recurrence: 'none',
      start_time: '14:00', end_time: '17:00', family_member: 'Emily',
      description: '在 Esplanade Concert Hall，需要提前 1 小时到场',
    },
    // 老婆
    {
      event_type: 'important_date', title: '老婆生日',
      start_date: daysFromNow(4), recurrence: 'yearly',
      family_member: '老婆',
    },
    {
      event_type: 'important_date', title: '结婚纪念日',
      start_date: daysFromNow(11), recurrence: 'yearly',
      family_member: '老婆',
    },
    // 全家
    {
      event_type: 'family_commitment', title: '全家周日早午餐',
      start_date: daysFromNow(-30), recurrence: 'weekly', recurrence_day: 0, // 周日
      start_time: '10:00', end_time: '12:00', family_member: '全家',
    },
    // 妈妈
    {
      event_type: 'important_date', title: '妈妈体检 (Mount Elizabeth)',
      start_date: daysFromNow(9), recurrence: 'none',
      start_time: '09:00', end_time: '11:00', family_member: 'Mom',
      description: '需要陪同，带上之前的检查报告',
    },
    // 家庭聚餐
    {
      event_type: 'family_commitment', title: '家庭聚餐（爷爷奶奶来新加坡）',
      start_date: daysFromNow(5), recurrence: 'none',
      start_time: '18:00', end_time: '21:00', family_member: '全家',
      description: '在 Jumbo Seafood @ East Coast，已订位 8 人',
    },
  ].map(e => ({
    id: uuid(),
    user_id: USER_ID,
    ...e,
    is_active: true,
    source: 'manual',
  }))
}

// ─── Trips（和家庭高度冲突） ───

function trips() {
  return [
    {
      id: uuid(),
      user_id: USER_ID,
      title: '上海客户拜访 + 华信科技 CTO 会议',
      destination_city: 'Shanghai',
      destination_country: 'China',
      start_date: daysFromNow(6),
      end_date: daysFromNow(9),
      status: 'upcoming',
      timezone: 'Asia/Shanghai',
      flight_info: [
        { airline: 'Singapore Airlines', flight_no: 'SQ 830', departure: '08:00', arrival: '13:15', origin: 'SIN', destination: 'PVG', seat: '12A', terminal: 'T3' },
        { airline: 'Singapore Airlines', flight_no: 'SQ 833', departure: '14:30', arrival: '20:15', origin: 'PVG', destination: 'SIN', seat: '15C', terminal: 'T2' },
      ],
      hotel_info: [
        { name: 'Waldorf Astoria Shanghai on the Bund', confirmation: 'WA-2026-88821', checkin: daysFromNow(6), checkout: daysFromNow(9), address: '2 Zhongshan East 1st Rd, Huangpu' },
      ],
      family_conflicts: [
        { title: 'Emily 钢琴比赛', date: daysFromNow(7), family_member: 'Emily', conflict_type: 'hard_constraint' },
        { title: '妈妈体检', date: daysFromNow(9), family_member: 'Mom', conflict_type: 'important_date' },
      ],
    },
    {
      id: uuid(),
      user_id: USER_ID,
      title: '吉隆坡投资人路演 (Khazanah + CIMB)',
      destination_city: 'Kuala Lumpur',
      destination_country: 'Malaysia',
      start_date: daysFromNow(13),
      end_date: daysFromNow(15),
      status: 'upcoming',
      timezone: 'Asia/Kuala_Lumpur',
      flight_info: [
        { airline: 'Singapore Airlines', flight_no: 'SQ 116', departure: '09:00', arrival: '10:00', origin: 'SIN', destination: 'KUL', terminal: 'T2' },
        { airline: 'Singapore Airlines', flight_no: 'SQ 119', departure: '17:00', arrival: '18:00', origin: 'KUL', destination: 'SIN', terminal: 'KLIA' },
      ],
      hotel_info: [
        { name: 'Mandarin Oriental Kuala Lumpur', confirmation: 'MO-KL-9031', checkin: daysFromNow(13), checkout: daysFromNow(15), address: 'Kuala Lumpur City Centre' },
      ],
      family_conflicts: [
        { title: 'Emily 钢琴课', date: daysFromNow(15), family_member: 'Emily', conflict_type: 'weekly_conflict' },
      ],
    },
  ]
}

// ─── Commitments（20个，混合状态） ───

function commitments(contactMap: Map<string, string>) {
  const getContactId = (email: string) => contactMap.get(email) || null

  return [
    // ── 逾期（紧迫感）──
    { type: 'i_promised', contact_name: 'Lisa Tan', contact_email: 'lisa.tan@temasek.com.sg', title: '发送 DD checklist 给 Temasek', deadline: daysFromNow(-3), status: 'overdue', source_type: 'email', urgency_score: 8, confidence: 0.95 },
    { type: 'i_promised', contact_name: 'James Miller', contact_email: 'james.miller@stripe.com', title: 'Stripe APAC 定价方案', deadline: daysFromNow(-2), status: 'overdue', source_type: 'email', urgency_score: 7, confidence: 0.9 },
    { type: 'they_promised', contact_name: 'David Chen', contact_email: 'david.chen@sequoia.com', title: 'Sequoia term sheet 初稿', deadline: daysFromNow(-4), status: 'overdue', source_type: 'email', urgency_score: 9, confidence: 0.85 },

    // ── 今天到期 ──
    { type: 'i_promised', contact_name: 'Sarah Wong', contact_email: 'sarah.wong@grab.com', title: '共享 API 接入文档给 Grab 技术团队', deadline: daysFromNow(0), status: 'pending', source_type: 'email', urgency_score: 6, confidence: 0.92 },
    { type: 'i_promised', contact_name: '张伟', contact_email: 'zhangwei@huaxin.cn', title: '确认华信产品 demo 排期', deadline: daysFromNow(0), status: 'pending', source_type: 'email', urgency_score: 5, confidence: 0.88 },

    // ── 本周到期 ──
    { type: 'i_promised', contact_name: 'Tom Wilson', contact_email: 'tom.wilson@ycombinator.com', title: '确认 YC interview slot', deadline: daysFromNow(2), status: 'pending', source_type: 'email', urgency_score: 5, confidence: 0.95 },
    { type: 'i_promised', contact_name: 'Kevin Lim', contact_email: 'kevin.lim@monkshill.com', title: 'Monks Hill term sheet 反馈', deadline: daysFromNow(3), status: 'pending', source_type: 'email', urgency_score: 4, confidence: 0.9 },
    { type: 'they_promised', contact_name: 'Rachel Lim', contact_email: 'rachel.lim@wongpartners.sg', title: '法律合同审核完成', deadline: daysFromNow(2), status: 'waiting', source_type: 'email', urgency_score: 3, confidence: 0.85 },
    { type: 'they_promised', contact_name: 'Michael Park (박민수)', contact_email: 'michael.park@samsung.com', title: 'Samsung NEXT 合作意向书', deadline: daysFromNow(2), status: 'waiting', source_type: 'email', urgency_score: 3, confidence: 0.8 },
    { type: 'i_promised', contact_name: 'Amy Zhang', contact_email: 'amy.zhang@dbs.com.sg', title: 'DBS 创新团队 product demo', deadline: daysFromNow(5), status: 'pending', source_type: 'email', urgency_score: 2, confidence: 0.85 },

    // ── 家庭承诺 ──
    { type: 'family', contact_name: 'Emily', family_member: 'Emily', title: '钢琴比赛陪同 (Esplanade)', deadline: daysFromNow(7), status: 'pending', source_type: 'manual', urgency_score: 5, confidence: 1.0 },
    { type: 'family', contact_name: '老婆', family_member: '老婆', title: '结婚纪念日晚餐预订', deadline: daysFromNow(11), status: 'pending', source_type: 'manual', urgency_score: 3, confidence: 1.0 },

    // ── 出差相关 ──
    { type: 'i_promised', contact_name: '张伟', contact_email: 'zhangwei@huaxin.cn', title: '华信 CTO 会前准备资料（技术架构+安全白皮书）', deadline: daysFromNow(6), status: 'pending', source_type: 'email', urgency_score: 4, confidence: 0.9 },
    { type: 'i_promised', contact_name: 'Daniel Ng', contact_email: 'daniel.ng@govtech.gov.sg', title: 'GovTech pilot 方案提交', deadline: daysFromNow(7), status: 'pending', source_type: 'email', urgency_score: 3, confidence: 0.88 },
    { type: 'i_promised', contact_name: 'Maria Santos', contact_email: 'maria.santos@gic.com.sg', title: '完善 GIC 投资人数据室', deadline: daysFromNow(6), status: 'pending', source_type: 'email', urgency_score: 4, confidence: 0.9 },

    // ── 已完成（测试完成率） ──
    { type: 'i_promised', contact_name: 'Tom Wilson', contact_email: 'tom.wilson@ycombinator.com', title: '发送公司 pitch deck v3', deadline: daysFromNow(-6), status: 'done', source_type: 'email', urgency_score: 0, confidence: 0.95, completed_at: new Date(Date.now() - 5 * 86400000).toISOString() },
    { type: 'i_promised', contact_name: 'Sarah Wong', contact_email: 'sarah.wong@grab.com', title: '共享 Grab 集成测试报告', deadline: daysFromNow(-5), status: 'done', source_type: 'email', urgency_score: 0, confidence: 0.9, completed_at: new Date(Date.now() - 4 * 86400000).toISOString() },
    { type: 'they_promised', contact_name: 'Kevin Lim', contact_email: 'kevin.lim@monkshill.com', title: '发送投资意向确认', deadline: daysFromNow(-11), status: 'done', source_type: 'email', urgency_score: 0, confidence: 0.85, completed_at: new Date(Date.now() - 10 * 86400000).toISOString() },

    // ── 被阻塞（依赖链） ──
    { type: 'i_promised', contact_name: 'Lisa Tan', contact_email: 'lisa.tan@temasek.com.sg', title: '完整融资材料包（含 term sheet）', deadline: daysFromNow(5), status: 'pending', source_type: 'email', urgency_score: 6, confidence: 0.9, description: '依赖 David Chen 的 Sequoia term sheet 才能完成' },
    { type: 'i_promised', contact_name: 'David Chen', contact_email: 'david.chen@sequoia.com', title: '回复 Sequoia term sheet 修改意见', deadline: daysFromNow(3), status: 'pending', source_type: 'email', urgency_score: 5, confidence: 0.85, description: '等 David 先发 term sheet 初稿（已逾期 4 天）' },
  ].map(c => ({
    id: uuid(),
    user_id: USER_ID,
    contact_id: c.contact_email ? getContactId(c.contact_email) : null,
    ...c,
    created_at: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
  }))
}

// ─── Calendar Events（填满一周） ───

function calendarEvents() {
  return [
    // 今天
    { title: 'Team Standup', start_time: dateTimeFromNow(0, 9, 0), end_time: dateTimeFromNow(0, 10, 0), location: 'Zoom', attendees: [{ name: 'Team', email: 'team@company.com' }] },
    { title: '投资人更新 — Lisa Tan (Temasek)', start_time: dateTimeFromNow(0, 14, 0), end_time: dateTimeFromNow(0, 15, 30), location: 'Office, Level 12', attendees: [{ name: 'Lisa Tan', email: 'lisa.tan@temasek.com.sg' }, { name: 'CFO', email: 'cfo@company.com' }] },
    { title: 'Kevin Lim — 投资进度电话', start_time: dateTimeFromNow(0, 16, 0), end_time: dateTimeFromNow(0, 16, 30), attendees: [{ name: 'Kevin Lim', email: 'kevin.lim@monkshill.com' }] },
    // 明天
    { title: 'Sarah Wong 季度评审 (Grab HQ)', start_time: dateTimeFromNow(1, 10, 0), end_time: dateTimeFromNow(1, 11, 30), location: 'Grab HQ, One-North', attendees: [{ name: 'Sarah Wong', email: 'sarah.wong@grab.com' }, { name: 'CTO', email: 'cto@company.com' }] },
    { title: '法律合同讨论 — Rachel Lim', start_time: dateTimeFromNow(1, 14, 0), end_time: dateTimeFromNow(1, 15, 0), location: 'Zoom', attendees: [{ name: 'Rachel Lim', email: 'rachel.lim@wongpartners.sg' }] },
    { title: '田中裕樹 电话 (SoftBank)', start_time: dateTimeFromNow(1, 17, 0), end_time: dateTimeFromNow(1, 17, 30), attendees: [{ name: '田中裕樹', email: 'tanaka.yuki@softbank.co.jp' }], description: '他在东京 (GMT+9)，对他是 18:00' },
    // +2天
    { title: 'Tom Wilson — YC Prep Call', start_time: dateTimeFromNow(2, 9, 0), end_time: dateTimeFromNow(2, 10, 0), location: 'Zoom', attendees: [{ name: 'Tom Wilson', email: 'tom.wilson@ycombinator.com' }], description: 'Tom 在 SF (GMT-7)，对他是前一天 18:00' },
    { title: 'Michael Park 合作讨论', start_time: dateTimeFromNow(2, 15, 30), end_time: dateTimeFromNow(2, 16, 30), location: 'Office', attendees: [{ name: 'Michael Park', email: 'michael.park@samsung.com' }], description: '⚠️ 和 Emily 钢琴课冲突 (周三 15:30)' },
    // +3天
    { title: 'Hans Weber — Siemens Digital Partnership', start_time: dateTimeFromNow(3, 15, 0), end_time: dateTimeFromNow(3, 16, 0), location: 'Zoom', attendees: [{ name: 'Hans Weber', email: 'hans.weber@siemens.de' }], description: 'Hans 在柏林 (GMT+2)，对他是 9:00 AM' },
    // +4天
    { title: 'Priya Mehta — Razorpay India Expansion', start_time: dateTimeFromNow(4, 11, 0), end_time: dateTimeFromNow(4, 12, 0), location: 'Google Meet', attendees: [{ name: 'Priya Mehta', email: 'priya.mehta@razorpay.com' }], description: 'Priya 在 Mumbai (GMT+5:30)，对她是 8:30 AM' },
    { title: '老婆生日晚餐', start_time: dateTimeFromNow(4, 19, 0), end_time: dateTimeFromNow(4, 21, 0), location: 'Odette, National Gallery', description: '已订位 2 人，别忘了花' },
    // +5天
    { title: '家庭聚餐（爷爷奶奶）', start_time: dateTimeFromNow(5, 18, 0), end_time: dateTimeFromNow(5, 21, 0), location: 'Jumbo Seafood, East Coast', attendees: [{ name: '全家', email: '' }] },
  ].map(e => ({
    id: uuid(),
    user_id: USER_ID,
    google_event_id: `stress-test-${uuid().slice(0, 8)}`,
    ...e,
    attendees: JSON.stringify(e.attendees || []),
    is_recurring: false,
  }))
}

// ─── Emails（30封，中英文混合） ───

function emails() {
  return [
    // ── 逾期催促邮件 ──
    { from_address: 'lisa.tan@temasek.com.sg', from_name: 'Lisa Tan', subject: 'Following up on DD checklist', body_text: 'Hi Tiger,\n\nJust checking in on the DD checklist we discussed. Our IC meeting is coming up next week and we\'ll need the complete package including financial model, cap table, and customer references.\n\nCould you send it over today?\n\nBest,\nLisa', received_at: new Date(Date.now() - 3 * 86400000).toISOString(), reply_urgency: 3, is_reply_needed: true },
    { from_address: 'james.miller@stripe.com', from_name: 'James Miller', subject: 'RE: APAC Pricing - still waiting', body_text: 'Hey Tiger,\n\nHaven\'t received the APAC pricing proposal yet. We need to finalize before end of quarter. Our finance team is blocking the partnership agreement until pricing is locked.\n\nCan you prioritize this?\n\nJames', received_at: new Date(Date.now() - 2 * 86400000).toISOString(), reply_urgency: 2, is_reply_needed: true },
    { from_address: 'david.chen@sequoia.com', from_name: 'David Chen', subject: 'Term sheet update', body_text: 'Tiger,\n\nStill working through internal processes on the term sheet. Should have it finalized by early next week. The economics team had a few questions about the revenue model I\'m sorting out.\n\nWill keep you posted.\n\nDavid', received_at: new Date(Date.now() - 4 * 86400000).toISOString(), reply_urgency: 1, is_reply_needed: false },

    // ── 今天的邮件（触发 Sophie 判断） ──
    { from_address: 'sarah.wong@grab.com', from_name: 'Sarah Wong', subject: 'API documentation - can we get it today?', body_text: 'Hi Tiger,\n\nOur engineering team is ready to start integration. Could you share the API docs today as discussed? They need the authentication endpoints and webhook specs.\n\nThanks!\nSarah', received_at: new Date(Date.now() - 2 * 3600000).toISOString(), reply_urgency: 2, is_reply_needed: true },
    { from_address: 'zhangwei@huaxin.cn', from_name: '张伟', subject: 'Re: 产品Demo排期', body_text: '老虎你好，\n\n上次聊的产品demo，我们这边CTO和技术总监都确认了时间。下周一（4月7号）下午2点可以吗？我们会准备会议室和投影设备。\n\n另外，能否提前发一份技术架构文档和安全白皮书？我们CTO想提前看看。\n\n张伟', received_at: new Date(Date.now() - 1 * 3600000).toISOString(), reply_urgency: 2, is_reply_needed: true },
    { from_address: 'tom.wilson@ycombinator.com', from_name: 'Tom Wilson', subject: 'YC Interview - Slot Confirmed', body_text: 'Tiger,\n\nYour interview slot is confirmed for Thursday at 9am SGT (that\'s 6pm Wednesday PST for me).\n\nPlease prepare a 2-minute pitch covering: problem, solution, traction, and ask. We\'ll have 8 minutes for Q&A after.\n\nGood luck.\n\nTom', received_at: new Date(Date.now() - 30 * 60000).toISOString(), reply_urgency: 1, is_reply_needed: false },
    { from_address: 'rachel.lim@wongpartners.sg', from_name: 'Rachel Lim', subject: 'Contract review - update', body_text: 'Dear Tiger,\n\nI\'ll have the contract review completed by Wednesday. There are a few clauses around IP assignment and non-compete that I want to flag for discussion.\n\nShall we schedule a call Wednesday afternoon?\n\nRegards,\nRachel Lim\nWong & Partners LLP', received_at: new Date(Date.now() - 45 * 60000).toISOString(), reply_urgency: 1, is_reply_needed: true },
    { from_address: 'kevin.lim@monkshill.com', from_name: 'Kevin Lim', subject: 'Term sheet feedback?', body_text: 'Hi Tiger,\n\nJust wanted to check - any feedback on the term sheet we sent over? We\'d love to close this round by end of next week if possible.\n\nHappy to jump on a call today if easier.\n\nKevin', received_at: new Date(Date.now() - 3 * 3600000).toISOString(), reply_urgency: 2, is_reply_needed: true },

    // ── 制造压力的邮件 ──
    { from_address: 'lisa.tan@temasek.com.sg', from_name: 'Lisa Tan', subject: 'URGENT: IC Meeting Next Week - Materials Needed', body_text: 'Tiger,\n\nJust got confirmation - our Investment Committee meets next Tuesday. We need the complete fundraising package by Monday latest:\n\n1. Updated financial model (with Q1 actuals)\n2. Cap table\n3. Customer reference list (at least 3)\n4. Technical due diligence report\n\nPlease confirm you can deliver by Monday.\n\nLisa', received_at: new Date(Date.now() - 20 * 60000).toISOString(), reply_urgency: 3, is_reply_needed: true },
    { from_address: 'maria.santos@gic.com.sg', from_name: 'Maria Santos', subject: 'Data room access', body_text: 'Hi Tiger,\n\nWhen will the investor data room be ready? We\'d like to start our review process this week if possible. Please include:\n- Audited financials (last 2 years)\n- Revenue breakdown by geography\n- Unit economics dashboard\n- Customer contracts (redacted)\n\nBest regards,\nMaria Santos\nGIC Private Limited', received_at: new Date(Date.now() - 4 * 3600000).toISOString(), reply_urgency: 2, is_reply_needed: true },
    { from_address: 'daniel.ng@govtech.gov.sg', from_name: 'Daniel Ng', subject: 'GovTech Pilot Proposal - Deadline Reminder', body_text: 'Dear Tiger,\n\nJust a reminder that the pilot proposal submission deadline is end of this month. We\'ll need:\n\n1. Technical proposal (max 20 pages)\n2. Compliance documentation (PDPA, security certifications)\n3. Pricing proposal\n4. Implementation timeline\n\nPlease note the evaluation committee meets on the 15th of next month, so late submissions cannot be accepted.\n\nBest regards,\nDaniel Ng\nGovTech Singapore', received_at: new Date(Date.now() - 5 * 3600000).toISOString(), reply_urgency: 1, is_reply_needed: true },

    // ── 跨时区邮件 ──
    { from_address: 'tanaka.yuki@softbank.co.jp', from_name: '田中裕樹', subject: 'SoftBank Vision Fund - Partnership Discussion', body_text: 'Tiger-san,\n\nThank you for the productive discussion last week. Our team in Tokyo is very interested in exploring a strategic partnership.\n\nCould we schedule a follow-up call this week? I\'m available Tuesday or Wednesday, 5-7pm JST (4-6pm SGT).\n\nAlso, would it be possible to share your product roadmap for the next 12 months?\n\nBest regards,\nTanaka Yuki\nSoftBank Vision Fund', received_at: new Date(Date.now() - 6 * 3600000).toISOString(), reply_urgency: 2, is_reply_needed: true },
    { from_address: 'hans.weber@siemens.de', from_name: 'Hans Weber', subject: 'Siemens Digital - Next Steps', body_text: 'Lieber Tiger,\n\nFollowing our discussion about the digital transformation pilot, I\'d like to propose a concrete next step. Could you prepare a technical architecture overview showing how your solution integrates with our SAP environment?\n\nWe have budget approval for Q2 pilots and would like to include your solution in the evaluation.\n\nMit freundlichen Grüßen,\nHans Weber\nSiemens AG, Digital Industries', received_at: new Date(Date.now() - 8 * 3600000).toISOString(), reply_urgency: 1, is_reply_needed: true },
    { from_address: 'priya.mehta@razorpay.com', from_name: 'Priya Mehta', subject: 'Razorpay x Chief - India Market Entry', body_text: 'Hi Tiger,\n\nGreat chatting at the fintech meetup! As discussed, Razorpay is looking for partners to offer value-added services to our enterprise merchants in India.\n\nI\'d love to set up a call this week to discuss:\n1. Integration requirements\n2. Revenue sharing model\n3. Go-to-market timeline for India\n\nWe have 500+ enterprise merchants who could benefit from your solution.\n\nLet me know your availability!\n\nPriya Mehta\nRazorpay', received_at: new Date(Date.now() - 7 * 3600000).toISOString(), reply_urgency: 1, is_reply_needed: true },
    { from_address: 'michael.park@samsung.com', from_name: 'Michael Park', subject: 'Samsung NEXT - Partnership LOI', body_text: 'Hi Tiger,\n\n박민수입니다. Following up on our partnership discussion. Samsung NEXT Korea office is prepared to issue a Letter of Intent for the pilot program.\n\nCould you review and confirm the scope we discussed:\n- 6-month pilot with Samsung Pay merchants in Korea\n- Revenue share: 70/30 (your favor)\n- Technical integration via Samsung Pay API\n\nI\'ll need your confirmation by end of this week to proceed with internal approvals.\n\nBest,\nMichael Park (박민수)\nSamsung NEXT', received_at: new Date(Date.now() - 3 * 3600000).toISOString(), reply_urgency: 2, is_reply_needed: true },

    // ── 噪音邮件（不该提取承诺） ──
    { from_address: 'noreply@linkedin.com', from_name: 'LinkedIn', subject: 'You have 5 new connection requests', body_text: 'Tiger, you have 5 new connection requests this week.', received_at: new Date(Date.now() - 1 * 3600000).toISOString(), reply_urgency: 0, is_reply_needed: false },
    { from_address: 'random.founder@gmail.com', from_name: 'Random Founder', subject: '想请教你几个问题 - 朋友推荐', body_text: '虎哥你好，\n\n我是做 SaaS 的，一个朋友推荐我联系你。不知道有没有时间喝个咖啡聊聊？主要想请教几个关于出海的问题。\n\n方便的时候回复我就行，不着急。\n\n谢谢！', received_at: new Date(Date.now() - 2 * 3600000).toISOString(), reply_urgency: 0, is_reply_needed: false },
    { from_address: 'newsletter@techcrunch.com', from_name: 'TechCrunch', subject: 'This Week in Fintech: Southeast Asia Edition', body_text: 'Top stories this week...', received_at: new Date(Date.now() - 5 * 3600000).toISOString(), reply_urgency: 0, is_reply_needed: false },
  ].map(e => ({
    id: uuid(),
    user_id: USER_ID,
    gmail_message_id: `stress-test-${uuid().slice(0, 12)}`,
    thread_id: `thread-stress-${uuid().slice(0, 8)}`,
    to_addresses: [USER_EMAIL],
    snippet: (e.body_text || '').slice(0, 200),
    commitment_scanned: false,
    body_processed: false,
    process_attempts: 0,
    labels: ['INBOX'],
    source_account_email: USER_EMAIL,
    ...e,
  }))
}

// ─── Tasks ───

function tasks() {
  return [
    { title: '准备 YC 面试 pitch (2 分钟版本)', priority: 1, status: 'pending', due_date: daysFromNow(2), due_reason: 'YC interview slot confirmed', source_type: 'email' },
    { title: '更新财务模型 Q1 actuals', priority: 1, status: 'pending', due_date: daysFromNow(4), due_reason: 'Temasek IC meeting needs it by Monday', source_type: 'email' },
    { title: '准备华信 CTO 技术架构文档', priority: 2, status: 'pending', due_date: daysFromNow(5), due_reason: '张伟要求会前发送', source_type: 'email' },
    { title: '整理投资人数据室 (GIC + Temasek)', priority: 1, status: 'in_progress', due_date: daysFromNow(5), due_reason: 'Maria Santos and Lisa Tan both need it', source_type: 'email' },
    { title: 'GovTech pilot proposal 技术方案', priority: 2, status: 'pending', due_date: daysFromNow(7), due_reason: 'Daniel Ng deadline reminder', source_type: 'email' },
    { title: '预订老婆生日晚餐 (Odette)', priority: 2, status: 'done', completed_at: new Date(Date.now() - 1 * 86400000).toISOString(), source_type: 'manual' },
  ].map(t => ({
    id: uuid(),
    user_id: USER_ID,
    ...t,
  }))
}

// ─── Main ───

async function main() {
  const args = process.argv.slice(2)
  const clean = args.includes('--clean')

  console.log('Sophie Stress Test — Seed Data')
  console.log('==============================')

  // Find Tiger's user_id
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', USER_EMAIL)
    .single()

  if (profileErr || !profile) {
    console.error(`Cannot find user ${USER_EMAIL}:`, profileErr?.message)
    process.exit(1)
  }

  USER_ID = profile.id
  console.log(`User: ${USER_EMAIL} → ${USER_ID}`)

  if (clean) {
    console.log('\nCleaning stress test data...')
    // Delete test data (identified by stress-test prefix in gmail_message_id / google_event_id)
    await supabase.from('tasks').delete().eq('user_id', USER_ID).like('id', '%')
    await supabase.from('commitments').delete().eq('user_id', USER_ID)
    await supabase.from('calendar_events').delete().eq('user_id', USER_ID).like('google_event_id', 'stress-test-%')
    await supabase.from('family_calendar').delete().eq('user_id', USER_ID).eq('source', 'manual')
    await supabase.from('trip_expenses').delete().eq('user_id', USER_ID)
    await supabase.from('trips').delete().eq('user_id', USER_ID)
    await supabase.from('emails').delete().eq('user_id', USER_ID).like('gmail_message_id', 'stress-test-%')
    // Don't delete contacts — might have real ones
    console.log('Cleaned.')
    return
  }

  // 1. Insert contacts
  const contactData = contacts()
  const { error: cErr } = await supabase.from('contacts').upsert(contactData, { onConflict: 'user_id,email' })
  console.log(`\nContacts: ${contactData.length} ${cErr ? 'FAIL: ' + cErr.message : '✓'}`)

  // Build contact email→id map
  const { data: allContacts } = await supabase.from('contacts').select('id, email').eq('user_id', USER_ID)
  const contactMap = new Map<string, string>()
  for (const c of allContacts || []) contactMap.set(c.email, c.id)

  // 2. Family Calendar
  const familyData = familyCalendar()
  const { error: fErr } = await supabase.from('family_calendar').insert(familyData)
  console.log(`Family events: ${familyData.length} ${fErr ? 'FAIL: ' + fErr.message : '✓'}`)

  // 3. Trips
  const tripData = trips()
  const { error: tErr } = await supabase.from('trips').insert(tripData)
  console.log(`Trips: ${tripData.length} ${tErr ? 'FAIL: ' + tErr.message : '✓'}`)

  // 4. Commitments
  const commitmentData = commitments(contactMap)
  const { error: cmErr } = await supabase.from('commitments').insert(commitmentData)
  console.log(`Commitments: ${commitmentData.length} ${cmErr ? 'FAIL: ' + cmErr.message : '✓'}`)

  // 5. Calendar Events
  const calendarData = calendarEvents()
  const { error: ceErr } = await supabase.from('calendar_events').insert(calendarData)
  console.log(`Calendar events: ${calendarData.length} ${ceErr ? 'FAIL: ' + ceErr.message : '✓'}`)

  // 6. Emails
  const emailData = emails()
  const { error: eErr } = await supabase.from('emails').insert(emailData)
  console.log(`Emails: ${emailData.length} ${eErr ? 'FAIL: ' + eErr.message : '✓'}`)

  // 7. Tasks
  const taskData = tasks()
  const { error: tkErr } = await supabase.from('tasks').insert(taskData)
  console.log(`Tasks: ${taskData.length} ${tkErr ? 'FAIL: ' + tkErr.message : '✓'}`)

  // Summary
  console.log('\n═══════════════════════════════')
  console.log('Sophie Stress Test Data Loaded:')
  console.log(`  ${contactData.length} contacts (4 VIP, 5 high, 6 normal)`)
  console.log(`  ${familyData.length} family events (4 recurring, 5 one-off)`)
  console.log(`  ${tripData.length} trips (Shanghai + KL, both with family conflicts)`)
  console.log(`  ${commitmentData.length} commitments (3 overdue, 2 due today, 5 this week, 2 family, 3 done)`)
  console.log(`  ${calendarData.length} calendar events (filling the next 5 days)`)
  console.log(`  ${emailData.length} emails (${emailData.filter(e => e.is_reply_needed).length} need reply, 3 noise)`)
  console.log(`  ${taskData.length} tasks`)
  console.log('═══════════════════════════════')
  console.log('\nNext steps:')
  console.log('  1. Open dashboard: https://at.actuaryhelp.com/dashboard')
  console.log('  2. WhatsApp: send any message to Sophie and test')
  console.log('  3. Wait for next morning briefing')
  console.log('  4. Clean up: npx tsx tests/seed/sophie-stress-test.ts --clean')
}

main().catch(console.error)
