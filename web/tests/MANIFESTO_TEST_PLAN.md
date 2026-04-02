# Sophia 纲领全量测试计划

**基于 SOPHIA_MANIFESTO.md，逐条验证系统是否兑现纲领承诺。**

---

## 测试结构

```
A. 基础模块测试（新建的 lib/）
B. 九宫格功能测试（3方向 × 3动作）
C. Agent 测试（7个 Agent）
D. Cron 测试（6个定时任务）
E. 5 分钟 Wow 测试
F. 六条规矩测试
G. 不做什么测试（边界）
H. 端到端数据流测试
I. 导航与页面测试
```

---

## A. 基础模块测试

### A1. 温度算法 `lib/contacts/temperature.ts`

| ID | 测试点 | 输入 | 预期输出 |
|----|--------|------|---------|
| A1-01 | 刚互动的 VIP | lastInteraction=今天, interactions=5, commitments=2, importance=vip | score≥80, label=hot |
| A1-02 | 14天没互动的普通联系人 | lastInteraction=14天前, interactions=0, commitments=0, importance=normal | score≈15-25, label=cooling |
| A1-03 | 30天没互动的 VIP | lastInteraction=30天前, interactions=0, commitments=0, importance=vip | score<50, needsAttention=true |
| A1-04 | 从没互动过 | lastInteraction=null, interactions=0, commitments=0 | score≤10, label=cold |
| A1-05 | 有活跃承诺但很久没互动 | lastInteraction=60天前, interactions=0, commitments=3 | score>cold（承诺加分） |
| A1-06 | 边界值：score 不超过 100 | 极端大值输入 | score=100 |
| A1-07 | 边界值：score 不低于 0 | 极端小值输入 | score=0 |
| A1-08 | 批量计算 | 5 个联系人 | 返回 5 个结果，每个有 id+score+label |

### A2. 统一查询层 `lib/signals/query.ts`

| ID | 测试点 | 预期 |
|----|--------|------|
| A2-01 | getOverdueCommitments：有逾期承诺 | 返回 deadline < today 的承诺，按 deadline 排序 |
| A2-02 | getOverdueCommitments：无逾期 | 返回空数组 |
| A2-03 | getCoolingContacts：有冷却联系人 | 返回 temperature < threshold 的联系人 |
| A2-04 | getCoolingContacts：rolesFilter=client | 只返回有 client 角色的 |
| A2-05 | getUnrepliedEmails：有未回复 | 返回 is_reply_needed=true 的邮件 |
| A2-06 | getCalendarConflicts：工作事件重叠 | 返回重叠事件对 |
| A2-07 | getCalendarConflicts：工作 vs 家庭冲突 | involvesFamilyEvent=true |
| A2-08 | getCalendarConflicts：无冲突 | 返回空数组 |
| A2-09 | getRecentInteractions：有邮件 | 返回 Signal 格式，按时间排序 |

### A3. 推送判断 `lib/scheduler/should-notify.ts`

| ID | 测试点 | 输入 | 预期 |
|----|--------|------|------|
| A3-01 | 深夜 critical | hour=3, urgency=critical | allowed=true |
| A3-02 | 深夜 medium | hour=3, urgency=medium | allowed=false, reason=sleep_hours |
| A3-03 | 开会中 high | 当前有日历事件, urgency=high | allowed=false, reason=in_meeting |
| A3-04 | 开会中 critical | 当前有日历事件, urgency=critical | allowed=true |
| A3-05 | 频率超限 | 今天已推 5 次 commitment_overdue | allowed=false, reason=frequency_limit |
| A3-06 | 频率未超 | 今天推了 2 次 | allowed=true |
| A3-07 | 工作时间 low | hour=15, urgency=low | allowed=true |
| A3-08 | 非工作时间 low | hour=20, urgency=low | allowed=false |

### A4. 城市提取 `lib/contacts/extract-city.ts`

| ID | 测试点 | 输入 | 预期 |
|----|--------|------|------|
| A4-01 | 英文签名含 Singapore | "123 Orchard Road, Singapore 238858" | "Singapore" |
| A4-02 | 英文签名含 Kuala Lumpur | "Level 20, Menara TM, Kuala Lumpur" | "Kuala Lumpur" |
| A4-03 | 中文签名含上海 | "上海市浦东新区陆家嘴" | "Shanghai" |
| A4-04 | 含 HK 缩写 | "Suite 3201, HK Central" | "Hong Kong" |
| A4-05 | 无城市信息 | "Best regards, John" | null |
| A4-06 | 只看最后 500 字符 | 正文有 Tokyo 但签名没有 | null（正文中的不算） |

### A5. 转介绍检测 `lib/signals/referral-detect.ts`

| ID | 测试点 | 输入 | 预期 |
|----|--------|------|------|
| A5-01 | 英文转介绍 | "My friend John is looking for insurance" | 检测到，confidence=0.8 |
| A5-02 | 中文转介绍 | "我朋友也需要保险，介绍给你" | 检测到 |
| A5-03 | 引荐信 | "Let me introduce you to Lisa" | 检测到 |
| A5-04 | 普通邮件 | "Please send the report" | 不检测 |
| A5-05 | 边界：推荐但不是转介绍 | "I recommend this restaurant" | 不检测（recommend 但不是人的推荐） |

### A6. 保单检测 `lib/signals/policy-detect.ts`

| ID | 测试点 | 输入 | 预期 |
|----|--------|------|------|
| A6-01 | 续保通知 | "Your policy renewal is due on 2026-05-01" | signalType=renewal, expiryDate=2026-05-01 |
| A6-02 | 新保单确认 | "Policy number MED-2026-001 effective from 1 April" | signalType=new_policy |
| A6-03 | 医疗险提及 | "medical insurance plan renewal" | productType=medical |
| A6-04 | 普通邮件 | "Meeting tomorrow at 3pm" | null |
| A6-05 | 保费到期 | "Premium payment due by end of month" | signalType=premium_due |

### A7. 时区推荐 `lib/travel/timezone.ts`

| ID | 测试点 | 输入 | 预期 |
|----|--------|------|------|
| A7-01 | SG→Tokyo | yourCity=Tokyo, theirCity=Singapore | 有重叠窗口（+1h差） |
| A7-02 | SG→London | yourCity=Singapore, theirCity=London | 重叠窗口较窄（-8h差） |
| A7-03 | SG→SF | yourCity=Singapore, theirCity=San Francisco | 几乎无重叠（-16h差） |
| A7-04 | 同城 | yourCity=Singapore, theirCity=Singapore | 全天重叠 |
| A7-05 | 未知城市 | yourCity=Unknown | null |

---

## B. 九宫格功能测试

### B1. 客户×盯着

| ID | 测试点 | 验证方法 |
|----|--------|---------|
| B1-01 | 承诺提取：发一封含承诺的邮件 | POST /api/sync/process → commitments 表有新记录 |
| B1-02 | 承诺方向：outbound "I'll send" | type=i_promised |
| B1-03 | 承诺方向：inbound "Could you send" | type=i_promised（对方请求我=我的义务） |
| B1-04 | 承诺方向：inbound "I'll send you" | type=waiting_on_them（对方承诺） |
| B1-05 | 关系温度：Weaver 正确计算 | GET /api/agents/weaver → 温度在合理范围 |
| B1-06 | 转介绍检测：含"introduce you to"的邮件 | alerts 表有 type=referral_detected |
| B1-07 | 保单检测：含 renewal 的邮件 | policies 表有新记录 |
| B1-08 | Confidence 校准：per-person 调整 | 同一联系人多次提取后 confidence 有变化 |

### B2. 客户×提醒

| ID | 测试点 | 验证方法 |
|----|--------|---------|
| B2-01 | 逾期承诺推送 | Radar Push → WhatsApp 收到逾期提醒 |
| B2-02 | VIP 未回复推送 | VIP 邮件 24h 未回复 → Radar Push 包含 |
| B2-03 | 关系冷却推送 | Weaver Push → client/VIP 温度<40 推送 |
| B2-04 | 保单续保推送 | 保单 45 天内到期 → Weaver Push 包含 |
| B2-05 | Daily Briefing 含承诺 | GET /api/briefing → 包含逾期承诺 |
| B2-06 | shouldNotify 生效 | 深夜不推非 critical 消息 |

### B3. 客户×准备

| ID | 测试点 | 验证方法 |
|----|--------|---------|
| B3-01 | 会前简报生成 | 日历有 15-30 分钟后的会议 → Prep Agent 生成 brief |
| B3-02 | 简报含联系人背景 | brief 内容包含参会者公司、角色、温度 |
| B3-03 | 简报含未了承诺 | brief 内容包含和参会者相关的活跃承诺 |
| B3-04 | Ghostwriter 上下文正确 | 回复 Lisa → 草稿包含和 Lisa 的历史上下文 |
| B3-05 | Closer 催促草稿 | 逾期 48h 的承诺 → Closer 生成草稿 |
| B3-06 | Context Engine 三档注入 | 轻量≈200tok, 标准≈400tok, 深度≈600+tok |

### B4. 差旅×盯着

| ID | 测试点 | 验证方法 |
|----|--------|---------|
| B4-01 | 差旅检测：航班确认邮件 | sync/process → trips 表有新记录 |
| B4-02 | 差旅结构化：酒店邮件 | trip_hotels 表有记录 |
| B4-03 | 联系人城市提取 | 有 Singapore 签名的邮件 → contact.city=Singapore |

### B5. 差旅×提醒

| ID | 测试点 | 验证方法 |
|----|--------|---------|
| B5-01 | 落地简报自动推送 | trip.start_date=今天 → travel-check cron 推送 |
| B5-02 | 简报含当地联系人 | 目的地有 client → 简报列出 |
| B5-03 | 简报含到期承诺 | trip 期间有到期承诺 → 简报列出 |
| B5-04 | 简报含时区推荐 | 目的地≠Singapore → 包含最佳联系时间 |

### B6. 差旅×准备

| ID | 测试点 | 验证方法 |
|----|--------|---------|
| B6-01 | Trip 结束自动 Debrief | trip.end_date<今天 → status=completed + Debrief 生成 |
| B6-02 | 联系人激活 | 出差目的地有老客户 → 落地简报包含 |

### B7. 家庭×盯着

| ID | 测试点 | 验证方法 |
|----|--------|---------|
| B7-01 | 家庭事件存储 | POST /api/family-calendar → 记录创建 |
| B7-02 | 承诺家庭标记 | 联系人 roles 含 family → 承诺 context=family |

### B8. 家庭×提醒

| ID | 测试点 | 验证方法 |
|----|--------|---------|
| B8-01 | 硬约束冲突检测 | 创建事件和家庭 hard_constraint 重叠 → 返回 warning |
| B8-02 | Briefing 含家庭冲突 | Daily Briefing 包含今日家庭冲突 |
| B8-03 | 纪念日提前推送 | important_date 事件 3 天前 → Weaver Push 包含 |

### B9. 家庭×准备

| ID | 测试点 | 验证方法 |
|----|--------|---------|
| B9-01 | 家庭承诺在 Commitments 页面可见 | context=family 的承诺显示 Family 标签 |

---

## C. Agent 测试

| ID | Agent | 测试点 | 验证方法 |
|----|-------|--------|---------|
| C-01 | Radar | 返回逾期承诺 | 有逾期数据时 signals 非空 |
| C-02 | Radar | 返回 VIP 未回复 | VIP 邮件未回复时包含 |
| C-03 | Weaver | 温度计算正确 | 和 temperature.ts 单元测试结果一致 |
| C-04 | Weaver | needs_attention 正确 | VIP + temp<50 → true |
| C-05 | Closer | 生成催促草稿 | 逾期承诺 → 返回 draft |
| C-06 | Closer | 升级策略 | 0-3d=gentle, 3-7d=firm, >7d=urgent |
| C-07 | Prep | 15分钟内会议触发 | prep_generated=true |
| C-08 | Prep | 使用 Context Engine | bundle.contact 有数据 |
| C-09 | Travel Brain | 检测活跃 trip | 返回 active_trip |
| C-10 | Debrief | 生成回顾 | 返回 summary + stats |

---

## D. Cron 测试

| ID | Cron | 测试点 | 验证方法 |
|----|------|--------|---------|
| D-01 | sync | 邮件同步 | 新邮件出现在 emails 表 |
| D-02 | sync | 承诺提取 | commitments 表有新记录 |
| D-03 | prep-agent | 会前简报 | meeting_briefs 表有记录 |
| D-04 | radar-push | 推送通知 | notification_log 有记录 |
| D-05 | radar-push | shouldNotify 生效 | 深夜无推送 |
| D-06 | weaver-push | 冷却推送 | notification_log 有 relationship_cooling |
| D-07 | weaver-push | 保单推送 | notification_log 有 policy_renewal |
| D-08 | weaver-push | 纪念日推送 | notification_log 有 family_reminder |
| D-09 | travel-check | 落地简报 | notification_log 有 trip_briefing |
| D-10 | travel-check | 出差闭环 | trip.status=completed |
| D-11 | digest | 日报发送 | 日报内容包含逾期+冲突+冷却 |

---

## E. 5 分钟 Wow 测试

| ID | 测试点 | 验证方法 |
|----|--------|---------|
| E-01 | OAuth 完成后自动触发 sync | onboarding 页面 → handleStartWow → fetch /api/sync |
| E-02 | 即时 Wow 数据返回 | GET /api/onboarding/wow → unrepliedCount + coolingCount + conflictCount |
| E-03 | 即时 Wow 30秒内 | 从 OAuth 到第一屏数据 < 30 秒 |
| E-04 | SSE 承诺扫描启动 | CommitmentDiscovery 自动开始，EventSource 连接 |
| E-05 | 承诺逐条出现 | SSE 推送 type=commitment → 前端动态添加 |
| E-06 | 扫描完成 → ready 步骤 | SSE type=done → 显示"Enter Sophia"按钮 |
| E-07 | 空数据不崩溃 | 新用户无邮件 → 显示空状态，不报错 |

---

## F. 六条规矩测试

| ID | 规矩 | 测试点 | 验证方法 |
|----|------|--------|---------|
| F-01 | 不撒谎 | AI 回复不编造日期/人名 | 审查 Ghostwriter 输出，所有人名/日期可在 DB 中溯源 |
| F-02 | 不自作主张 | 所有写操作需确认 | 发邮件必须点"Send"、改日程必须点"Confirm" |
| F-03 | 不该烦就不烦 | 深夜不推非紧急 | shouldNotify 在 23:00-07:00 阻止 medium/low |
| F-04 | 家庭硬约束 | 工作事件不能自动覆盖家庭 | Calendar POST 检测冲突并返回 warning |
| F-05 | 宁可漏不可错 | Precision ≥ 95% | 运行 eval → Precision 100% |
| F-06 | 数据是你的 | LLM 可插拔 | 设置自定义 provider + key → AI 调用走用户 key |
| F-07 | 数据是你的 | 数据可导出 | POST /api/export → 下载 JSON |
| F-08 | 数据是你的 | 账户可删除 | DELETE /api/account → 所有数据清除 |

---

## G. 不做什么测试（边界）

| ID | 不做什么 | 测试点 | 验证方法 |
|----|---------|--------|---------|
| G-01 | 不订机票酒店 | 系统无预订 API | 确认无 booking 相关路由 |
| G-02 | 不替你做决定 | AI 回复用建议语气 | Ghostwriter 输出含"建议"/"I suggest"而非"I've done" |
| G-03 | 不自动发消息 | WhatsApp 推送发给自己 | pushViaWhatsApp 发到 selfJid 不是客户 jid |
| G-04 | 不做万能聊天 | Chat 不回答无关问题 | 问"帮我写首诗" → 拒绝或引导回承诺/客户话题 |

---

## H. 端到端数据流测试

### H1. 邮件 → 承诺 → 提醒 → 行动

| 步骤 | 验证 |
|------|------|
| 1. 发一封含承诺的邮件到用户 Gmail | 邮件到达 |
| 2. 触发 /api/sync | emails 表有新记录 |
| 3. 触发 /api/sync/process | commitments 表有新记录，type 正确 |
| 4. 设置 deadline 为昨天 | status 变为 overdue |
| 5. 触发 /api/cron/radar-push | notification_log 有记录，WhatsApp 收到提醒 |
| 6. 用户在 Commitments 页面标记 done | status=done |

### H2. 邮件 → 联系人 → 温度 → 冷却提醒

| 步骤 | 验证 |
|------|------|
| 1. 新联系人发邮件 | contacts 表有记录 |
| 2. 标记为 VIP | importance=vip |
| 3. 30天无互动 | Weaver 温度 < 40 |
| 4. 触发 weaver-push | 冷却提醒推送 |

### H3. 差旅邮件 → Trip → 落地简报 → Debrief

| 步骤 | 验证 |
|------|------|
| 1. 航班确认邮件到达 | trips 表有记录 |
| 2. trip start_date = 今天 | travel-check 触发 |
| 3. 目的地有联系人 | 落地简报包含联系人 |
| 4. trip end_date 过去 | status=completed, Debrief 生成 |

### H4. 家庭冲突 → 预警 → 保护

| 步骤 | 验证 |
|------|------|
| 1. 创建 family_calendar hard_constraint（周三 14:00-15:00） | 记录创建 |
| 2. 创建 calendar_event（周三 14:30） | 返回 family_conflicts 警告 |
| 3. Daily Briefing | 包含冲突信息 |

---

## I. 导航与页面测试

| ID | 页面 | 测试点 | 验证方法 |
|----|------|--------|---------|
| I-01 | Today | 页面加载 | /dashboard 显示今日摘要 |
| I-02 | Commitments | 三个 tab | I Promised / Waiting On / All 都可切换 |
| I-03 | Commitments | 筛选 | Active / Overdue / Done / All 都有效 |
| I-04 | Commitments | 标记完成 | 点 Done → status 变更 |
| I-05 | Commitments | Family 标签 | context=family 的承诺显示粉色标签 |
| I-06 | People | 温度显示 | 联系人列表显示温度条 |
| I-07 | People | 冷却筛选 | 筛选 Cooling → 只看温度<40 的 |
| I-08 | Calendar | 加载事件 | 显示日历事件 |
| I-09 | Calendar | 家庭事件标识 | 家庭事件用不同颜色/图标 |
| I-10 | Trips | 列表加载 | 显示所有 trips |
| I-11 | Trips | 详情含费用 | 点开 trip → 显示 expenses |
| I-12 | Inbox | 默认需回复 | 打开 Inbox → 默认 filter=needs_reply |
| I-13 | Inbox | 可切换全部 | 切换到 All → 显示全部邮件 |
| I-14 | Sophia Chat | 移动端可达 | 点底部 Sophia tab → Chat 面板打开 |
| I-15 | 侧边栏 | 主导航 4 项 | Today/Commitments/People/Calendar |
| I-16 | 侧边栏 | 次导航 2 项 | Trips/Inbox |
| I-17 | 侧边栏 | 无 Family/Expenses/Insights | 确认不在导航中 |

---

## 测试优先级

| 优先级 | 范围 | 数量 |
|--------|------|------|
| **P0** | 六条规矩 + Wow + 端到端数据流 | 19 |
| **P1** | 九宫格 B 区 + Agent + 导航 | 44 |
| **P2** | 基础模块 A 区 + Cron + 边界 | 45 |
| **总计** | | **108** |

---

*测试通过标准：P0 全部通过，P1 通过率≥90%，P2 通过率≥80%。*
