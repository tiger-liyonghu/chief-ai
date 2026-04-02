# Sophia 开发方案

**基于 SOPHIA_ARCHITECTURE.md，逐模块拆解。**

---

## 总体视图

```
Week 1: Wow          ████████████████████████████████
Week 2: 提醒补全      ████████████████████████████████
Week 3: 差旅补全      ████████████████████████████████
Week 4: AI 质量       ████████████████████████████████
Week 5-6: 企业部署    ████████████████████████████████████████████████████████████████
```

---

## 模块间耦合分析

在开始之前，先看各模块之间的依赖关系，找出可以合并的工作：

```
                    ┌─────────────────┐
                    │  signals/query  │ ← 所有模块都需要
                    │  (统一查询层)    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼───┐  ┌──────▼──────┐  ┌───▼────────┐
     │ shouldNotify│  │Contact roles│  │ Context    │
     │ (判断层)    │  │ (角色标签)  │  │ Engine统一 │
     └─────┬──────┘  └──────┬──────┘  └───┬────────┘
           │                │              │
     ┌─────┼────────────────┼──────────────┼──────┐
     │     │                │              │      │
  ┌──▼──┐ ┌▼────┐  ┌───────▼──┐  ┌───────▼──┐  ┌▼──────┐
  │Wow  │ │Weaver│  │家庭冲突   │  │Prep 改造 │  │落地简报│
  │页面 │ │推送  │  │预警      │  │          │  │       │
  └─────┘ └─────┘  └──────────┘  └──────────┘  └───────┘
```

**关键发现：三个基础模块被多个功能依赖。应该先做基础，再做功能。**

| 基础模块 | 被谁依赖 | 工作量 |
|---------|---------|--------|
| signals/query.ts | Wow、Weaver推送、落地简报、Prep改造 | 半天 |
| shouldNotify() | Weaver推送、Radar Push改造、家庭冲突 | 半天 |
| Contact roles 字段 | 家庭冲突、客户筛选、差旅联系人激活 | 1小时（一个migration） |

**这三个基础模块合计 1.5 天，但做完后后续所有功能的开发速度翻倍。**

### 温度算法耦合

代码里有**两套温度算法**：

```
Weaver Agent (route.ts lines 76-95):
  温度 = 50 + recency_step + frequency*3 + commitments*5
  recency 是分段函数（0-3天+30, 3-7天+20, ...）
  → 阶梯型，跳变大

Context Engine (index.ts lines 313-340):
  温度 = recency_score + interaction_bonus + commitment_bonus × importance
  recency 是指数衰减（half-life=14天）
  → 连续型，平滑

两个算法算同一个人的温度，结果不一样。
```

**应该统一为一套。** 建议保留 Context Engine 的指数衰减版（更数学、更平滑），Weaver 调用它而不是自己算。

提取为共享函数：

```typescript
// lib/contacts/temperature.ts
export function calculateTemperature(contact: {
  lastInteractionAt: Date | null
  recentInteractionCount: number
  activeCommitmentCount: number
  importance: 'vip' | 'important' | 'normal'
}): { score: number; label: 'hot' | 'warm' | 'cooling' | 'cold' } {
  const daysSince = contact.lastInteractionAt
    ? (Date.now() - contact.lastInteractionAt.getTime()) / 86400000
    : 999

  // 指数衰减：half-life 14天
  const recency = 40 * Math.pow(0.5, daysSince / 14)

  // 互动频率加成（上限15）
  const frequency = Math.min(contact.recentInteractionCount * 3, 15)

  // 承诺加成
  const commitment = contact.activeCommitmentCount * 5

  // 重要度乘数
  const multiplier = contact.importance === 'vip' ? 1.3
    : contact.importance === 'important' ? 1.1
    : 1.0

  const score = Math.max(0, Math.min(100,
    Math.round((10 + recency + frequency + commitment) * multiplier)
  ))

  const label = score >= 70 ? 'hot'
    : score >= 40 ? 'warm'
    : score >= 20 ? 'cooling'
    : 'cold'

  return { score, label }
}
```

**这一个函数同时服务：Weaver Agent、Context Engine、Wow 页面、Briefing、联系人详情页。**

### Notification 耦合

现有的通知系统分散在三个地方：

```
1. notification_log 表（dedup）     → lib/whatsapp/notification-log.ts
2. alert 检测（10 种信号）          → lib/alerts/detect.ts (574行)
3. radar push（WhatsApp 推送）      → cron/radar-push/route.ts (180行)
```

shouldNotify() 应该整合进这条链：

```
alert 检测 → shouldNotify()判断 → notification_log 去重 → 推送
            (时间+会议+频率)      (同一件事不重复通知)     (WhatsApp/Dashboard)
```

**现在 radar-push 里有自己的简单判断（检查 emotion 状态），应该统一到 shouldNotify()。**

---

## Week 1：5 分钟 Wow

### 1.1 基础模块（Day 1-2）

#### 1.1a signals/query.ts

**新建文件：** `lib/signals/query.ts`

```typescript
// 统一查询函数，所有 Agent 通过这里读取数据
export async function getSignals(db, userId, opts: {
  since?: Date
  channel?: 'email' | 'whatsapp' | 'calendar'
  contactEmail?: string
  direction?: 'inbound' | 'outbound'
  limit?: number
}): Promise<Signal[]>

export async function getRecentInteractions(db, userId, contactEmail, days = 30): Promise<Interaction[]>

export async function getUnrepliedEmails(db, userId): Promise<Email[]>

export async function getOverdueCommitments(db, userId): Promise<Commitment[]>

export async function getCoolingContacts(db, userId, threshold = 40): Promise<Contact[]>
```

**实现方式：** 内部分发到正确的表查询。不用 signals VIEW（性能不如直查），但对外统一接口。

**改造范围：** 新功能用这个。现有 Agent 暂不改（渐进迁移）。

#### 1.1b shouldNotify()

**新建文件：** `lib/scheduler/should-notify.ts`

```typescript
export async function shouldNotify(db, userId: string, opts: {
  urgency: 'critical' | 'high' | 'medium' | 'low'
  category: string
}): Promise<boolean>
```

**逻辑：**
1. 获取用户时区 → 算本地小时
2. 查当前日历事件 → 是否在开会
3. 查 notification_log 今日同 category 数量 → 频率限制
4. 综合判断

**与现有 notification-log.ts 的关系：** shouldNotify() 调用 wasNotificationSent() 做频率判断，不重复造。

#### 1.1c Contact roles migration

**新建 migration：** `039_contact_roles_and_city.sql`

```sql
-- 角色标签：支持纲领的三个方向
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS roles jsonb DEFAULT '[]';

-- 城市：支持差旅联系人激活
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS city text;

-- 初始化：VIP 标为 client
UPDATE contacts SET roles = '["client"]'
WHERE importance IN ('vip', 'important') AND roles = '[]';

-- 索引
CREATE INDEX IF NOT EXISTS idx_contacts_roles ON contacts USING gin(roles);
CREATE INDEX IF NOT EXISTS idx_contacts_city ON contacts(city) WHERE city IS NOT NULL;
```

#### 1.1d 统一温度算法

**新建文件：** `lib/contacts/temperature.ts`

如上文所述。函数签名固定，Weaver 和 Context Engine 都调用它。

### 1.2 首次同步即时触发（Day 2-3）

**现状：** Onboarding 页面有三步，第二步"scanning"让用户手动点击扫描。

**问题：** 用户 OAuth 完成后，邮件还没拉取。必须先跑 `/api/sync` 拉邮件，再跑扫描。

**改造：**

**文件：** `app/(auth)/onboarding/page.tsx`

```
Step 1: channels（连接邮件 + WhatsApp）
  → OAuth 完成后，立刻后台触发 /api/sync（拉取 90 天邮件）
  → 不等用户操作

Step 2: scanning（自动开始，不需要用户点击）
  → 邮件拉取完成后，自动触发 /api/commitments/scan-stream
  → SSE 实时推送进度到前端

Step 3: ready → 替换为 Wow 页面
```

**关键改动：**
- Step 1 完成时 → 调用 `POST /api/sync` + `POST /api/sync/process`
- Step 2 自动开始 → 不需要"Start Scan"按钮
- Step 3 替换为 Wow 页面

### 1.3 Wow 两步页面（Day 3-5）

**新建页面：** `app/(auth)/onboarding/wow/page.tsx`

**Step 1 即时展示（不依赖 LLM，30 秒内）：**

在邮件同步的同时，已经可以计算：

```typescript
// 不需要等承诺提取，纯数据库查询
const [unreplied, cooling, conflicts] = await Promise.all([
  getUnrepliedEmails(db, userId),                           // is_reply_needed=true
  getCoolingContacts(db, userId, 40),                       // 温度 < 40
  getFamilyConflicts(db, userId, { days: 7 })               // 下周冲突
])
```

渲染：

```
Tiger，你有几个事需要注意：

📧 3 封邮件还没回复
   └ Lisa Tan (3天前)、David Chen (5天前)、Kevin Lim (2天前)

🧊 2 个重要联系人在冷却
   └ Sarah Chen — 45 天没互动（VIP）
   └ Michael Wang — 62 天没互动

📅 下周有 1 个冲突
   └ 周三 14:00 客户会议 vs Emily 学校接送 14:45
```

**Step 2 承诺渐进加载（SSE，3-5 分钟）：**

```
正在扫描你的邮件...（已处理 127/458 封）

已发现：
🔴 你答应 Lisa 周五给报价 — 逾期 4 天
🔴 David 在等你的合同修改 — 逾期 2 天
🟡 你答应 Kevin 本周回复加保方案 — 3 天后到期
```

**技术实现：** 复用 `/api/commitments/scan-stream`（已有 SSE），前端用 EventSource 监听。

**两步之间的视觉过渡：** Step 1 先占满屏幕，Step 2 的承诺卡片从下方逐条滑入。用户始终有内容看。

---

## Week 2：提醒补全

### 2.1 Weaver → 推送（Day 1-2）

**现状：** Weaver Agent (`/api/agents/weaver/route.ts`) 只返回 JSON，不推送。

**改造方案：**

**新建 Cron：** `app/api/cron/weaver-push/route.ts`

```typescript
export async function GET(req) {
  // 1. 遍历所有用户
  // 2. 调用 Weaver 获取 cooling contacts
  // 3. 过滤：只看 roles 包含 "client" 或 "vip" 的（不提醒普通联系人冷却）
  // 4. shouldNotify(userId, 'medium', 'relationship_cooling')
  // 5. 通过 → 推送 WhatsApp / 存 Dashboard 提醒
  // 6. markNotificationSent 去重
}
```

**Weaver 改造：** 不改现有 API，新建 cron 调用它。

**温度算法统一：** Weaver route.ts 内的温度计算替换为 `import { calculateTemperature } from '@/lib/contacts/temperature'`。

**Vercel Cron 配置：** `vercel.json` 加一条：

```json
{ "path": "/api/cron/weaver-push", "schedule": "0 9 * * *" }
```

每天早上 9 点跑一次（不需要更频繁，关系冷却是慢变量）。

### 2.2 家庭冲突预警（Day 2-3）

**现状：** 已有 `/api/family-calendar/conflicts/route.ts`（156行），能检测冲突。但不主动推送。

**改造方案：**

**方式 A（最简）：** 在 Daily Briefing 里加一段家庭冲突检查。

**文件：** `app/api/cron/digest/route.ts`（或 Briefing 生成逻辑）

```typescript
// 在 Briefing 生成时加入
const familyConflicts = await fetch('/api/family-calendar/conflicts')
// 如果有冲突，加入 Briefing 内容：
// "⚠️ 周三 14:00 客户会议和 Emily 学校接送 14:45 冲突"
```

**方式 B（更完整）：** 日历事件创建/变更时实时检查。

**文件：** `app/api/calendar/events/route.ts` 的 POST/PATCH handler

```typescript
// 在创建/修改日历事件后
const conflict = await checkFamilyConflict(userId, newEvent)
if (conflict) {
  // 不阻止创建，但在 Dashboard 显示冲突卡片
  await createAlert(userId, {
    type: 'family_conflict',
    severity: conflict.familyEvent.event_type === 'hard_constraint' ? 'critical' : 'high',
    message: `${newEvent.title} 和 ${conflict.familyEvent.title} 冲突`,
    metadata: { workEvent: newEvent.id, familyEvent: conflict.familyEvent.id }
  })
}
```

**建议：两个都做。** A 覆盖每天早上的检查，B 覆盖实时变更。A 半天，B 半天。

### 2.3 shouldNotify 接入现有 Radar Push（Day 3）

**现状：** `cron/radar-push/route.ts` 有自己的简易判断（检查 emotion 状态 → 只推 critical）。

**改造：** 替换为 shouldNotify()：

```typescript
// 现在
if (userState.emotion === 'tired' || userState.emotion === 'stressed') {
  alerts = alerts.filter(a => a.severity === 'critical')
}

// 改为
const filtered = []
for (const alert of alerts) {
  if (await shouldNotify(db, userId, {
    urgency: alert.severity,
    category: alert.type
  })) {
    filtered.push(alert)
  }
}
```

这样 Radar Push 获得：时间保护（深夜不推）+ 会议保护（开会不推）+ 频率限制（同类不超 N 次）。

---

## Week 3：差旅补全

### 3.1 落地简报触发器（Day 1-2）

**现状：** Travel Brain 有代码但只支持手动调用。需要自动触发。

**方案：** 在邮件同步 cron 中检测差旅状态变化。

**文件：** `app/api/cron/sync/route.ts` 末尾加：

```typescript
// 邮件同步完成后，检查差旅状态
const activeTrips = await db.from('trips')
  .select('*')
  .eq('user_id', userId)
  .eq('status', 'upcoming')
  .lte('start_date', tomorrow)
  .gte('end_date', today)

for (const trip of activeTrips) {
  // 如果今天是出发日或到达日，且还没发过落地简报
  if (!await wasNotificationSent(userId, 'landing_briefing', trip.id, todayISO)) {
    const briefing = await fetch('/api/agents/travel-brain/briefing?city=' + trip.destination_city)
    // 推送落地简报
    await pushViaWhatsApp(userId, formatLandingBriefing(briefing))
    await markNotificationSent(userId, 'landing_briefing', trip.id, todayISO)
  }
}
```

**依赖：** trips 表有 destination_city 字段（migration 034 已有 `cities` jsonb 数组）。

### 3.2 联系人 × 城市匹配（Day 2-3）

**现状：** contacts 表没有 city 字段。Week 1 的 migration 039 已加。

**城市填充策略：**

```
来源优先级：
1. 邮件签名提取（"123 Orchard Road, Singapore"）→ city = "Singapore"
2. Company 推断（"Temasek Holdings" → Singapore）
3. LinkedIn enrichment（未来）
4. 用户手动标注
```

**P1 最小实现：** 在联系人检测时，从邮件签名提取城市。

**文件：** `app/api/sync/process/route.ts` 的联系人处理逻辑中加：

```typescript
// 联系人检测/更新时
if (!contact.city && email.body_text) {
  const city = extractCityFromSignature(email.body_text)
  if (city) await db.from('contacts').update({ city }).eq('id', contact.id)
}
```

`extractCityFromSignature` 用正则匹配常见亚太城市名（Singapore, Kuala Lumpur, Tokyo, Hong Kong, Shanghai, Jakarta, Bangkok, Mumbai, Sydney, Seoul, Taipei）。不用 LLM，正则够了。

**差旅联系人激活：** 在 Travel Brain 中加查询：

```typescript
// 你飞 KL → KL 有哪些客户
const localContacts = await db.from('contacts')
  .select('*')
  .eq('user_id', userId)
  .eq('city', trip.destination_city)
  .contains('roles', ['client'])

// 排序：最久没联系的在前
localContacts.sort((a, b) => a.last_contact_at - b.last_contact_at)
```

### 3.3 出差闭环（Day 3）

**现状：** Debrief Agent 已能工作，但只支持手动触发。

**自动触发：** Trip 结束后自动生成 Debrief。

在 cron/sync 中加：

```typescript
// 检查刚结束的 Trip
const endedTrips = await db.from('trips')
  .select('*')
  .eq('user_id', userId)
  .eq('status', 'active')
  .lt('end_date', today)

for (const trip of endedTrips) {
  // 更新状态
  await db.from('trips').update({ status: 'completed' }).eq('id', trip.id)

  // 自动 Debrief
  if (!await wasNotificationSent(userId, 'trip_debrief', trip.id, todayISO)) {
    const debrief = await fetch('/api/agents/debrief', {
      method: 'POST',
      body: JSON.stringify({ period: 'custom', start: trip.start_date, end: trip.end_date })
    })
    // 推送或存 Dashboard
    await markNotificationSent(userId, 'trip_debrief', trip.id, todayISO)
  }
}
```

---

## Week 4：AI 质量

### 4.1 方向判断 few-shot（Day 1）

**现状：** `lib/ai/prompts/commitment-extraction.ts` 已有 7 组 few-shot，但方向判断的对比不够直接。

**补充 5 组专攻方向的 few-shot：**

```
追加到现有 prompt 的 examples 区域：

--- DIRECTION FOCUS ---

D1. 我发的邮件："I'll send you the report by Friday"
→ i_promised（我主动承诺发报告）
❌ 常见错误：标为 waiting_on_them

D2. 对方发的邮件："Could you send me the report by Friday?"  
→ i_promised（对方请求我做，我收到了=我要做）
❌ 常见错误：标为 waiting_on_them（对方在等，但承诺主体是我）

D3. 对方发的邮件："I'll send you the report by Friday"
→ waiting_on_them（对方承诺发报告给我）
❌ 常见错误：标为 i_promised

D4. 会议纪要："Tiger to follow up with Lisa on pricing"
→ i_promised（Tiger=用户，被分配了任务）

D5. 会议纪要："Lisa to send revised contract by Monday"
→ waiting_on_them（Lisa 被分配，不是用户）
```

**文件改动：** 只改 `lib/ai/prompts/commitment-extraction.ts`，在现有 examples 后追加。

**预期效果：** Recall +10-15%（从 60% → 70-75%），零 API 成本。

### 4.2 Context Engine 统一入口（Day 2-3）

**改造 Prep Agent 为第一个迁移目标。**

**现状：** Prep Agent (`cron/prep-agent/route.ts`) 自己查 emails + commitments + contacts + whatsapp。

**改为：**

```typescript
import { resolveContact, getContactTimeline } from '@/lib/context-engine'

// 对每个参会者
for (const attendee of event.attendees) {
  const contact = await resolveContact(db, userId, attendee.email)
  const timeline = await getContactTimeline(db, userId, attendee.email, 30)

  // context-engine 返回的已经包含：
  // - 联系人画像（温度、角色、公司）
  // - 最近互动（邮件 + WhatsApp + 会议）
  // - 活跃承诺
  // 不需要自己拼
}
```

**context-engine/index.ts 需要扩展：** 现在只导出 resolveContact/getContactTimeline/getUserState。加一个：

```typescript
export async function getContextBundle(db, userId: string, opts: {
  contactEmail?: string
  mode: 'reply' | 'meeting_prep' | 'travel' | 'briefing' | 'family_conflict'
  depth?: 'light' | 'standard' | 'deep'
}): Promise<ContextBundle>
```

这个函数根据 mode 决定加载什么内容，根据 depth 决定加载多深。**所有 Agent 最终都调用这一个函数。**

### 4.3 signals 统一查询（Day 3-4）

实现 `lib/signals/query.ts`（Week 1 定义的接口），让 Wow 页面和新功能使用。

**暂不改造现有 Agent。** 标注为 P2 渐进迁移。

### 4.4 Tier 2 Reasoner eval（Day 4-5）

**已有代码：** `lib/ai/commitment-verifier.ts`

**运行 eval：** `npx tsx tests/ai-eval/run-eval-two-pass.ts --limit 20 --verbose`

**目标：** 评估 Tier 2 在方向判断 few-shot 加入后的增量价值。如果 few-shot 已经把 Recall 提到 75%，Tier 2 可能只需要覆盖高利害场景（VIP 客户的承诺）。

---

## Week 5-6：企业部署

### 5.1 cron-worker.js（Day 1）

**新建文件：** `web/cron-worker.js`

```javascript
const cron = require('node-cron')
const fetch = require('node-fetch')

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const SECRET = process.env.CRON_SECRET

async function callCron(path) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Authorization': `Bearer ${SECRET}` }
    })
    console.log(`[CRON] ${path} → ${res.status}`)
  } catch (e) {
    console.error(`[CRON] ${path} FAILED:`, e.message)
  }
}

// 感知（快）
cron.schedule('*/15 * * * *', () => callCron('/api/cron/sync'))

// 理解（慢，和感知解耦）
cron.schedule('*/20 * * * *', () => callCron('/api/cron/sync')) // process 部分

// Agent
cron.schedule('*/15 * * * *', () => callCron('/api/cron/prep-agent'))
cron.schedule('0 */2 * * *', () => callCron('/api/cron/radar-push'))
cron.schedule('0 8 * * *',   () => callCron('/api/cron/digest'))
cron.schedule('0 9 * * *',   () => callCron('/api/cron/weaver-push'))

console.log('[CRON] Worker started. Schedules registered.')
```

### 5.2 docker-compose.yml（Day 1-2）

完整版如架构文档定义，包含 app + cron + db + backup 四个容器。

### 5.3 .env.example（Day 2）

文档化所有环境变量，标注哪些是必填、哪些是可选：

```bash
# === 必填 ===
NEXT_PUBLIC_SUPABASE_URL=         # SaaS: Supabase Cloud URL / Docker: http://db:5432
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=        # Supabase service role key
GOOGLE_CLIENT_ID=                 # Google OAuth
GOOGLE_CLIENT_SECRET=             # Google OAuth
TOKEN_ENCRYPTION_KEY=             # 32-byte hex

# === LLM（至少一个）===
DEEPSEEK_API_KEY=                 # 默认 LLM
# 或用户在 Dashboard 设置自己的 provider + key

# === 部署模式 ===
DEPLOY_MODE=saas                  # saas | docker
CRON_SECRET=                      # Cron 路由鉴权

# === 可选 ===
GOOGLE_MAPS_API_KEY=              # 地点推荐
SILICONFLOW_API_KEY=              # 备用 LLM
WHATSAPP_SERVICE_URL=             # WhatsApp 服务
```

### 5.4 健康检查（Day 3）

**新建：** `app/api/health/route.ts`

```typescript
export async function GET() {
  const [syncStatus, dbStatus, llmStatus] = await Promise.all([
    getLastSyncTime(),
    checkDbConnection(),
    checkLlmConnection()
  ])

  return Response.json({
    status: syncStatus.minutesSince < 60 ? 'healthy' : 'degraded',
    lastSync: syncStatus.lastSyncAt,
    unprocessedEmails: syncStatus.unprocessedCount,
    database: dbStatus ? 'connected' : 'disconnected',
    llm: llmStatus ? 'connected' : 'disconnected'
  })
}
```

---

## 文件变更总览

| Week | 新建 | 改造 | Migration |
|------|------|------|-----------|
| **1** | `lib/signals/query.ts`, `lib/scheduler/should-notify.ts`, `lib/contacts/temperature.ts`, `onboarding/wow/page.tsx` | `onboarding/page.tsx`（首次同步自动触发） | `039_contact_roles_and_city.sql` |
| **2** | `cron/weaver-push/route.ts` | `cron/digest/`（加家庭冲突）, `calendar/events/`（实时冲突检查）, `cron/radar-push/`（接入 shouldNotify） | — |
| **3** | — | `cron/sync/`（加落地简报触发+出差闭环）, `agents/travel-brain/`（加联系人激活）, `sync/process/`（加城市提取） | — |
| **4** | `lib/context-engine` 扩展 getContextBundle | `prompts/commitment-extraction.ts`（加方向 few-shot）, `cron/prep-agent/`（走 context-engine） | — |
| **5-6** | `cron-worker.js`, `docker-compose.yml`, `.env.example`, `api/health/` | — | — |

---

## 风险与预案

| 风险 | 概率 | 预案 |
|------|------|------|
| 首次同步 90 天邮件超时 | 高 | 先拉 30 天，后台异步拉剩余 60 天 |
| 方向 few-shot 效果不明显 | 中 | 跑 eval 验证，不行就走 Tier 2 |
| Weaver 推送太多/太少 | 中 | shouldNotify 频率限制 + 第一周只推 VIP |
| Docker 本地 Supabase 兼容问题 | 中 | 先用 Supabase self-hosted CLI 测试 |
| 城市正则提取准确率低 | 低 | 先覆盖 Top 15 亚太城市，其余标 unknown |

---

*每个 Week 开始前做 1 小时 planning，结束后做 30 分钟 review。所有代码改动走 PR，不直接 push main。*
