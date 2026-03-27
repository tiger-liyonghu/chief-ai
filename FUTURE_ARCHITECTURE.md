# AI Chief of Staff — 未来系统架构

**版本**: 2.0 Vision
**日期**: 2026-03-28

---

## 一、架构演进：从工具集 → 智能体平台

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                        用户触点层 (User Layer)                        │
│                                                                     │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│   │ Web App  │  │ Mobile   │  │ Telegram │  │ WhatsApp Bot     │  │
│   │(Next.js) │  │ (PWA)    │  │   Bot    │  │ (推送/交互)       │  │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────────┘  │
│        └──────────────┴─────────────┴───────────────┘              │
│                              │                                      │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                      API Gateway / BFF 层                             │
│                     (Vercel Edge Functions)                           │
│                                                                      │
│   认证 ─── 限流 ─── 路由 ─── 日志 ─── WebSocket (SSE)                │
│                                                                      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
┌───────────────────┐ ┌───────────────┐ ┌────────────────────────────┐
│                   │ │               │ │                            │
│  Serverless API   │ │  Agent Worker │ │  Channel Connectors        │
│  (Vercel)         │ │  (长驻进程)    │ │  (长驻进程)                 │
│                   │ │               │ │                            │
│ · /api/sync       │ │ · Radar       │ │ · Gmail Webhook Receiver   │
│ · /api/chat       │ │ · Closer      │ │ · Outlook Webhook Receiver │
│ · /api/briefing   │ │ · Prep        │ │ · WhatsApp Baileys         │
│ · /api/tasks      │ │ · Weaver      │ │ · Telegram Bot             │
│ · /api/emails     │ │ · Travel Brain│ │ · (未来: Slack, 微信)       │
│ · /api/meeting-ctx│ │               │ │                            │
│                   │ │ 事件驱动调度:   │ │ 统一消息格式:               │
│                   │ │ · Inngest     │ │ · 入站 → 标准化 → DB       │
│                   │ │ · 或 BullMQ   │ │ · 出站 → 渠道适配 → 发送   │
│                   │ │               │ │                            │
└───────┬───────────┘ └───────┬───────┘ └─────────────┬──────────────┘
        │                     │                       │
        └─────────────────────┼───────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                   Unified Context Engine (核心大脑)                    │
│                                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │  联系人图谱   │ │  承诺状态机   │ │  统一时间线   │ │ 用户偏好    │ │
│  │              │ │              │ │              │ │ 模型        │ │
│  │ · 跨渠道身份 │ │ · i_promised │ │ · 全渠道事件 │ │ · 写作风格  │ │
│  │   合并       │ │ · waiting_on │ │   按时间排列 │ │ · 优先级    │ │
│  │ · 关系强度   │ │ · 到期追踪   │ │ · 按联系人   │ │   判断模式  │ │
│  │ · 互动频率   │ │ · 升级策略   │ │   分组       │ │ · 时区偏好  │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│                                                                      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
┌───────────────────┐ ┌───────────────┐ ┌────────────────────────────┐
│                   │ │               │ │                            │
│   AI 推理层       │ │   数据存储层   │ │   外部服务                  │
│                   │ │               │ │                            │
│ · LLM Router     │ │ · Supabase    │ │ · Google APIs              │
│   (按任务选模型)  │ │   (PostgreSQL)│ │ · Microsoft Graph          │
│                   │ │               │ │ · WhatsApp Web             │
│ · DeepSeek       │ │ · Redis       │ │ · Telegram Bot API         │
│   (默认/便宜)    │ │   (缓存/队列) │ │ · Google Places            │
│ · GPT-4o         │ │               │ │ · 地图/交通 API             │
│   (复杂推理)     │ │ · S3/R2       │ │                            │
│ · Claude         │ │   (附件存储)  │ │                            │
│   (长文档分析)   │ │               │ │                            │
│ · 用户自选       │ │               │ │                            │
│                   │ │               │ │                            │
└───────────────────┘ └───────────────┘ └────────────────────────────┘
```

---

## 二、关键架构决策

### 当前（Phase 1-2） vs 未来（Phase 3-4）

| 维度 | 当前架构 | 未来架构 | 迁移策略 |
|------|---------|---------|---------|
| **计算** | Vercel Serverless 全部 | Serverless (API) + 长驻 Worker (Agent) | 渐进拆分，先用 Inngest 做事件调度 |
| **消息通道** | 各通道独立代码 | 统一 Channel Connector 抽象层 | 加 adapter pattern，新通道只写 adapter |
| **AI 调用** | 单模型直调 | LLM Router（按任务类型自动选模型） | 先在 unified-client 加路由逻辑 |
| **数据** | Supabase 单库 | Supabase + Redis (缓存) + 对象存储 | 热数据留 PG，冷数据归档，附件存 R2 |
| **实时性** | 5 分钟轮询同步 | Webhook 推送 + 实时处理 | Gmail/Outlook 都支持 Push Notification |
| **Agent** | 12 个 AI Prompt 独立调用 | 7 个 Agent 通过事件总线协作 | 先建 Context Engine，再逐个 Agent 上线 |

---

## 三、Channel Connector 统一抽象

```typescript
// 未来的统一消息接口
interface ChannelConnector {
  // 身份
  provider: 'gmail' | 'outlook' | 'whatsapp' | 'telegram' | 'slack'

  // 核心能力
  connect(userId: string, credentials: any): Promise<void>
  disconnect(userId: string): Promise<void>

  // 消息
  listMessages(opts: ListOpts): Promise<UnifiedMessage[]>
  sendMessage(to: string, content: MessageContent): Promise<void>

  // 同步
  sync(userId: string, since?: Date): Promise<SyncResult>

  // Webhook（实时推送）
  handleWebhook?(payload: any): Promise<void>
}

// 统一消息格式 — 所有渠道标准化为同一结构
interface UnifiedMessage {
  id: string
  channel: string              // 'gmail' | 'outlook' | 'whatsapp' | 'telegram'
  threadId: string
  from: Contact
  to: Contact[]
  subject?: string             // 邮件有，聊天没有
  body: string
  bodyHtml?: string
  attachments?: Attachment[]
  direction: 'inbound' | 'outbound'
  receivedAt: Date
  metadata: Record<string, any>  // 渠道特定数据
}
```

**好处**：新增一个渠道（如 Telegram）只需要实现一个 adapter，所有 Agent 和 AI 管线自动支持，不需要改其他代码。

---

## 四、Agent Worker 架构

```
┌─────────────────────────────────────────────────────────┐
│                    Event Bus (Inngest)                    │
│                                                          │
│  事件类型:                                                │
│  · message.received    — 任何渠道收到新消息               │
│  · message.sent        — 任何渠道发出消息                 │
│  · calendar.event.soon — 会议即将开始（30分钟前）         │
│  · commitment.overdue  — 承诺到期                         │
│  · sync.completed      — 同步完成                         │
│  · timezone.changed    — 用户时区变化（检测到出差）        │
│  · daily.morning       — 每日早间触发                     │
│  · weekly.friday       — 每周五触发                       │
│                                                          │
└────┬──────┬──────┬──────┬──────┬──────┬──────┬───────────┘
     │      │      │      │      │      │      │
     ▼      ▼      ▼      ▼      ▼      ▼      ▼
  Radar  Ghost-  Prep  Closer Weaver Travel Debrief
         writer                 Brain
```

**每个 Agent 是一个 Inngest Function：**

```typescript
// 示例：Prep Agent
inngest.createFunction(
  { id: 'prep-agent' },
  { event: 'calendar.event.soon' },
  async ({ event, step }) => {
    const { userId, eventId } = event.data

    // Step 1: 拉取会议上下文
    const context = await step.run('fetch-context', () =>
      fetchMeetingContext(eventId)
    )

    // Step 2: 生成 AI 简报
    const briefing = await step.run('generate-briefing', () =>
      generateMeetingBriefing(context)
    )

    // Step 3: 推送给用户
    await step.run('notify', () =>
      pushNotification(userId, briefing)
    )
  }
)
```

---

## 五、数据飞轮

```
用户连接渠道
    │
    ▼
收到更多消息 ──────────────────────┐
    │                              │
    ▼                              │
AI 分析更准确                       │
(联系人关系、写作风格、优先级判断)    │
    │                              │
    ▼                              │
用户更依赖 Chief                    │
(回复更快、漏掉更少、准备更充分)      │
    │                              │
    ▼                              │
连接更多渠道 ──────────────────────┘
    │
    ▼
迁移成本越来越高
(6个月数据 = 写作风格模型 + 关系图谱 + 承诺历史)
    │
    ▼
护城河形成
```

---

## 六、安全架构

```
┌─────────────────────────────────────────────────────┐
│                    安全层                             │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ 传输加密     │  │ 存储加密      │  │ 访问控制    │ │
│  │ · HTTPS/TLS │  │ · AES-256-GCM│  │ · RLS      │ │
│  │ · WSS       │  │   (OAuth令牌) │  │ · JWT      │ │
│  │             │  │ · 邮件正文    │  │ · API Key  │ │
│  │             │  │   不持久存储   │  │ · RBAC     │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ 数据隔离     │  │ 合规         │  │ 审计       │  │
│  │ · 用户间     │  │ · GDPR      │  │ · 操作日志 │  │
│  │   完全隔离   │  │ · 数据留存   │  │ · AI调用   │  │
│  │ · LLM不存储  │  │   可配置     │  │   追踪     │  │
│  │   用户数据   │  │ · 数据导出   │  │            │  │
│  └─────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 七、扩展路径

### Phase 2 → 3 的关键里程碑

```
Phase 2（当前）                    Phase 3                         Phase 4
─────────────                    ───────                         ───────

Gmail + Outlook + WhatsApp       + Telegram                      + Slack
直接 API 调用                     + Channel Connector 抽象层       + 微信（企业微信）
5分钟轮询同步                     + Gmail/Outlook Push Webhook     + 自定义渠道 Plugin
12 个独立 AI Prompt              + Inngest Event Bus              + 公开 API
Supabase 单库                    + Redis 缓存层                   + 多租户企业版
单 LLM 调用                      + LLM Router                     + 本地部署选项
                                 + Radar + Prep Agent 上线        + 全部 7 Agent
                                 + Unified Context Engine         + Agent Marketplace
```

### 每个阶段的技术门槛

| 阶段 | 核心技术挑战 | 预计工时 |
|------|------------|---------|
| **Phase 2→3 过渡** | Channel Connector 抽象 + Inngest 集成 | 2-3 周 |
| **Context Engine** | 跨渠道联系人 Entity Resolution | 3-4 周 |
| **Radar Agent** | 实时信号评分 + 推送系统 | 2-3 周 |
| **Prep Agent** | 会议上下文 API 已有，加定时触发 | 1 周 |
| **LLM Router** | 按任务类型/复杂度自动选模型 | 1 周 |
| **Push Webhook** | Gmail/Outlook Watch API 替代轮询 | 1-2 周 |

---

## 八、投资人视角的架构亮点

1. **渐进式架构** — 不需要重写，当前代码可以平滑演进到 Agent 架构
2. **通道抽象** — 新增通讯渠道的边际成本趋近于零
3. **数据飞轮** — 用户越用越准，迁移成本越来越高
4. **成本优势** — DeepSeek 让 AI 推理成本比竞品低 10-50x
5. **多 LLM** — 不绑死任何一家 AI 厂商，抗风险能力强
6. **安全设计** — AES 加密、RLS 隔离、GDPR 合规，企业级就绪
