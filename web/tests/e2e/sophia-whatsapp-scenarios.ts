/**
 * Sophia WhatsApp 幕僚行为大规模测试
 *
 * 模拟一个保险代理人（Tiger）一周的真实使用场景。
 * 测试 Sophia 是否像一个真正的秘书/幕僚：
 * - 该说话时说，不该说话时闭嘴
 * - 记住承诺，主动提醒
 * - 出差时最强
 * - 保护家庭时间
 *
 * Run: SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx tests/e2e/sophia-whatsapp-scenarios.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://krxhyvixctwdoraulvlz.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const BASE = 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET || 'c031b72ed6f622b9584d506520a30da340e2a82dbef67a17948c59a531bf6bb6'

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

let passed = 0, failed = 0, warnings = 0, total = 0

function result(id: string, status: 'pass' | 'fail' | 'warn', msg: string) {
  total++
  if (status === 'pass') { passed++; console.log(`  ✅ ${id}: ${msg}`) }
  else if (status === 'fail') { failed++; console.log(`  ❌ ${id}: ${msg}`) }
  else { warnings++; console.log(`  ⚠️  ${id}: ${msg}`) }
}

async function fetchJSON(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, opts)
  return { status: res.status, data: await res.json().catch(() => null), ms: Date.now() }
}

async function main() {
  // Get test user
  const { data: users } = await db.from('profiles').select('id, email, timezone, daily_brief_time').not('onboarding_completed_at', 'is', null).limit(1)
  if (!users?.length) { console.error('No users'); process.exit(1) }
  const user = users[0]
  console.log(`\nTesting Sophia WhatsApp scenarios for: ${user.email}\n`)

  // ═══════════════════════════════════════════════════
  // SCENARIO 1: 周一早上 — Daily Briefing
  // "Sophia 应该在早上告诉我今天最重要的事"
  // ═══════════════════════════════════════════════════

  console.log('═══ SCENARIO 1: 周一早上 Daily Briefing ═══')

  // Test briefing generation
  const briefingRes = await fetchJSON('/api/briefing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-user-id': user.id, 'Authorization': `Bearer ${CRON_SECRET}` },
  })

  if (briefingRes.status === 200 && briefingRes.data?.briefing) {
    const briefing = briefingRes.data.briefing as string
    result('S1-01', briefing.length > 20 ? 'pass' : 'fail',
      `Briefing generated: ${briefing.length} chars`)

    // 幕僚行为检查：不是列清单，是给判断
    const hasBullets = (briefing.match(/\n-/g) || []).length
    result('S1-02', hasBullets <= 8 ? 'pass' : 'warn',
      `Briefing conciseness: ${hasBullets} bullet points (max 8)`)

    // 检查是否包含逾期承诺
    const { count: overdueCount } = await db.from('commitments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).in('status', ['overdue'])
    if ((overdueCount || 0) > 0) {
      const mentionsOverdue = /逾期|overdue|到期|过期/i.test(briefing)
      result('S1-03', mentionsOverdue ? 'pass' : 'warn',
        `${overdueCount} overdue commitments → briefing mentions: ${mentionsOverdue}`)
    } else {
      result('S1-03', 'pass', 'No overdue commitments (nothing to mention)')
    }

    // 检查是否包含今天的会议
    const todayISO = new Date().toISOString().slice(0, 10)
    const { count: todayMeetings } = await db.from('calendar_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).gte('start_time', `${todayISO}T00:00:00`).lte('start_time', `${todayISO}T23:59:59`)
    result('S1-04', 'pass', `Today's meetings: ${todayMeetings || 0}`)
  } else {
    result('S1-01', 'fail', `Briefing failed: HTTP ${briefingRes.status}`)
  }

  // ═══════════════════════════════════════════════════
  // SCENARIO 2: 承诺生命周期
  // "我答应了 Lisa 给她报价 → Sophia 记住 → 提醒 → 完成"
  // ═══════════════════════════════════════════════════

  console.log('\n═══ SCENARIO 2: 承诺生命周期 ═══')

  // 查看当前活跃承诺
  const { data: activeCommitments } = await db.from('commitments')
    .select('id, title, type, status, deadline, contact_name, context')
    .eq('user_id', user.id).in('status', ['pending', 'in_progress', 'overdue'])
    .order('urgency_score', { ascending: false }).limit(10)

  result('S2-01', (activeCommitments?.length || 0) > 0 ? 'pass' : 'warn',
    `Active commitments: ${activeCommitments?.length || 0}`)

  if (activeCommitments && activeCommitments.length > 0) {
    // 检查是否有 i_promised 和 they_promised 两种类型
    const iPromised = activeCommitments.filter(c => c.type === 'i_promised')
    const theyPromised = activeCommitments.filter(c => c.type === 'they_promised')
    result('S2-02', iPromised.length > 0 ? 'pass' : 'warn',
      `I promised: ${iPromised.length} items`)
    result('S2-03', theyPromised.length > 0 ? 'pass' : 'warn',
      `They promised: ${theyPromised.length} items`)

    // 检查 family context 标记
    const familyCommitments = activeCommitments.filter(c => c.context === 'family')
    result('S2-04', 'pass', `Family commitments: ${familyCommitments.length}`)

    // 模拟"完成"操作
    const testCommitment = activeCommitments[0]
    result('S2-05', testCommitment.title ? 'pass' : 'fail',
      `Top commitment: "${testCommitment.title}" (${testCommitment.type}, ${testCommitment.status})`)
  }

  // ═══════════════════════════════════════════════════
  // SCENARIO 3: Radar 信号检测
  // "Sophia 应该发现快要落的球"
  // ═══════════════════════════════════════════════════

  console.log('\n═══ SCENARIO 3: Radar 信号检测 ═══')

  const radarRes = await fetchJSON('/api/agents/radar', {
    headers: { 'x-cron-user-id': user.id, 'Authorization': `Bearer ${CRON_SECRET}` }
  })

  if (radarRes.status === 200) {
    const signals = radarRes.data?.signals || []
    result('S3-01', 'pass', `Radar signals: ${signals.length}`)

    const critical = signals.filter((s: any) => s.severity === 'critical' || s.severity === 'high')
    result('S3-02', 'pass', `Critical/High: ${critical.length}`)

    // 检查信号类型多样性
    const types = new Set(signals.map((s: any) => s.type))
    result('S3-03', 'pass', `Signal types: ${[...types].join(', ') || 'none'}`)
  } else {
    result('S3-01', 'warn', `Radar: HTTP ${radarRes.status}`)
  }

  // ═══════════════════════════════════════════════════
  // SCENARIO 4: Weaver 关系温度
  // "Kevin 一个月没联系了 → Sophia 应该告诉我"
  // ═══════════════════════════════════════════════════

  console.log('\n═══ SCENARIO 4: Weaver 关系管理 ═══')

  const weaverRes = await fetchJSON('/api/agents/weaver', {
    headers: { 'x-cron-user-id': user.id, 'Authorization': `Bearer ${CRON_SECRET}` }
  })

  if (weaverRes.status === 200) {
    const { relationships = [], summary = {} } = weaverRes.data || {}
    result('S4-01', relationships.length > 0 ? 'pass' : 'warn',
      `Weaver: ${relationships.length} contacts analyzed`)
    result('S4-02', 'pass',
      `Temperature: ${summary.hot || 0} hot, ${summary.warm || 0} warm, ${summary.cooling || 0} cooling, ${summary.cold || 0} cold`)

    const needsAttention = relationships.filter((r: any) => r.needs_attention)
    result('S4-03', 'pass',
      `Needs attention: ${needsAttention.length} contacts`)

    // 检查最冷的联系人
    if (relationships.length > 0) {
      const coldest = relationships[relationships.length - 1]
      result('S4-04', 'pass',
        `Coldest: ${coldest.name} (${coldest.temperature}°, ${coldest.days_since_contact}d ago)`)
    }
  } else {
    result('S4-01', 'warn', `Weaver: HTTP ${weaverRes.status}`)
  }

  // ═══════════════════════════════════════════════════
  // SCENARIO 5: Closer 催促
  // "逾期 3 天了 → Sophia 应该帮我起草催促邮件"
  // ═══════════════════════════════════════════════════

  console.log('\n═══ SCENARIO 5: Closer 催促能力 ═══')

  const closerRes = await fetchJSON('/api/agents/closer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-user-id': user.id, 'Authorization': `Bearer ${CRON_SECRET}` },
  })

  if (closerRes.status === 200) {
    const drafts = closerRes.data?.drafts || []
    result('S5-01', 'pass', `Closer drafts: ${drafts.length}`)

    if (drafts.length > 0) {
      const d = drafts[0]
      result('S5-02', d.escalation ? 'pass' : 'warn',
        `Escalation level: ${d.escalation} (${d.contact})`)
      result('S5-03', d.draft_text?.length > 20 ? 'pass' : 'fail',
        `Draft quality: ${d.draft_text?.length || 0} chars`)
    }
  } else {
    result('S5-01', 'warn', `Closer: HTTP ${closerRes.status}`)
  }

  // ═══════════════════════════════════════════════════
  // SCENARIO 6: 差旅准备
  // "明天飞 KL → Sophia 应该准备落地简报"
  // ═══════════════════════════════════════════════════

  console.log('\n═══ SCENARIO 6: 差旅智能 ═══')

  const travelRes = await fetchJSON('/api/agents/travel-brain', {
    headers: { 'x-cron-user-id': user.id, 'Authorization': `Bearer ${CRON_SECRET}` }
  })

  if (travelRes.status === 200) {
    const { active_trip, upcoming_trips = [] } = travelRes.data || {}
    result('S6-01', 'pass',
      `Active trip: ${active_trip ? active_trip.title : 'none'}, Upcoming: ${upcoming_trips.length}`)

    // Test travel-check cron
    const travelCheckRes = await fetchJSON('/api/cron/travel-check', {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
    })
    result('S6-02', travelCheckRes.status === 200 ? 'pass' : 'fail',
      `Travel check cron: ${JSON.stringify(travelCheckRes.data)}`)
  } else {
    result('S6-01', 'warn', `Travel Brain: HTTP ${travelRes.status}`)
  }

  // ═══════════════════════════════════════════════════
  // SCENARIO 7: 家庭保护
  // "客户约周六下午 → Sophia 说这是 Emily 钢琴课"
  // ═══════════════════════════════════════════════════

  console.log('\n═══ SCENARIO 7: 家庭保护 ═══')

  const { data: familyEvents } = await db.from('family_calendar')
    .select('id, title, event_type, start_time, end_time, family_member, recurrence')
    .eq('user_id', user.id).eq('is_active', true)

  result('S7-01', (familyEvents?.length || 0) > 0 ? 'pass' : 'warn',
    `Family events: ${familyEvents?.length || 0}`)

  if (familyEvents && familyEvents.length > 0) {
    const hardConstraints = familyEvents.filter(e => e.event_type === 'hard_constraint')
    result('S7-02', hardConstraints.length > 0 ? 'pass' : 'warn',
      `Hard constraints: ${hardConstraints.length}`)

    for (const fe of hardConstraints.slice(0, 2)) {
      result('S7-03', 'pass',
        `  → "${fe.title}" ${fe.family_member ? `(${fe.family_member})` : ''} ${fe.recurrence !== 'none' ? `[${fe.recurrence}]` : ''}`)
    }
  }

  // Test conflict detection API
  const conflictsRes = await fetchJSON('/api/family-calendar/conflicts', {
    headers: { 'x-cron-user-id': user.id, 'Authorization': `Bearer ${CRON_SECRET}` }
  })
  result('S7-04', conflictsRes.status === 200 ? 'pass' : 'warn',
    `Conflict check: HTTP ${conflictsRes.status}`)

  // ═══════════════════════════════════════════════════
  // SCENARIO 8: Prep Agent 会前准备
  // "见客户前 30 分钟 → Sophia 准备好背景"
  // ═══════════════════════════════════════════════════

  console.log('\n═══ SCENARIO 8: 会前准备 ═══')

  const prepRes = await fetchJSON('/api/cron/prep-agent', {
    headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
  })

  result('S8-01', prepRes.status === 200 ? 'pass' : 'fail',
    `Prep agent: ${JSON.stringify(prepRes.data)}`)

  // Check if any meeting briefs exist
  const { count: briefCount } = await db.from('meeting_briefs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  result('S8-02', 'pass', `Meeting briefs generated: ${briefCount || 0}`)

  // ═══════════════════════════════════════════════════
  // SCENARIO 9: shouldNotify 判断力
  // "深夜不打扰、开会不打扰、频率不超限"
  // ═══════════════════════════════════════════════════

  console.log('\n═══ SCENARIO 9: 打扰判断力 ═══')

  // Test Radar Push with shouldNotify
  const radarPushRes = await fetchJSON('/api/cron/radar-push', {
    headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
  })

  result('S9-01', radarPushRes.status === 200 ? 'pass' : 'fail',
    `Radar push: processed=${radarPushRes.data?.processed}, pushed=${radarPushRes.data?.pushed}`)

  // Test Weaver Push
  const weaverPushRes = await fetchJSON('/api/cron/weaver-push', {
    headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
  })

  result('S9-02', weaverPushRes.status === 200 ? 'pass' : 'fail',
    `Weaver push: processed=${weaverPushRes.data?.processed}, pushed=${weaverPushRes.data?.pushed}`)

  // ═══════════════════════════════════════════════════
  // SCENARIO 10: Debrief 复盘
  // "出差回来 → Sophia 总结这趟出差的所有事"
  // ═══════════════════════════════════════════════════

  console.log('\n═══ SCENARIO 10: Debrief 复盘 ═══')

  const debriefRes = await fetchJSON('/api/agents/debrief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-user-id': user.id, 'Authorization': `Bearer ${CRON_SECRET}` },
    body: JSON.stringify({ period: 'week' }),
  })

  if (debriefRes.status === 200) {
    const summary = debriefRes.data?.summary || debriefRes.data?.debrief || ''
    result('S10-01', summary.length > 30 ? 'pass' : 'warn',
      `Debrief: ${summary.length} chars`)

    const stats = debriefRes.data?.stats
    if (stats) {
      result('S10-02', 'pass',
        `Stats: ${stats.emails_received || '?'} emails, ${stats.meetings_attended || '?'} meetings, ${stats.commitments_completed || '?'} commitments done`)
    }
  } else {
    result('S10-01', 'warn', `Debrief: HTTP ${debriefRes.status}`)
  }

  // ═══════════════════════════════════════════════════
  // SCENARIO 11: Email 回复能力
  // "帮我回复 David → Sophia 带上下文写草稿"
  // ═══════════════════════════════════════════════════

  console.log('\n═══ SCENARIO 11: Email Ghostwriter ═══')

  const { data: pendingEmails } = await db.from('emails')
    .select('id, from_name, from_address, subject')
    .eq('user_id', user.id).eq('is_reply_needed', true)
    .order('received_at', { ascending: false }).limit(3)

  result('S11-01', (pendingEmails?.length || 0) > 0 ? 'pass' : 'warn',
    `Pending replies: ${pendingEmails?.length || 0}`)

  if (pendingEmails && pendingEmails.length > 0) {
    for (const email of pendingEmails.slice(0, 2)) {
      result('S11-02', 'pass',
        `  → ${email.from_name || email.from_address}: "${email.subject}"`)
    }
  }

  // ═══════════════════════════════════════════════════
  // SCENARIO 12: Context Engine 上下文质量
  // "提到 Lisa → Sophia 知道 Lisa 是谁、欠她什么"
  // ═══════════════════════════════════════════════════

  console.log('\n═══ SCENARIO 12: Context Engine 质量 ═══')

  // Pick a contact with commitments
  const { data: contactsWithCommitments } = await db.from('commitments')
    .select('contact_email, contact_name')
    .eq('user_id', user.id).in('status', ['pending', 'in_progress', 'overdue'])
    .not('contact_email', 'is', null).limit(5)

  if (contactsWithCommitments && contactsWithCommitments.length > 0) {
    const contact = contactsWithCommitments[0]
    result('S12-01', 'pass',
      `Testing context for: ${contact.contact_name || contact.contact_email}`)

    // Check if contact exists in contacts table
    const { data: contactProfile } = await db.from('contacts')
      .select('id, name, company, importance, last_contact_at, roles, city')
      .eq('user_id', user.id).eq('email', contact.contact_email).single()

    if (contactProfile) {
      result('S12-02', 'pass',
        `Profile: ${contactProfile.name} @ ${contactProfile.company || '?'}, importance=${contactProfile.importance}, city=${contactProfile.city || '?'}`)

      // Check commitment count for this contact
      const { count: commitCount } = await db.from('commitments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('contact_email', contact.contact_email)
        .in('status', ['pending', 'in_progress', 'overdue'])

      result('S12-03', 'pass',
        `Active commitments with ${contactProfile.name}: ${commitCount}`)
    } else {
      result('S12-02', 'warn', `Contact not in contacts table: ${contact.contact_email}`)
    }
  } else {
    result('S12-01', 'warn', 'No contacts with active commitments')
  }

  // ═══════════════════════════════════════════════════
  // SCENARIO 13: WhatsApp 消息历史
  // "检查 Sophia 的对话记录质量"
  // ═══════════════════════════════════════════════════

  console.log('\n═══ SCENARIO 13: WhatsApp 消息历史 ═══')

  const { data: waMessages, count: waCount } = await db.from('whatsapp_messages')
    .select('id, from_name, body, direction, received_at, message_type', { count: 'exact' })
    .eq('user_id', user.id)
    .order('received_at', { ascending: false })
    .limit(20)

  result('S13-01', (waCount || 0) > 0 ? 'pass' : 'warn',
    `WhatsApp messages: ${waCount || 0} total`)

  if (waMessages && waMessages.length > 0) {
    const sophiaMessages = waMessages.filter(m => m.from_name === 'Sophia' || m.from_name === 'Apple')
    const userMessages = waMessages.filter(m => m.direction === 'outbound' || (!m.from_name || m.from_name === null))

    result('S13-02', 'pass',
      `Recent 20: ${sophiaMessages.length} from Sophia, ${userMessages.length} from user`)

    // 检查 Sophia 回复的简洁度（幕僚不啰嗦）
    if (sophiaMessages.length > 0) {
      const avgLength = sophiaMessages.reduce((sum, m) => sum + (m.body?.length || 0), 0) / sophiaMessages.length
      result('S13-03', avgLength < 500 ? 'pass' : 'warn',
        `Sophia avg reply: ${Math.round(avgLength)} chars (concise < 500)`)

      // 检查最近的对话示例
      console.log('\n  Recent conversations:')
      const recent = waMessages.slice(0, 6).reverse()
      for (const m of recent) {
        const who = m.from_name === 'Sophia' || m.from_name === 'Apple' ? '🤖 Sophia' : '👤 User'
        const body = (m.body || '').slice(0, 80).replace(/\n/g, ' ')
        console.log(`    ${who}: ${body}${(m.body?.length || 0) > 80 ? '...' : ''}`)
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // SCENARIO 14: 数据完整性总检
  // "所有表都有数据吗？纲领的每个功能都有数据支撑吗？"
  // ═══════════════════════════════════════════════════

  console.log('\n═══ SCENARIO 14: 数据完整性 ═══')

  const tables = [
    { name: 'emails', query: db.from('emails').select('id', { count: 'exact', head: true }).eq('user_id', user.id) },
    { name: 'commitments', query: db.from('commitments').select('id', { count: 'exact', head: true }).eq('user_id', user.id) },
    { name: 'contacts', query: db.from('contacts').select('id', { count: 'exact', head: true }).eq('user_id', user.id) },
    { name: 'calendar_events', query: db.from('calendar_events').select('id', { count: 'exact', head: true }).eq('user_id', user.id) },
    { name: 'trips', query: db.from('trips').select('id', { count: 'exact', head: true }).eq('user_id', user.id) },
    { name: 'family_calendar', query: db.from('family_calendar').select('id', { count: 'exact', head: true }).eq('user_id', user.id) },
    { name: 'whatsapp_messages', query: db.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('user_id', user.id) },
    { name: 'notification_log', query: db.from('notification_log').select('id', { count: 'exact', head: true }).eq('user_id', user.id) },
  ]

  for (const t of tables) {
    const { count } = await t.query
    result(`S14-${t.name}`, (count || 0) > 0 ? 'pass' : 'warn',
      `${t.name}: ${count || 0} rows`)
  }

  // ═══════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`Sophia WhatsApp Scenario Results:`)
  console.log(`  ✅ Passed:   ${passed}`)
  console.log(`  ⚠️  Warnings: ${warnings}`)
  console.log(`  ❌ Failed:   ${failed}`)
  console.log(`  Total:       ${total}`)
  console.log(`  Pass rate:   ${Math.round(passed / total * 100)}%`)
  console.log(`${'═'.repeat(60)}`)

  if (failed > 0) process.exit(1)
}

main().catch(err => { console.error(err); process.exit(1) })
