# AI Chief of Staff -- 产品功能与系统架构整合文档

**版本**: 1.0
**日期**: 2026-03-27
**状态**: 活跃

---

## 一、产品概述

### 产品名称
AI Chief of Staff (简称 Chief)

### 定位
面向新加坡、印度、美国、欧洲的创业者和高管的 AI 通信助手。整合 Gmail、Outlook、WhatsApp 等多渠道通信，通过 AI 自动提取待办、起草回复、追踪承诺、准备会议，让忙碌的创业者不再遗漏重要事项。

### 目标用户
- 频繁出差的创业者 / 创始人
- 管理多渠道通信的 C-level 高管
- 需要跨时区协作的商务人士

### 核心价值主张
1. **统一入口** -- 一个界面管理 Gmail + Outlook + WhatsApp 全部通信
2. **AI 主动提取** -- 从邮件/消息中自动识别任务、承诺、跟进事项
3. **商旅智能** -- 自动检测出差、准备会前简报、推荐餐厅、追踪差旅费用
4. **可选 LLM** -- 用户可使用自己的 API Key（DeepSeek/OpenAI/Claude/Groq/Ollama/自定义）

---

## 二、功能模块全景图

### 模块总览

| # | 模块名称 | 功能描述 | 当前状态 | API 路由 | 前端页面 |
|---|---------|---------|---------|---------|---------|
| 1 | **认证与登录** | Supabase Auth 认证，Google/Microsoft OAuth 绑定 | 已上线 | `/api/auth/login`, `/api/auth/callback`, `/api/auth/session` | 登录页 |
| 2 | **多账户管理** | 绑定多个 Gmail / Outlook 账户，统一管理 | 已上线 | `/api/accounts`, `/api/accounts/add`, `/api/accounts/callback`, `/api/accounts/add-outlook`, `/api/accounts/outlook-callback` | Settings 页 |
| 3 | **邮件收件箱** | 展示需要回复的邮件，支持按账户过滤 | 已上线 | `/api/emails`, `/api/emails/[id]`, `/api/emails/[id]/thread` | Replies 页 |
| 4 | **AI 回复起草** | 基于邮件上下文生成回复草稿（流式输出），支持语气选择 | 已上线 | `/api/ai/draft-reply` | Replies 页内 |
| 5 | **邮件发送** | 审核后发送回复 / 转发邮件（Gmail） | 已上线 | `/api/send-reply`, `/api/forward` | Replies 页内 |
| 6 | **数据同步** | 增量同步 Gmail + Outlook 的邮件与日历，支持 History API | 已上线 | `/api/sync`, `/api/sync/process` | SyncManager 组件 |
| 7 | **AI 处理管线** | 自动从邮件中提取任务、检测出差、扫描承诺 | 已上线 | `/api/sync/process` | -- |
| 8 | **任务管理** | AI 提取 + 手动创建任务，优先级三级，状态流转 | 已上线 | `/api/tasks` | Tasks 页 |
| 9 | **跟进追踪** | 三种类型：等对方回复 / 我答应的 / 需要回复 | 已上线 | `/api/follow-ups` | Follow-ups 页 |
| 10 | **日历视图** | 展示未来两周日历事件 | 已上线 | `/api/calendar`, `/api/calendar/events` | Calendar 页 |
| 11 | **会议准备** | 为每场会议生成参会者简报（互动历史、谈话要点） | 已上线 | `/api/meetings`, `/api/meetings/generate-brief`, `/api/meeting-context/[eventId]` | Meetings 页 |
| 12 | **Daily Briefing** | AI 生成每日简报（今日日程、待办、需回复邮件、跟进、VIP 动态） | 已上线 | `/api/briefing` | Dashboard 主页 |
| 13 | **邮件摘要推送** | 定时发送 Digest 邮件到用户邮箱 | 已上线 | `/api/digest`, `/api/digest/schedule`, `/api/cron/digest` | Settings 页 |
| 14 | **智能提醒** | 检测日历冲突、过期跟进、VIP 邮件等异常信号 | 已上线 | `/api/alerts` | AlertsBanner 组件 |
| 15 | **商旅管理** | 从邮件自动检测航班/酒店，管理行程 | 已上线 | `/api/trips`, `/api/trips/detect`, `/api/trips/pre-flight`, `/api/trips/landing-briefing`, `/api/trips/report` | Trips 页 |
| 16 | **差旅费用** | 手动/AI 录入费用，按行程归类，支持导出 | 已上线 | `/api/expenses`, `/api/expenses/export` | Expenses 页 |
| 17 | **交通建议** | 两个相邻会议间的交通方式/时间/费用估算 | 已上线 | `/api/transport` | TransportCard 组件 |
| 18 | **餐厅推荐** | 基于会议地点和时段推荐新加坡餐厅 | 已上线 | `/api/recommendations` | Recommendations 组件 |
| 19 | **联系人管理** | 自动从邮件中识别联系人关系类型和重要度 | 已上线 | `/api/contacts`, `/api/contacts/[id]`, `/api/contacts/detect` | -- (嵌入其他页面) |
| 20 | **AI 对话** | 多轮对话，支持 Function Calling（创建任务/事件/回复等） | 已上线 | `/api/chat` | ChatPanel 组件 |
| 21 | **全局搜索** | 跨邮件、任务、日历事件的统一搜索 | 已上线 | `/api/search` | GlobalSearch 组件 |
| 22 | **WhatsApp** | 通过 Baileys QR 码连接个人 WhatsApp，读取消息 | 已上线 | `/api/whatsapp`, `/api/whatsapp/messages` | Settings 页 |
| 23 | **LLM 设置** | 用户自选 LLM 提供商和 API Key | 已上线 | `/api/settings/llm` | Settings 页 |
| 24 | **引导流程** | 新用户引导（时区、语言、绑定账户） | 已上线 | `/api/onboarding` | OnboardingProgress 组件 |
| 25 | **个人设置** | 语言、时区、写作风格、Daily Brief 时间 | 已上线 | `/api/settings` | Settings 页 |
| 26 | **多语言** | 英文/中文 i18n | 已上线 | -- | lib/i18n |
| 27 | **闹钟建议** | 基于明日首个会议 + 交通时间建议起床闹钟 | 已上线 | -- | AlarmSuggestion 组件 |
| 28 | **出发提醒** | 距下一会议的出发倒计时 | 已上线 | -- | DepartureReminder 组件 |

### 前端页面清单

| 页面路径 | 功能 |
|---------|------|
| `/dashboard` | 主页 -- Daily Briefing + 提醒 + 快捷操作 |
| `/dashboard/replies` | 邮件回复队列 |
| `/dashboard/tasks` | 任务管理 |
| `/dashboard/follow-ups` | 跟进追踪 |
| `/dashboard/calendar` | 日历视图 |
| `/dashboard/meetings` | 会议准备 + 简报 |
| `/dashboard/trips` | 商旅管理 |
| `/dashboard/expenses` | 差旅费用 |
| `/dashboard/settings` | 设置（账户、LLM、语言、通知） |

### 核心组件清单

| 组件 | 功能 |
|------|------|
| `ChatPanel` | AI 对话面板（侧边栏常驻） |
| `AlertsBanner` | 智能提醒横幅 |
| `GlobalSearch` | 全局搜索 |
| `SyncManager` | 后台数据同步触发器 |
| `TransportCard` | 交通建议卡片 |
| `Recommendations` | 餐厅推荐 |
| `AlarmSuggestion` | 闹钟建议 |
| `DepartureReminder` | 出发倒计时 |
| `OnboardingProgress` | 引导进度 |
| `Sidebar` | 导航侧边栏 |
| `TopBar` | 顶部导航栏 |

---

## 三、通讯渠道矩阵

### 当前渠道能力对比

| 能力 | Gmail | Outlook | WhatsApp |
|------|-------|---------|----------|
| **OAuth 认证** | Google OAuth 2.0 | Microsoft OAuth 2.0 (Graph API) | Baileys QR 码扫描 |
| **读取消息** | 已实现 (Gmail API + History API 增量同步) | 已实现 (Microsoft Graph + Delta 查询) | 已实现 (Baileys 实时监听) |
| **发送消息** | 已实现 (Gmail API sendMessage) | 规划中 | 规划中 (AI 自动回复开关已有) |
| **日历同步** | 已实现 (Calendar API + SyncToken) | 已实现 (Graph Calendar API) | 不适用 |
| **AI 分析** | 已实现 (任务提取/承诺扫描/出差检测) | 已实现 (同步后共享同一 AI 管线) | 部分实现 (消息提取 prompt 已有) |
| **多账户** | 已实现 (多 Google 账户) | 已实现 (多 Microsoft 账户) | 单账户 (一个用户一个 WhatsApp 连接) |
| **联系人识别** | 已实现 (AI 分类关系类型) | 已实现 (共享联系人表) | 规划中 |
| **承诺追踪** | 已实现 (出站邮件承诺扫描) | 已实现 (共享管线) | 规划中 |
| **部署位置** | Vercel (Next.js API Routes) | Vercel (Next.js API Routes) | Railway (独立 Node.js 服务) |

### 渠道架构说明

- **Gmail / Outlook**: 通过 Next.js API Routes 在 Vercel 上运行，使用 OAuth 令牌访问 Google/Microsoft API。增量同步机制减少 API 调用。
- **WhatsApp**: 由于 Baileys (非官方 WhatsApp Web 协议库) 需要长连接和本地文件存储 session，无法运行在 Serverless 环境中。因此拆分为独立的 Express 服务部署在 Railway，通过 HTTP API 与 Next.js 主应用通信。

### 未来可扩展渠道

| 渠道 | 技术路径 | 优先级 | 复杂度 |
|------|---------|--------|--------|
| **Telegram** | Telegram Bot API (Webhook) | P2 | 低 -- 标准 REST API |
| **Slack** | Slack App + OAuth + Events API | P2 | 中 -- 需处理 Workspace 多租户 |
| **微信** | 企业微信 API / itchat 方案 | P3 | 高 -- 微信生态封闭，API 受限 |
| **iMessage** | Apple Business Chat 或 macOS 本地桥接 | P3 | 高 -- 平台限制严格 |
| **SMS** | Twilio API | P3 | 低 -- 但成本高 |
| **LinkedIn** | LinkedIn Messaging API (受限) | P3 | 中 -- API 访问需申请 |

---

## 四、AI Agent 架构

### 4.1 设计哲学

三大核心趋势驱动 Agent 设计：
1. **从被动响应到主动行动** -- AI 基于上下文信号自主触发
2. **从单点工具到跨应用编排** -- Agent 串联多个模块完成端到端工作流
3. **从一个大 Agent 到专业化小 Agent 协作** -- 每个 Agent 有明确职责，通过共享上下文层协作

**设计原则**: 每个 Agent 必须至少串联 3 个模块，否则它只是一个"功能"而不是"Agent"。

### 4.2 共享基础层: Unified Context Engine

所有 Agent 共享的"大脑"：

| 组件 | 数据来源 | 作用 |
|------|---------|------|
| 联系人图谱 | Gmail + Outlook + WhatsApp + Calendar | 跨渠道身份合并、关系强度、最近互动 |
| 时间线 | 所有模块 | 某个人/项目的全部事件按时间排列 |
| 承诺状态机 | 出站邮件/WhatsApp + 跟进模块 | "我答应了X" / "我在等Y" 的实时状态 |
| 用户偏好模型 | Chat 历史 + 行为数据 | 写作风格、决策模式、时区偏好、餐厅口味 |

### 4.3 七个 Agent 方案

#### Agent 1: Radar (雷达扫描) -- P0 自动执行型

**职责**: 7x24 静默监控所有渠道，识别需要用户注意的"信号"，按紧急程度分级推送。

**串联模块**: Gmail + Outlook + WhatsApp + Calendar + Tasks + Follow-ups + Contacts

**通讯渠道交互**:
- **Gmail / Outlook**: 实时监听新邮件，识别"隐性紧急"邮件（如投资人语气平和但需优先回复）
- **WhatsApp**: 检测渠道切换信号（WhatsApp 未回 -> 邮件追问 = 紧急）
- **输出**: 推送到 Dashboard AlertsBanner + 未来推送到 WhatsApp/邮件

**与现有功能的关系**: 将 Daily Briefing 从"每日一次快照"升级为"持续运行的实时守望"，将 Alerts 从"简单规则检测"升级为"上下文感知智能过滤"。

---

#### Agent 2: Ghostwriter (代笔人) -- P0 对话触发型

**职责**: 基于完整上下文生成跨渠道的回复策略。

**串联模块**: Gmail + Outlook + WhatsApp + Calendar + Contacts + Tasks + Follow-ups

**通讯渠道交互**:
- **Gmail / Outlook**: 拉取邮件线程上下文 + 发送审核后的回复
- **WhatsApp**: 读取跨渠道互动历史，建议最佳回复渠道
- **输出**: 生成回复草稿到 Replies 页面或 ChatPanel

**与现有功能的关系**: 将 AI Draft Reply 从"单邮件上下文"升级为"联系人画像 + 承诺状态 + 日程空余"的全上下文回复。

---

#### Agent 3: Prep (会前准备官) -- P0 自动执行型

**职责**: 每个日历事件前 30 分钟自动生成"作战简报"。

**串联模块**: Calendar + Contacts + Gmail + Outlook + WhatsApp + Tasks + Follow-ups + Recommendations

**通讯渠道交互**:
- **Gmail / Outlook**: 拉取与参会者的邮件往来历史
- **WhatsApp**: 补充 WhatsApp 渠道的互动记录
- **输出**: 推送简报到 Meetings 页 + 通知

**与现有功能的关系**: 将 Meeting Briefs 从"被动展示数据"升级为"主动分析 + 行动建议 + 雷区预警"。

---

#### Agent 4: Closer (闭环追踪器) -- P1 自动执行型

**职责**: 自动追踪所有"开环"事项，在接近超时时自动触发下一步动作链。

**串联模块**: Follow-ups + Tasks + Gmail + Outlook + WhatsApp + Calendar + Contacts

**通讯渠道交互**:
- **Gmail / Outlook**: 超时后自动生成跟进邮件草稿
- **WhatsApp**: 建议渠道升级（邮件无回复 -> 建议 WhatsApp 跟进）
- **输出**: 草稿进入 Replies 待审核队列

**与现有功能的关系**: 将 Follow-ups 从"提醒用户该跟了"升级为"准备好草稿，用户一键确认发送"。

---

#### Agent 5: Weaver (关系织网者) -- P1 混合型

**职责**: 主动维护人脉网络健康度，识别正在冷却的重要关系。

**串联模块**: Contacts + Gmail + Outlook + WhatsApp + Calendar + Recommendations

**通讯渠道交互**:
- **Gmail / Outlook / WhatsApp**: 综合计算每个联系人的"关系温度"（跨渠道互动频率、多样性、质量）
- **输出**: 每周关系健康报告 + Chat 中支持关系查询

**与现有功能的关系**: 将 Contacts 从"静态联系人列表"升级为"动态关系 CRM"。

---

#### Agent 6: Travel Brain (商旅大脑) -- P1 混合型

**职责**: 出差全流程自动编排。

**串联模块**: Calendar + Gmail + Outlook + Contacts + Recommendations + Tasks + Briefing + WhatsApp

**通讯渠道交互**:
- **Gmail / Outlook**: 解析航班/酒店确认邮件，自动创建行程
- **WhatsApp**: 出差期间与当地联系人的消息高亮
- **输出**: 出差时间线、每日简报时区适配、回程摘要

**与现有功能的关系**: 将 Trips + Expenses + Pre-flight + Landing Briefing 从"独立工具"升级为"端到端出差智能体"。

---

#### Agent 7: Debrief (复盘助手) -- P2 对话触发型

**职责**: 在 Chat 中触发，对特定时间段或项目进行结构化复盘。

**串联模块**: Gmail + Outlook + WhatsApp + Calendar + Tasks + Follow-ups + Contacts

**通讯渠道交互**:
- **全渠道**: 拉取指定时间窗口的全部通信记录，编织成叙事
- **输出**: 复盘报告在 ChatPanel 中展示

**与现有功能的关系**: 新功能，依赖所有现有模块的数据但不修改它们。

### 4.4 Agent 间数据流

```
                        ┌─────────────────────────────────┐
                        │   Unified Context Engine (共享层)  │
                        │  联系人图谱 | 时间线 | 承诺状态机    │
                        │        | 用户偏好模型              │
                        └──────┬─────────┬────────┬────────┘
                               │         │        │
          ┌────────────────────┼─────────┼────────┼───────────────┐
          │                    │         │        │               │
    ┌─────▼─────┐       ┌─────▼────┐  ┌─▼────┐  ┌▼──────┐  ┌────▼─────┐
    │  Radar    │──信号──▶Ghostwriter│  │ Prep │  │Closer │  │Travel    │
    │  (扫描)   │       │  (代笔)   │  │(准备)│  │(闭环) │  │Brain     │
    └─────┬─────┘       └────┬─────┘  └──┬───┘  └──┬────┘  └────┬─────┘
          │                  │           │         │             │
          │    ┌─────────────┘           │         │             │
          │    │  ┌──────────────────────┘         │             │
          │    │  │  ┌─────────────────────────────┘             │
          ▼    ▼  ▼  ▼                                          │
    ┌──────────────────┐        ┌────────┐              ┌───────▼──────┐
    │     Weaver       │◀───────│Debrief │              │  餐厅推荐    │
    │   (关系织网)      │        │(复盘)  │              │  交通建议    │
    └──────────────────┘        └────────┘              └──────────────┘
```

**关键数据流**:
- Radar 的紧急信号 -> Ghostwriter (优先回复) + Closer (加速跟进)
- Ghostwriter 的已发送回复 -> Closer (更新承诺状态) + Weaver (更新互动记录)
- Prep 的会前简报 -> Ghostwriter (会中可能需要的回复) + Closer (会后待办)
- Closer 的跟进结果 -> Weaver (互动事件) + Radar (状态更新)
- Weaver 的关系洞察 -> Prep (参会者画像) + Travel Brain (目的地联系人)
- Travel Brain 的出差上下文 -> Prep (本地化会议准备) + Radar (时区感知优先级)
- Debrief 的复盘洞察 -> Weaver (关系趋势) + Tasks (未完成项高亮)

### 4.5 关键设计决策

| 决策 | 内容 | 理由 |
|------|------|------|
| Human-in-the-loop | 所有对外发送的动作必须经过用户确认 | 每条对外消息代表个人品牌，自动发送风险远大于收益 |
| Agent 不互相直接调用 | 通过共享上下文层通信 | 避免 Agent 间形成复杂依赖链导致调试噩梦 |
| 先建 Context Engine | 在开发 Agent 前先强化联系人图谱和承诺状态机 | 完美上下文的简单 Agent > 上下文残缺的复杂 Agent |

---

## 五、数据架构

### 5.1 完整数据库表清单

**核心表 (14 个 migration 文件定义)**:

| 表名 | 用途 | 关键字段 | RLS |
|------|------|---------|-----|
| `profiles` | 用户画像 | timezone, plan, language, llm_provider, llm_api_key_encrypted, llm_model, llm_base_url, writing_style_notes, daily_brief_time, daily_brief_enabled | auth.uid() = id |
| `google_accounts` | 多账户令牌（含 Google + Microsoft） | provider(google/microsoft), google_email, access_token_encrypted, refresh_token_encrypted, token_expires_at, gmail_history_id, calendar_sync_token, ms_tenant_id | service_only (客户端不可访问) |
| `emails` | 邮件元数据 + 正文缓存 | gmail_message_id, thread_id, from_address, subject, body_text, is_reply_needed, reply_urgency, source_account_email, commitment_scanned | auth.uid() = user_id |
| `calendar_events` | 日历事件 | google_event_id, title, start_time, end_time, attendees(JSONB), location, meeting_link, source_account_email | auth.uid() = user_id |
| `tasks` | 任务 | title, priority(1-3), status(pending/in_progress/done/dismissed), source_type(email/calendar/manual/whatsapp), due_date, ai_confidence | auth.uid() = user_id |
| `follow_ups` | 跟进追踪 | type(waiting_on_them/i_promised/reply_needed), contact_email, commitment_text, due_date, status(active/resolved/snoozed) | auth.uid() = user_id |
| `reply_drafts` | AI 回复草稿 | email_id, draft_content, tone, ai_model, status(draft/edited/sent/discarded) | auth.uid() = user_id |
| `meeting_briefs` | 会议简报 | event_id, attendee_email, interaction_summary, talking_points(JSONB) | auth.uid() = user_id |
| `trips` | 出差行程 | destination_city, destination_country, start_date, end_date, status(upcoming/active/completed), flight_info(JSONB), hotel_info(JSONB) | auth.uid() = user_id |
| `trip_expenses` | 差旅费用 | trip_id, category(flight/hotel/transport/meal/other), amount, currency, merchant_name, status(pending/approved/exported) | auth.uid() = user_id |
| `daily_briefings` | 每日简报缓存 | briefing(TEXT), context_snapshot(JSONB), expires_at | auth.uid() = user_id |
| `contacts` | 联系人 | email, name, company, role, relationship(boss/team/client/...), importance(vip/high/normal/low), email_count, last_contact_at | auth.uid() = user_id |
| `whatsapp_connections` | WhatsApp 连接 | phone_number, status(active/disconnected), ai_enabled | auth.uid() = user_id |
| `whatsapp_messages` | WhatsApp 消息 | wa_message_id, from_number, to_number, body, direction(inbound/outbound), message_type | auth.uid() = user_id |
| `sync_log` | 同步日志 | sync_type, status, messages_processed, error_message, expires_at | auth.uid() = user_id |
| `google_tokens` (遗留) | 旧的单账户令牌表 | 已被 google_accounts 替代，数据已迁移 | service_only |

### 5.2 表关系图

```
profiles (1)
  ├──< google_accounts (N)     -- 多个邮箱账户
  ├──< emails (N)              -- 邮件
  │     ├──< tasks (N)         -- 来源于邮件的任务
  │     ├──< follow_ups (N)    -- 来源于邮件的跟进
  │     └──< reply_drafts (N)  -- 回复草稿
  ├──< calendar_events (N)     -- 日历事件
  │     ├──< tasks (N)         -- 来源于日历的任务
  │     └──< meeting_briefs (N)-- 会议简报
  ├──< tasks (N)               -- 任务（含手动/WhatsApp来源）
  ├──< follow_ups (N)          -- 跟进追踪
  ├──< trips (N)               -- 出差行程
  │     └──< trip_expenses (N) -- 差旅费用
  ├──< daily_briefings (N)     -- 每日简报
  ├──< contacts (N)            -- 联系人
  ├──< whatsapp_connections (N)-- WhatsApp 连接
  ├──< whatsapp_messages (N)   -- WhatsApp 消息
  │     └──< tasks (N)         -- 来源于 WhatsApp 的任务
  └──< sync_log (N)            -- 同步日志
```

### 5.3 数据流: 从外部渠道到用户展示

```
外部渠道                    数据库                      AI 处理                    用户展示
─────────                  ─────                      ──────                    ─────────

Gmail API  ──邮件元数据──▶  emails 表  ──未处理邮件──▶  sync/process API         Dashboard
           ──邮件正文──▶   (body_text)                  ├─ 任务提取 ──▶ tasks 表 ──▶ Tasks 页
                                                        ├─ 出差检测 ──▶ trips 表 ──▶ Trips 页
                                                        └─ 承诺扫描 ──▶ follow_ups ──▶ Follow-ups 页

Google     ──日历事件──▶  calendar_events              meetings/generate-brief
Calendar                                                └─ 参会者简报 ──▶ meeting_briefs ──▶ Meetings 页

Microsoft  ──邮件+日历──▶  emails + calendar_events     (共享同一 AI 管线)
Graph API

WhatsApp   ──消息──▶      whatsapp_messages            whatsapp-extraction prompt
(Baileys)                                               └─ 任务/联系人提取 ──▶ tasks/contacts

所有数据 ──────────────────────────────────────────▶  briefing API
                                                      └─ AI 生成每日简报 ──▶ daily_briefings ──▶ Dashboard

所有数据 ──────────────────────────────────────────▶  alerts/detect
                                                      └─ 异常信号检测 ──▶ AlertsBanner 组件

用户输入 (ChatPanel) ──▶  chat API ──▶ AI + Function Calling ──▶ 执行动作
                                       (create_task, draft_reply,     (写入 DB)
                                        create_event, search, etc.)
```

---

## 六、技术架构

### 6.1 前端

| 项目 | 技术选型 |
|------|---------|
| 框架 | Next.js 16 (App Router + Turbopack) |
| 语言 | TypeScript 6 |
| 样式 | Tailwind CSS 4 + tailwind-merge + clsx |
| 动画 | Framer Motion |
| 图标 | Lucide React |
| 状态管理 | React 19 内置 (useState/useEffect)，无额外状态库 |
| 组件架构 | `app/(dashboard)/` 页面 + `components/` 共享组件 + `types/` 类型定义 |

### 6.2 后端

| 项目 | 技术选型 |
|------|---------|
| API 路由 | Next.js Route Handlers (app/api/) |
| 数据库 | Supabase (PostgreSQL) |
| ORM/查询 | Supabase JS Client (createClient / createAdminClient) |
| 认证 | Supabase Auth + Google OAuth + Microsoft OAuth |
| 行级安全 | PostgreSQL RLS -- 用户只能访问自己的数据 |
| 令牌管理 | AES 加密存储 (google/tokens.ts 中的 encrypt/decrypt) |
| Cron | `/api/cron/digest` (Vercel Cron) |

### 6.3 AI 层

| 项目 | 技术选型 |
|------|---------|
| 默认 LLM | DeepSeek Chat (api.deepseek.com) |
| 客户端库 | OpenAI SDK (openai npm 包)，通过 baseURL 适配各提供商 |
| 支持的提供商 | DeepSeek, OpenAI, Claude, Groq, Ollama, 自定义 |
| Function Calling | 7 个工具 (create_task, complete_task, draft_reply, forward_email, search, create_event, recommend_place) |
| 回退策略 | 不支持 Function Calling 的提供商使用文本 ACTION 解析 |
| Prompt 管理 | `lib/ai/prompts/` 下 12 个专用 prompt 文件 |
| 统一客户端 | `lib/ai/unified-client.ts` -- 根据用户配置创建 OpenAI 兼容客户端 |
| 流式输出 | AI 回复起草使用 ReadableStream 流式传输 |

**AI Prompt 清单**:

| Prompt 文件 | 用途 |
|-------------|------|
| `briefing.ts` | Daily Briefing 生成 |
| `chat.ts` | 多轮对话系统提示词 |
| `commitment-extraction.ts` | 从出站邮件中提取承诺 |
| `contact-detection.ts` | 联系人关系类型/重要度分类 |
| `landing-briefing.ts` | 落地简报 |
| `meeting-prep.ts` | 会议准备简报 |
| `recommendations.ts` | 餐厅推荐 |
| `reply-draft.ts` | 邮件回复起草 |
| `task-extraction.ts` | 从邮件中提取任务 |
| `transport.ts` | 交通方式建议 |
| `trip-detection.ts` | 出差检测 |
| `whatsapp-extraction.ts` | WhatsApp 消息分析 |

### 6.4 外部服务

| 服务 | 用途 | 集成方式 |
|------|------|---------|
| Google OAuth 2.0 | Gmail + Calendar 授权 | `lib/google/auth.ts` |
| Google Gmail API | 邮件读取/发送/转发 | `lib/google/gmail.ts` |
| Google Calendar API | 日历事件读取/创建 | `lib/google/calendar.ts` |
| Microsoft Identity Platform | Outlook + Calendar 授权 | `lib/microsoft/auth.ts` |
| Microsoft Graph API | Outlook 邮件 + 日历读取 | `lib/microsoft/mail.ts`, `lib/microsoft/calendar.ts` |
| Baileys (WhatsApp Web) | WhatsApp 消息接收 | `whatsapp-service/src/client.ts` |
| Supabase | 数据库 + Auth + RLS | `lib/supabase/` |
| DeepSeek / OpenAI 等 | LLM 推理 | `lib/ai/unified-client.ts` |

### 6.5 部署架构

```
用户浏览器
    │
    ▼
┌──────────────────────────────────────────┐
│            Vercel (前端 + API)             │
│  ┌──────────────┐  ┌──────────────────┐  │
│  │ Next.js SSR  │  │ API Routes       │  │
│  │ (Dashboard)  │  │ /api/sync        │  │
│  │              │  │ /api/chat        │  │
│  │              │  │ /api/briefing    │  │
│  │              │  │ /api/...         │  │
│  └──────────────┘  └──────┬───────────┘  │
│                           │              │
│              ┌────────────┤              │
│              ▼            ▼              │
│        ┌──────────┐ ┌──────────┐        │
│        │ Google   │ │Microsoft │        │
│        │ APIs     │ │Graph API │        │
│        └──────────┘ └──────────┘        │
└──────────────────┬───────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
┌────────┐  ┌──────────┐  ┌──────────────┐
│Supabase│  │ Railway  │  │ DeepSeek /   │
│(PgSQL) │  │(WhatsApp │  │ OpenAI /     │
│        │  │ Baileys) │  │ 用户自选 LLM  │
└────────┘  └──────────┘  └──────────────┘
```

---

## 七、模块联动地图

### 7.1 已实现的核心联动

#### 联动 1: 邮件 -> AI 处理 -> 任务/跟进/出差 (P0, 已上线)
```
邮件同步 ──▶ sync/process ──▶ 任务提取 ──▶ tasks 表
                           ──▶ 出差检测 ──▶ trips 表
                           ──▶ 承诺扫描 ──▶ follow_ups 表
```

#### 联动 2: 日历 + 邮件 + 联系人 -> 会议简报 (P0, 已上线)
```
日历事件 ──▶ 提取参会者 ──▶ 联系人表匹配 ──▶ 拉取邮件互动 ──▶ 生成简报
```

#### 联动 3: 全模块 -> Daily Briefing (P0, 已上线)
```
日历 + 任务 + 邮件 + 跟进 + VIP联系人 + WhatsApp ──▶ AI 汇总 ──▶ Daily Briefing
```

#### 联动 4: 日历 -> 交通 + 餐厅 (已上线)
```
相邻会议 ──▶ 交通时间估算 ──▶ TransportCard
会议地点 ──▶ 附近餐厅推荐 ──▶ Recommendations
```

#### 联动 5: Chat -> Function Calling -> 多模块写入 (已上线)
```
用户对话 ──▶ AI 判断意图 ──▶ Function Calling ──▶ 创建任务/事件/回复/搜索/推荐
```

#### 联动 6: 邮件 -> 联系人自动分类 (已上线)
```
邮件记录 ──▶ AI 分析发件人 ──▶ 分类关系类型 + 重要度 ──▶ contacts 表
```

### 7.2 规划中的联动 (Agent 激活后)

#### Radar Agent 新增联动:
```
Gmail + Outlook + WhatsApp + 承诺到期 + 日历冲突 ──▶ 实时信号评分 ──▶ 优先级推送
WhatsApp 未回 + 邮件追发 ──▶ 渠道切换信号检测 ──▶ 紧急升级
```

#### Ghostwriter Agent 新增联动:
```
联系人画像 + 跨渠道互动历史 + 承诺状态 + 日程空余 ──▶ 全上下文回复草稿
批量模式: 所有待回复邮件 ──▶ 逐条生成草稿 ──▶ 用户批量审核
```

#### Prep Agent 新增联动:
```
日历事件 + 参会者画像 + 承诺状态 + 餐厅推荐 ──▶ 智能会前简报 + 雷区预警
```

#### Closer Agent 新增联动:
```
跟进超时 ──▶ 自动生成升级策略 (温和 -> 加压 -> 换渠道) ──▶ 草稿队列
会议结束 ──▶ 自动提取 action items ──▶ 任务分配
```

#### Weaver Agent 新增联动:
```
全渠道互动 ──▶ 关系温度计算 ──▶ 每周关系健康报告
地理位置 + 联系人位置 ──▶ "你和 X 都在东京，建议见面"
```

#### Travel Brain Agent 新增联动:
```
航班邮件 + 酒店邮件 ──▶ 自动出差时间线
出差中: Daily Briefing 适配当地时区 + 联系人推荐
回程后: 自动生成出差摘要 + 待跟进事项
```

#### Debrief Agent 新增联动:
```
指定时间窗口 ──▶ 全模块数据拉取 ──▶ 结构化复盘报告
月度: 时间分配分析 + 关系网络变化 + 承诺完成率
```

---

## 八、发展路线图

### Phase 1: 基础功能 + Gmail (当前 -- 已完成)

**目标**: 核心工具集上线，验证产品价值

| 交付物 | 状态 |
|--------|------|
| Supabase Auth + Google OAuth | 已上线 |
| Gmail 邮件同步 + 增量同步 | 已上线 |
| Google Calendar 同步 | 已上线 |
| AI 任务提取 + 任务管理 | 已上线 |
| AI 回复起草 + 发送 | 已上线 |
| 跟进追踪 + 承诺扫描 | 已上线 |
| Daily Briefing | 已上线 |
| 会议准备简报 | 已上线 |
| 商旅检测 + 费用管理 | 已上线 |
| AI 对话 + Function Calling | 已上线 |
| 联系人自动分类 | 已上线 |
| 多语言 (EN/ZH) | 已上线 |
| 用户自选 LLM | 已上线 |
| 新加坡餐厅推荐 + 交通建议 | 已上线 |

### Phase 2: Outlook + WhatsApp + 多账户 (进行中)

**目标**: 扩展通讯渠道覆盖面，满足多账户场景

| 交付物 | 状态 |
|--------|------|
| 多 Google 账户绑定 | 已上线 |
| Microsoft Outlook 邮件 + 日历同步 | 已上线 |
| WhatsApp 连接 (Baileys QR) | 已上线 |
| WhatsApp 消息读取 | 已上线 |
| WhatsApp AI 自动回复 (开关) | 已上线 |
| WhatsApp 独立服务 (Railway) | 已上线 |
| Outlook 邮件发送 | 规划中 |
| WhatsApp 消息发送 (用户确认后) | 规划中 |
| WhatsApp 任务提取集成 AI 管线 | 规划中 |

### Phase 3: Agent 架构 (下一阶段)

**目标**: 从"工具集"进化为"有生命力的助手"

#### P0 Agent (4-6 周)
| 交付物 | 工程量 |
|--------|--------|
| Unified Context Engine (联系人图谱合并 + 承诺状态机) | 1-2 周 |
| Radar Agent (实时信号监控) | 2-3 周 |
| Ghostwriter Agent (全上下文回复) | 2-3 周 |
| Prep Agent (智能会前简报) | 1-2 周 |

#### P1 Agent (P0 上线后 4-6 周)
| 交付物 | 工程量 |
|--------|--------|
| Closer Agent (闭环追踪 + 自动跟进) | 3-4 周 |
| Weaver Agent (关系温度 + 人脉维护) | 3-4 周 |
| Travel Brain Agent (端到端出差智能体) | 4-6 周 |

#### P2 Agent (P1 验证后)
| 交付物 | 工程量 |
|--------|--------|
| Debrief Agent (复盘助手) | 2-3 周 |

### Phase 4: 开放平台 / 扩展 (远期)

**目标**: 平台化，支持更多渠道和自定义

| 交付物 | 说明 |
|--------|------|
| 更多通讯渠道 | Telegram, Slack, 微信等 |
| 公开 API | 允许第三方集成 Chief 的上下文引擎 |
| 插件系统 | 用户自定义 Agent 行为 |
| 团队协作 | 多用户共享联系人图谱和任务 |
| 企业版 | SSO, 审计日志, 合规 |
| 更多地区数据 | 扩展餐厅/交通推荐到更多城市 |

---

## 附录: 技术栈汇总

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Next.js | 16 |
| 前端语言 | TypeScript | 6 |
| 样式 | Tailwind CSS | 4 |
| 动画 | Framer Motion | 12 |
| 数据库 | Supabase (PostgreSQL) | -- |
| 认证 | Supabase Auth | -- |
| AI SDK | OpenAI Node.js | 6 |
| 默认 LLM | DeepSeek Chat | -- |
| WhatsApp | Baileys | 7.0-rc |
| 二维码 | qrcode | 1.5 |
| Google APIs | googleapis | 171 |
| 日志 | pino | 10 |
| 部署 (前端) | Vercel | -- |
| 部署 (WhatsApp) | Railway | -- |
| 部署 (数据库) | Supabase Cloud | -- |
