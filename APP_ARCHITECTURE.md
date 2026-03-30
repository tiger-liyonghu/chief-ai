# Chief — AI 幕僚长 功能架构

## 产品定位

**Chief — 你的 AI 幕僚长**
**盯住每一个承诺，无缝切换城市，守住家庭底线。**

技术栈：Next.js 16 + TypeScript + Tailwind + Supabase + DeepSeek

---

## 三维价值结构

### 承诺层 — 盯人盯事，球不落地

| 功能 | 页面 | 状态 |
|------|------|------|
| 承诺仪表盘 | `/dashboard` | ✅ |
| 承诺提取（三门审判） | AI pipeline | ✅ P=94.5% |
| 流式扫描（30秒 wow） | `/api/commitments/scan-stream` | ✅ |
| 一键履约（起草/催/升级） | `/api/commitments/actions` | ✅ |
| 守约率统计 | `/api/commitments/stats` | ✅ |
| 智能升级（逾期7天+催过） | cron job | ✅ |
| 反馈闭环（确认/拒绝） | `/api/commitments/feedback` | ✅ |
| 联系人图谱 | `/dashboard/contacts` | ✅ |
| 关系温度（Weaver） | `/api/agents/weaver` | ✅ |
| 实时告警（Radar） | `/api/agents/radar` | ✅ |

### 商旅层 — 城市无缝切换

| 功能 | 页面 | 状态 |
|------|------|------|
| 航班/酒店自动检测 | `/api/trips/detect` | ✅ |
| 出差时间线 | `/dashboard/trips` | ✅ |
| 落地简报 | `/api/trips/landing-briefing` | ✅ |
| 会议准备（attendee context） | `/api/meetings/generate-brief` | ✅ |
| 费用追踪 | `/dashboard/expenses` | ✅ |
| 城市卡片 | `/api/trip-timeline/city-card` | ✅ |
| 行前清单 | `/api/trips/pre-flight` | ✅ |

### 家庭层 — 守住底线

| 功能 | 页面 | 状态 |
|------|------|------|
| 家庭日历 | `/dashboard/family` | ✅ |
| 冲突检测（工作 vs 家庭） | `/api/family-calendar/conflicts` | ✅ |
| 学校活动/纪念日提醒 | 简报集成 | ✅ |
| 家庭承诺追踪 | commitments type=family | ✅ |

---

## 数据源接入

| 渠道 | 方式 | 状态 |
|------|------|------|
| Gmail | OAuth 2.0 | ✅ |
| Google Calendar | OAuth 2.0 | ✅ |
| Outlook/Hotmail | OAuth 2.0 / IMAP | ✅ |
| 163/QQ/126 邮箱 | IMAP | ✅ |
| WhatsApp | Baileys (self-chat) | ✅ |
| Telegram | Bot API | 🟡 就绪 |

---

## 核心 Pipeline

```
邮件/消息 → Sync → Process → Extract → 展示
```

### 1. Sync (元数据同步)
```
Gmail (historyId) ─┐
Outlook (delta)   ─┤── emails 表 ── body_processed: false
IMAP (UID)        ─┘
Google Calendar   ───── calendar_events 表
```

### 2. Process (AI 处理)
```
未处理邮件 → Pre-filter (规则层, 97%准确)
          → 任务提取 (reply_urgency, tasks)
          → 承诺提取 (i_promised / they_promised)
          → 出差检测 (flights, hotels, expenses)
          → 联系人识别 (auto-detect + classify)
```

### 3. 承诺提取 Pipeline (详细)
```
邮件 → Pre-filter (跳过 newsletter/auto-reply/CC)
     → DeepSeek-chat (三门审判: 后果/主体/价值)
     → Post-filter (confidence >0.8, 去重, policy 过滤)
     → 置信度分层: HIGH >0.9 主动推送 / MEDIUM 0.7-0.9 展示 / LOW 不展示
```

---

## WhatsApp 行动层

```
Chief 推送                        用户回复
─────────                        ─────────
"⚠️ 老板，你答应了张总明天前      → "完成abc123" → 标记完成
  发方案，还剩24小时"             → "起草abc123" → AI起草邮件
                                  → "延期abc123" → 延期7天
                                  → "催abc123"   → 生成催促邮件

"📝 给张总的邮件草稿:             → "发"         → 确认发送
  Subject: ...                    → "语气再软一点" → 修改后重发
  Body: ..."
```

调度：
- 晨间简报（每日，含承诺统计）
- 承诺到期提醒（每15分钟，工作时间）
- 逾期提醒（每30分钟）
- 出差费用汇总（出差结束后）

---

## API 路由总览 (~50 个)

### 邮件
- `POST /api/sync` — 全渠道同步
- `POST /api/sync/process` — AI 处理
- `GET /api/emails` — 收件箱列表
- `GET /api/emails/[id]/thread` — 邮件线程

### 承诺
- `GET /api/commitments` — 承诺列表
- `POST /api/commitments/scan` — 批量扫描
- `GET /api/commitments/scan-stream` — 流式扫描 (SSE)
- `POST /api/commitments/actions` — 一键操作
- `GET /api/commitments/stats` — 统计数据
- `POST /api/commitments/feedback` — 用户反馈

### 联系人
- `GET /api/contacts` — 联系人列表
- `POST /api/contacts/detect` — 自动识别
- `POST /api/contacts/scan-card` — 名片OCR

### 日历 & 会议
- `GET /api/calendar/events` — 日历事件
- `POST /api/meetings/generate-brief` — 会议准备

### 出差
- `POST /api/trips/detect` — 自动检测
- `POST /api/trips/landing-briefing` — 落地简报
- `GET /api/expenses` — 费用列表

### 家庭
- `GET /api/family-calendar` — 家庭日历
- `GET /api/family-calendar/conflicts` — 冲突检测

### AI 代理
- `GET /api/agents/radar` — 实时告警
- `GET /api/agents/weaver` — 关系温度
- `POST /api/agents/closer` — 跟进草稿
- `GET /api/agents/travel-brain` — 出差管家
- `POST /api/chat` — 对话助手

### 简报 & 通知
- `GET /api/briefing` — 每日简报
- `POST /api/digest` — 发送摘要邮件
- `GET /api/alerts` — 告警列表

### 定时任务 (Cron)
- `/api/cron/digest` — 每小时，发送简报
- `/api/cron/commitment-check` — 每6小时，逾期检查+升级建议
- `/api/cron/insights` — 每周，生成洞察快照
- `/api/cron/prep-agent` — 会议前2小时，自动准备

---

## 数据模型核心表

| 表 | 核心字段 | 用途 |
|---|---|---|
| `profiles` | timezone, llm_provider, writing_style | 用户配置 |
| `google_accounts` | provider(google/imap), encrypted tokens | 多渠道认证 |
| `emails` | from, subject, body_text, is_reply_needed | 统一收件箱 |
| `commitments` | type, title, deadline, urgency_score, status | 承诺追踪 |
| `contacts` | relationship, importance, email_count | 联系人图谱 |
| `calendar_events` | title, attendees, start_time | 日历同步 |
| `family_calendar` | event_type, recurrence, family_member | 家庭日历 |
| `trips` | destination, dates, flight/hotel_info | 出差管理 |
| `trip_expenses` | amount, currency, category | 费用追踪 |
| `tasks` | title, priority, source_email_id | 任务提取 |
| `whatsapp_messages` | body, direction, from_number | WA消息 |
| `commitment_feedback` | feedback_type, confidence | 反馈闭环 |
| `daily_briefings` | briefing, context_snapshot | 简报缓存 |

---

## 承诺提取精度 (210封测试邮件)

| 指标 | 值 | 目标 |
|------|-----|------|
| Precision | 94.5% | >90% ✅ |
| Recall | 65.9% | >85% ❌ |
| F1 | 77.7% | >87% ❌ |
| Pre-filter | 97.0% | >95% ✅ |
| Easy F1 | 97.4% | ✅ |

**下一步**: Two-pass pipeline (chat+reasoner) + 反馈闭环学习
