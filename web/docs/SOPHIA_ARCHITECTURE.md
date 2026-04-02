# Sophia 系统架构

**本文档是 SOPHIA_MANIFESTO.md 的技术实现指南。纲领说"做什么"，本文档说"怎么做"。**

---

## 一、全局数据流

纲领说 Sophia 做三件事：盯着、提醒、准备。技术上是一条四段管线：

```
感知 ──→ 理解 ──→ 判断 ──→ 行动

渠道接入      语义提取      该不该现在做？      盯/提醒/准备
(异步，快)    (异步，慢)    该不该打扰用户？    推送/静默/草拟
邮件          承诺          什么优先级？
WhatsApp      差旅          频率是否超限？
日历          联系人
              关系温度
```

### 感知：渠道 → Signal（快，不依赖 LLM）

所有渠道的消息归一化为 Signal。Sophia 不区分消息从哪来。

```
Gmail / Outlook / IMAP  ─┐
WhatsApp (Baileys)       ├──→  emails / whatsapp_messages / calendar_events（原始表）
Google Calendar          ─┘           │
                                      ▼
                              signals（统一查询层）
```

**统一查询函数**（替代让 Agent 直接写 SQL）：

```typescript
// lib/signals/query.ts — 所有 Agent 通过这个函数读取数据
export async function getSignals(userId: string, opts: {
  since?: Date
  channel?: 'email' | 'whatsapp' | 'calendar'
  contactEmail?: string
  limit?: number
}): Promise<Signal[]>
```

Agent 调这个函数，不直接查 emails/whatsapp_messages 表。新增渠道（Telegram、Slack）时只改这个函数，Agent 代码不动。

### 理解：Signal → 本体（慢，依赖 LLM，和感知解耦）

感知和理解**独立运行，不串行**：

```
感知（Cron A）：拉邮件 → 存 emails 表 → 标记 unprocessed → 结束
理解（Cron B）：扫描 unprocessed → LLM 提取 → 存承诺/差旅/联系人 → 标记 processed

好处：
- 感知不会被 LLM 调用拖慢
- 理解失败了可以单独重跑，不用重新拉邮件
- 企业版可以给理解层独立分配 GPU 资源
```

从 Signal 中提取的结构化概念：

```
Signal ──→ 承诺提取 ──→ Commitment（谁答应了谁什么）
       ──→ 差旅检测 ──→ Trip（航班/酒店/会议）
       ──→ 联系人检测 ──→ Contact（人 + 关系 + 角色）
```

Topic（事项聚合）列为 P2。P1 以 Contact 为锚点聚合——"Lisa 相关的一切"足以支撑纲领所有场景。

### 判断：该不该现在做？

```typescript
// lib/scheduler/should-notify.ts
async function shouldNotify(userId: string, urgency: string, category: string): Promise<boolean> {
  const hour = getUserLocalHour(userId)
  const event = await getCurrentEvent(userId)

  // 时间判断
  if (hour < 7 || hour > 22) return urgency === 'critical'

  // 会议判断
  if (event?.isOngoing) return urgency === 'critical'

  // 频率限制：同类提醒每天有上限
  const todayCount = await getNotifyCount(userId, category, 'today')
  const limits: Record<string, number> = {
    relationship_cooling: 3,
    commitment_overdue: 5,
    calendar_conflict: 3,
    family_conflict: 2,    // 家庭冲突更克制
    general: 10
  }
  if (todayCount >= (limits[category] || 10)) return false

  return urgency !== 'low'
}
```

纲领第 3 条规矩"不该烦的时候不烦"= 时间判断 + 会议判断 + 频率限制。

### 行动：Agent 执行

```
盯着  →  Radar（扫描信号）、Weaver（算温度）
提醒  →  Briefing（每日早报）、Radar Push（紧急推送）、冷却提醒、家庭冲突
准备  →  Prep（会前简报）、Ghostwriter（代写）、Closer（催促）、落地简报
```

---

## 二、本体模型

### 核心层（P1，通用，所有行业共享）

```
Signal ──→ Commitment ──→ Contact ──→ Trip
                            │
                        角色标签 (roles jsonb)
                     Client / Family / VIP / Referrer
```

**四个核心概念 + 角色标签系统：**

### Signal — 统一消息

| 字段 | 说明 |
|------|------|
| channel | email / whatsapp / calendar |
| direction | inbound / outbound |
| sender | 发送人 |
| timestamp | 时间 |
| content | 内容 |

实现：`lib/signals/query.ts` 统一查询函数 + PostgreSQL VIEW `signals` 做底层。

### Commitment — 承诺

纲领的核心概念。"谁答应了谁什么，什么时候到期。"

| 字段 | 说明 |
|------|------|
| type | i_promised / waiting_on_them |
| title | 承诺内容 |
| deadline | 到期日 |
| confidence_label | confirmed / likely / tentative / unlikely |
| status | active / completed / overdue / cancelled |
| signal_id | 来源 Signal（可溯源） |
| contact_email | 关联的人 |

提取管线：

```
邮件 → 预过滤（跳过营销/抄送/自动回复）
     → LLM 提取（3-Gate Tribunal: 后果/主动性/追踪价值）
     → 方向判断（5 组对比 few-shot 专攻 i_promised vs waiting_on_them）
     → 后过滤（去重/置信度 ≥ 0.4）
     → Per-person 校准（历史履约率 ±30%）
     → 紧急度评分（10分制）
     → 存入 commitments 表
```

当前指标：Precision 100%，Recall 60%。目标 P1 结束 Recall ≥75%。

### Contact — 人 + 角色

不是通讯录，是关系图谱。**角色标签是实现纲领"三个方向"的数据基础：**

```sql
ALTER TABLE contacts ADD COLUMN roles jsonb DEFAULT '[]';
-- 示例：["client", "vip"]        → 客户不丢
-- 示例：["family"]               → 家庭不忘
-- 示例：["client", "referrer"]   → 客户不丢 + 转介绍
```

| 字段类型 | 说明 |
|---------|------|
| 基础 | name, email, phone, company, title |
| 角色 | roles: Client / Family / VIP / Referrer（可多个） |
| 温度 | warmth (0-100)，Weaver 自动算 |
| 城市 | city（用于差旅联系人激活："KL 有 3 个客户"） |
| 丰富 | career_history, dietary, birthday, linkedin_url, wechat_id... |

温度算法（Weaver）：

```
基线 50
+ 最近互动: 0-3天(+30), 3-7天(+20), 7-14天(+10), 14-30天(-10), 30-60天(-25), >60天(-40)
+ 互动频率: 每封近期邮件 +3（上限 +15）
+ 活跃承诺: 每个 +5
× VIP 乘数: 1.3

结果: hot(≥70) / warm(40-70) / cooling(20-40) / cold(<20)
```

角色标签的作用：

| 纲领方向 | 查询 | 功能 |
|---------|------|------|
| 客户不丢 | `roles @> '["client"]'` | 客户冷却提醒、续约跟进 |
| 家庭不忘 | `roles @> '["family"]'` | 家庭硬约束冲突检测 |
| 差旅不乱 | `city = trip.destination` | 联系人激活 |

### Trip — 差旅

```
trips
├── trip_flights（航班）
├── trip_hotels（酒店）
├── trip_meetings（会议）
├── trip_dinners（商务餐）
├── trip_transports（地面交通）
└── trip_forums（论坛/峰会）
```

辅助表：`country_info`（11国）、`city_info`（11城）。

### 垂直扩展层（P2，按行业加载）

通用层不动，垂直层可替换：

```
保险垂直（第一个）：

  Policy — 保单
  ├── client_contact_id    谁的保单
  ├── product_type         医疗/寿险/重疾/意外
  ├── insurer              保险公司
  ├── policy_number        保单号
  ├── expiry_date          到期日
  ├── premium              保费
  ├── coverage_amount      保额
  └── status               active / expiring / expired

  Life Event — 生命事件
  ├── contact_id           谁
  ├── event_type           marriage / newborn / home_purchase / promotion / retirement
  ├── detected_from        signal_id（从哪封邮件检测到）
  ├── detected_at          检测时间
  └── opportunities        触发的商业机会（加保/新保/调整）

未来垂直：
  法律：Case / Filing / Hearing
  咨询：Project / Deliverable / Milestone
```

### P2 扩展：Topic — 事项聚合

P1 以 Contact 为锚点聚合。P2 加 Topic 层实现跨渠道语义聚合：

```
Topic = "Lisa 的保单续约"
├── 3 封邮件（Signal）
├── 1 条 WhatsApp（Signal）
├── 1 个承诺（Commitment）
└── 1 个日历事件（Signal）
```

实现需要 LLM 语义匹配（同一人 + 相似主题 + 时间窗口），列为 P2。

---

## 三、Context Engine

纲领说"Sophia 准备好这个人的背景、历史、未了承诺"。Context Engine 是实现这句话的核心。

### 统一入口

```
所有 Agent / 所有 LLM 调用
        │
        ▼
context-engine/index.ts（唯一入口）
        ├── pre-fetch.ts       从消息中提取人名（英文+中文）
        ├── resolve-context.ts  图遍历 1-hop / 2-hop
        └── context.ts          意图检测 + 工具收窄 + 分层注入
```

**规则：Agent 不直接调用 resolve-context 或 context.ts，统一走 context-engine。**

迁移计划：
- P1：新功能（Wow 页面、家庭冲突）统一走 context-engine
- P1：改造 Prep Agent（最需要丰富上下文）
- P2：改造 Radar（量最大，最后改）

### 三档注入

| 档位 | Token | 用途 | 触发 |
|------|-------|------|------|
| 轻量 | ~200 | 摘要：逾期承诺 + 关键事实 | 每次 LLM 调用 |
| 标准 | ~400 | 1-hop：这个人 + 承诺/互动/角色 | 提到某人时 |
| 深度 | ~600+ | 2-hop：这个人的关系网 | 会前准备/复杂决策 |

### 多模式 Context Bundle

不同场景，Context Bundle 内容不同：

| 场景 | 核心内容 | 档位 |
|------|---------|------|
| 回复邮件 | 承诺 + 互动历史 + 关系温度 | 标准 |
| 会前准备 | 客户画像 + 未了承诺 + 组织背景 + 上次见面内容 | 深度 |
| 出差规划 | 目的地客户 + 城市知识 + 待办 | 深度 |
| Daily Briefing | 今日日程 + 逾期承诺 + 冷却关系 | 轻量 |
| 家庭冲突 | 家庭事件 + 工作事件 + 冲突点 | 轻量 |

---

## 四、Agent 体系

### Agent × 纲领映射

**防守型（P1：一个都不丢）：**

| Agent | 纲领动作 | 纲领方向 | 触发 | 状态 |
|-------|---------|---------|------|------|
| **Radar** | 盯着 | 全方向 | Cron 2h | ✅ |
| **Weaver** | 盯着+提醒 | 客户不丢 | Cron 每天 → shouldNotify() → 推送 | ⚠️ 算法有，推送接通中 |
| **Briefing** | 提醒 | 全方向 | Cron 每天早上 | ✅ |
| **Radar Push** | 提醒 | 全方向 | Cron 2h → shouldNotify() | ✅ |
| **Prep** | 准备 | 客户+差旅 | Cron 15min（会前30分钟） | ✅ |
| **Ghostwriter** | 准备 | 客户不丢 | 用户触发"帮我回复" | ✅ |
| **Closer** | 准备 | 客户不丢 | 逾期48h → 草拟催促 | ✅ |
| **Travel Brain** | 准备 | 差旅不乱 | Trip 检测 → 落地简报 | ⚠️ 接通中 |
| **Debrief** | 准备 | 全方向 | 用户触发 / Trip 结束 | ✅ |

**进攻型（P2：找球）：**

| Agent | 纲领动作 | 纲领方向 | 说明 |
|-------|---------|---------|------|
| **Prospector** | 找球 | 客户不丢 | 转介绍检测 + 生命事件 → 商业机会 |

### Agent 协作规则

1. **Agent 不互相调用。** 通过本体表（共享数据层）通信。
2. **Agent 通过 context-engine 获取上下文。** 不自己拼 SQL。
3. **Agent 通过 getSignals() 读取消息。** 不直接查渠道表。
4. **Agent 的推送通过 shouldNotify() 判断。** 包含时间、会议、频率三重限制。

### 调度架构

```
┌────────────────────────────────────────────────────┐
│                    调度层                            │
│                                                     │
│  时间驱动（Cron）             事件驱动（触发）        │
│  ├── 15min: 感知（邮件同步）   ├── OAuth 完成 → 首次同步│
│  ├── 15min: 理解（承诺提取）   ├── 新邮件 Webhook      │
│  ├── 15min: Prep Agent        ├── 日历变更             │
│  ├── 2h:   Radar + Push      ├── 用户"帮我回复"       │
│  ├── 每天:  Briefing          ├── Trip 检测到          │
│  └── 每天:  Weaver            └── Trip 结束            │
│                                                     │
│  所有推送 → shouldNotify(userId, urgency, category) │
│           → 通过 → 推送（WhatsApp / Dashboard / 邮件）│
│           → 不通过 → 静默（存 DB，用户下次打开时看到） │
└────────────────────────────────────────────────────┘
```

---

## 五、5 分钟 Wow

纲领说"连上 Gmail，5 分钟见效"。**分两步实现**：

### Step 1：即时 Wow（30 秒，不依赖 LLM）

```
OAuth 完成
  → 立刻拉取邮件元数据（发件人、时间、主题）
  → 立刻拉取日历事件
  → 纯数据库计算：
      📧 未回复邮件数（is_reply_needed）
      🧊 冷却联系人（最后互动 > 30 天的重要联系人）
      📅 下周冲突（日历事件交叉 + 家庭日历）
  → 渲染第一屏："你有 X 个人很久没联系了，下周有 Y 个冲突"
```

用户在 30 秒内看到有价值的信息，不会面对空白页。

### Step 2：深度 Wow（3-5 分钟，后台 LLM，SSE 实时推送）

```
后台启动承诺提取（/api/commitments/scan-stream，SSE）
  → 每提取到一个承诺，前端动态添加
  → 用户看到：
      "正在扫描 90 天邮件..."
      "已发现：你答应 Lisa 周五给报价（逾期 4 天）"
      "已发现：David 在等你的合同修改..."
  → 3-5 分钟后完整展示：
      🔴 X 个逾期承诺
      🟡 Y 个冷却关系
      📧 Z 封需要回复
      📅 W 个日程冲突
```

**Step 1 给即时价值，Step 2 给持续惊喜。用户不会盯着空白页等 5 分钟。**

---

## 六、AI 层

### 模型路由

| 任务类型 | 温度 | Token | 模型级别 |
|---------|------|-------|---------|
| 分类/提取 | 0.1 | 300 | fast |
| 写作/回复 | 0.5 | 500 | standard |
| 创意/简报 | 0.7 | 400 | standard |
| 推理/验证 | 0.1 | 1500-2000 | reasoning |

### 可插拔架构

```
router.ts
├── 系统默认: DeepSeek API
├── 用户自选: profiles.llm_provider + llm_api_key_encrypted
└── 支持: DeepSeek / OpenAI / Claude / Groq / Ollama / 自定义 base_url
```

### Recall 提升计划

当前 Recall 60%，72% 漏检是方向判断错误。提升路径：

```
P1-a: 加 5 组方向对比 few-shot（成本零，预期 +10-15%）
P1-b: Tier 2 Reasoner 评估（已建，待跑 eval）
P1-c: 用户反馈闭环（commitment_feedback → 个性化 few-shot）
目标: P1 结束 Recall ≥75%
```

---

## 七、部署架构

### SaaS 模式（个人版/团队版）

```
Vercel (App + API + Cron)
Supabase Cloud (DB + Auth)  — Sydney region
DeepSeek API (默认 LLM)
```

### 企业模式（本地部署）

```yaml
version: '3.8'

services:
  app:
    build: ./web
    ports: ["3000:3000"]
    env_file: .env
    volumes:
      - wa-sessions:/data/.wa-sessions
    depends_on: [db]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  cron:
    build: ./web
    command: node cron-worker.js
    env_file: .env
    depends_on: [app, db]

  db:
    image: supabase/postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  backup:
    image: postgres:15
    command: sh -c 'while true; do pg_dump -h db -U postgres sophia > /backups/sophia_$(date +\%Y\%m\%d).sql; sleep 86400; done'
    volumes:
      - backups:/backups
    depends_on: [db]

volumes:
  pgdata:
  wa-sessions:
  backups:
```

### 模式切换

```
DEPLOY_MODE=saas    → Vercel Cron, Supabase Cloud
DEPLOY_MODE=docker  → node-cron, 本地 PG, 独立 cron 容器
```

代码不 fork，同一套代码库。

### 监控

```
/api/health/sync-status
→ 最后一次邮件同步时间
→ 最后一次承诺提取时间
→ 未处理邮件数
→ 超过 1 小时没同步 → 告警
```

---

## 八、纲领 → 架构映射

| 纲领说的 | 架构怎么实现 | 状态 |
|---------|------------|------|
| "自动知道你答应了谁什么" | Signal → 承诺提取管线 → Commitment | ✅ P100% R60% |
| "盯着" | Radar + Weaver + Cron 扫描 | ✅ |
| "提醒：往后看" | 逾期承诺 + 冷却关系 → shouldNotify() → 推送 | ⚠️ 冷却推送待接 |
| "提醒：往前看" | Briefing（今日日程 + 到期承诺 + 冲突） | ✅ |
| "准备" | Context Engine 三档注入 → Prep / Ghostwriter | ✅ |
| "不需要你录入" | 邮件/WhatsApp/日历自动同步 → Signal 归一化 | ✅ |
| "该静就静" | shouldNotify()（时间+会议+频率三重限制） | 🔜 待建 |
| "5 分钟见效" | 两步 Wow：即时数据 + 后台 LLM | 🔜 待建 |
| "数据是你的" | 可插拔 LLM + Docker 本地部署 | ✅ LLM / ⚠️ Docker compose 待建 |
| "客户不丢" | roles=client + Commitment + Weaver + Closer | ⚠️ roles 待加 |
| "差旅不乱" | Trip 本体 + Travel Brain + 城市知识 + 联系人×城市 | ⚠️ 触发器+城市匹配待接 |
| "家庭不忘" | roles=family + family_calendar + 硬约束冲突检测 | 🔜 待建 |
| "保单到期提醒" | Policy 表（垂直扩展层） | 🔜 P2 |
| "转介绍检测" | Prospector Agent | 🔜 P2 |
| "宁可漏不可错" | confidence ≥ 0.4 + 方向 few-shot + Tier 2 Reasoner | ⚠️ few-shot 待加 |

---

## 九、实施路径

| 阶段 | 内容 | 周期 |
|------|------|------|
| **Week 1** | 5 分钟 Wow（两步体验 + 首次同步即时触发） | 1 周 |
| **Week 2** | 提醒补全（Weaver→推送 + 家庭冲突 + shouldNotify） | 1 周 |
| **Week 3** | 差旅补全（落地简报触发器 + 联系人×城市 + Contact roles） | 1 周 |
| **Week 4** | AI 质量（方向 few-shot + Context Engine 统一 Prep + signals 查询函数） | 1 周 |
| **Week 5-6** | 企业部署（docker-compose + cron-worker + 健康检查 + 备份） | 2 周 |
| **P2** | 垂直扩展（Policy + Life Event + Prospector）+ Topic 聚合 | 待定 |

---

*本文档随产品演进更新。所有架构决策以 SOPHIA_MANIFESTO.md 为准。*
