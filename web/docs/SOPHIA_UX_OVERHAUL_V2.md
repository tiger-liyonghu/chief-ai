# Sophia UX 大修方案 V2（定稿）

**来源：UX 研究员 + UI 设计师 + 产品经理三方会审 → 纲领校准**

---

## 一、诊断共识

> **Sophia 有表面没深度。问题不是功能少，是点开之后没有下一步。**

三个根因：

| 根因 | 表现 | 修复方向 |
|------|------|---------|
| 导航按数据类型 | 页面 = 数据库表名 | 按用户意图组织：「现在该做什么」 |
| 模块无连接 | 邮件/承诺/联系人/日历是孤岛 | 所有数据交叉链接 |
| 有名词无动词 | 看到信息但没法操作 | 每个数据点变成可操作的 |

---

## 二、纲领校准后的 6 条设计铁律

基于 SOPHIA_MANIFESTO.md 的 25 条原则，以下规则优先于任何设计决策：

1. **Today = 时间轴 + Sophia 判断。** 不是独立于 Calendar 的新页面，是同一条时间轴的简化版。纲领说「日历是约束求解器」，Today 是它的摘要视图。

2. **家庭渗透不分离。** Family 页面改为「Family Setup」（配置家庭成员和日程）。日常家庭事件只在 Calendar 和 Today 里看到，用温暖色（coral/pink）渗透在每个视图中。

3. **操作必须确认。** 冲突解决卡片、邮件发送、日程修改，所有写操作都需要用户确认。纲领第 6 条：不越权。

4. **Insight bar 遵守沉默规则。** 每个页面可以有 Sophia 的判断，但没有重要的事就不显示。纲领第 11 条：沉默是美德。

5. **Sophia 视觉克制。** 小 S 标记，不是大 logo。做完就退，不在每个角落刷存在感。纲领第 14 条：不邀功。

6. **标签而非模块。** 工作种类（出差/销售/融资）是标签，不是独立页面。Trips 和 Expenses 嵌入主流程，不单独占导航。

---

## 三、导航重构

### 现在
```
Commitments | Calendar | Inbox | People | Trips | Family | Expenses | Insights
```

### 改为
```
主导航（5 个）：
  Today     — 时间轴摘要 + Sophia 判断（首页）
  Calendar  — 完整 4 层日历
  Inbox     — 邮件 + WhatsApp
  People    — 联系人 + 关系
  More ↓    — Trips / Expenses / Insights / Family Setup / Settings

移动端底栏（4 个）：
  Today | Calendar | Inbox | Sophia Chat
```

### 变化说明
- Commitments 不再是独立页面 → 承诺融入 Today + Calendar + People
- Trips / Expenses → 降到 More（CEO 不是每天看）
- Family → 改名 Family Setup，降到 More
- Insights → 降到 More
- 移动端加 Sophia Chat（之前手机上看不到）

---

## 四、Phase 1（2 周）— 杀死死角 + 基础可用

### 4.1 Today 首页

替代当前的承诺列表。核心：**Sophia 的一天视图。**

```
┌─────────────────────────────────────────┐
│ Good morning, Tiger.                    │
│                                         │
│ ━━ 最重要的 ━━                          │
│ 🔴 回 Lisa 的 DD checklist（逾期3天）   │
│    [📝 Draft Reply]  [✓ Done]          │
│                                         │
│ ━━ 今天的日程 ━━                        │
│ 09:00  Team Standup · Zoom              │
│ 14:00  投资人会议 Lisa Tan · Office     │
│   ⚠️ 和 Emily 学校接送 14:45 冲突      │
│   [🔄 Reschedule] [💬 Notify Wife]     │
│ 16:00  Kevin Lim 电话                   │
│                                         │
│ ━━ 等对方 ━━                            │
│ David Chen · Sequoia term sheet（逾期4天）│
│    [📤 Send Nudge]                      │
│                                         │
│ 💗 Emily 钢琴课 15:30                   │
│                                         │
│ ━━ Sophia 说 ━━                         │
│ 你有 16 件事在跑，完成率 50%。           │
│ 建议今天只做 Lisa 和 David，其他推后。    │
└─────────────────────────────────────────┘
```

**数据来源：** 复用 `/api/calendar/unified` + `/api/commitments/stats` + 心的干预检查。
**每个条目可操作：** Draft / Done / Nudge / Reschedule — 一键完成。
**冲突解决卡片：** 检测到冲突时显示选项（改时间/通知家人），所有操作需确认。
**Sophia 说：** 只在有重要判断时显示（沉默规则）。

### 4.2 邮件基础功能

| 功能 | 说明 |
|------|------|
| 邮件线程 | 点开邮件显示完整 thread（同一 thread_id 的邮件） |
| 附件标记 | 有附件的邮件显示 📎 图标 |
| 搜索 | 搜索框搜邮件主题/发件人/内容 |
| 会议链接提取 | 自动识别 Teams/Zoom/Meet 链接，显示「Join Meeting」按钮 |
| 发件人完整显示 | 名字 + 邮箱 + 来源账号标签 ✅ 已修 |
| Send Reply | AI 草稿后的发送按钮 ✅ 已修 |
| 多账号标签 | 显示邮件到达哪个账号 ✅ 已修 |

### 4.3 日历事件详情页

点击日历事件 → 展开完整详情：

```
┌────────────────────────────────────┐
│ 投资人会议 — Lisa Tan (Temasek)    │
│ 14:00 - 15:30 · Office, Level 12  │
│                                    │
│ 👥 Lisa Tan (VIP), CFO            │
│ 🔗 与 Lisa 有 2 个活跃承诺        │  ← 交叉链接
│ 📝 Meeting Prep 已生成            │
│                                    │
│ [Join Meeting] [View Prep] [Edit]  │
│ [Reschedule]   [Cancel]           │
└────────────────────────────────────┘
```

### 4.4 联系人互动时间线

联系人详情页加互动历史：

```
Lisa Tan · Temasek · VIP ⭐
温度：🟢 Hot (85/100)

━━ 互动历史 ━━
3/31  📧 DD checklist follow up（待回复）
3/28  📧 IC Meeting materials needed
3/25  📅 投资人更新会议
3/20  📧 Term sheet discussion

━━ 承诺 ━━
🔴 DD checklist（逾期 3 天）
🟡 完整融资材料包（5 天后）

[📝 Draft Email] [📅 Schedule Meeting] [📤 Send Check-in]
```

### 4.5 交叉链接

| 从 | 到 | 怎么链 |
|----|----|----|
| 承诺卡片 → 联系人名字 | `/dashboard/contacts/[id]` | `<Link>` 替代纯文本 |
| 邮件 → 发件人 | `/dashboard/contacts/[id]` | 点击名字跳转 |
| 日历事件 → 出席者 | `/dashboard/contacts/[id]` | 点击名字跳转 |
| 联系人 → 相关承诺 | 联系人详情页显示 | 查询 commitments 表 |
| 联系人 → 相关邮件 | 联系人详情页显示 | 查询 emails 表 |
| 日历事件 → 相关承诺 | 事件详情显示 | 按联系人匹配 |

### 4.6 Sophia 全局入口

- **桌面：** 右下角悬浮按钮（替代 TopBar 的 Ask Sophia 按钮）
- **移动：** 底栏第四个 tab
- **Proactive toast：** Sophia 检测到重要信息时弹出小通知，3 秒后消失。点击展开详情。遵守沉默规则。

---

## 五、Phase 2（2 周）— 设计升级 + 智能

### 5.1 排版层次

```css
/* 4 层字号 */
--heading:   text-2xl sm:text-3xl font-semibold tracking-tight  /* 页面标题/问候 */
--section:   text-lg font-medium                                  /* 区块标题 */
--body:      text-sm                                              /* 正文 */
--caption:   text-xs text-text-tertiary                           /* 辅助信息 */

/* 节标题加 overline */
.section-label {
  @apply text-[11px] font-semibold uppercase tracking-widest text-text-tertiary;
}
```

### 5.2 色彩温度

```css
/* 从冷 indigo 调暖 */
--color-primary: #4f46e5;        /* 保留 indigo 但稍深 */
--color-surface: #faf9f7;        /* warm white 替代纯白 */
--color-family: #e17055;         /* coral — 家庭层 */
--color-success: #00b894;        /* teal — 积极 */
--color-sophia: linear-gradient(135deg, #6366f1, #8b5cf6); /* Sophia 标识 */
```

### 5.3 冲突解决卡片

```
┌─ ⚠️ 时间冲突 ─────────────────────┐
│                                    │
│ 📅 投资人会议 14:00               │
│ 💗 Emily 学校接送 14:45           │
│                                    │
│ Sophia 建议：                      │
│ 会议改到上午 10:00（Lisa 那天有空）│
│                                    │
│ [改到 10:00（需确认）]             │  ← 确认步骤
│ [通知老婆我迟到 30 分钟]          │
│ [保持不变]                         │
└────────────────────────────────────┘
```

### 5.4 邮件智能分类

```
[🔴 需回复 (4)] [📋 FYI (8)] [📰 营销 (12)]

需回复 tab 只显示 is_reply_needed=true 的邮件
FYI tab 显示不需要回复的正常邮件
营销 tab 显示 newsletter/promotional
```

### 5.5 联系人重新联系提醒

Sophia 检测 VIP 14 天无互动 → Today 页面显示：
```
💡 Lisa Tan 已经 21 天没联系了。
   [📝 Send Check-in] [📅 Schedule Catch-up]
```

### 5.6 Sophia Proactive Toast

```
┌─────────────────────────────────┐
│ 🍎 David 的邮件等了 3 天了。    │
│    要我起草回复吗？              │
│    [📝 Draft] [⏭ Later] [✕]   │
└─────────────────────────────────┘
3 秒后自动消失，不阻塞操作。
```

---

## 六、Phase 3（2 周）— 只有 Sophia 能做的

| 功能 | 说明 | 竞品有吗 |
|------|------|---------|
| 承诺→日历同步 | 承诺 deadline 自动变成日历上的工作 block | 没有 |
| 关系信任图谱 | 谁和你互相守信，谁经常拖延 | 没有 |
| 出差前联系人激活 | 「你在上海认识 3 个人，David 45 天没联系」 | 没有 |
| 家庭冲突守护 | 创建事件时自动检查硬约束 + 解决建议 | ✅ 已有 |
| 会议关系简报 | 会议前显示出席者背景 + 历史 + 承诺 | ✅ 已有 |
| 邮件 Snooze | 暂时隐藏，设定时间再出现 | Gmail 有 |
| 自然语言创建事件 | 「明天 9 点和 John 喝咖啡」 | Fantastical 有 |

---

## 七、设计参考

| App | 学什么 |
|-----|--------|
| Linear | 排版层次、信息密度 |
| Superhuman | 邮件速度感和掌控感 |
| Notion Calendar | 多层日历保持清爽 |
| Arc Browser | 专业工具里的温度 |
| Amie | 日历+任务融合的优雅 |

---

## 八、验收标准

每个 Phase 完成后，用以下标准验收：

| 标准 | 描述 |
|------|------|
| 零死角 | 每个可点击的元素都有下一步 |
| 3 秒法则 | 打开任何页面，3 秒内知道最重要的事 |
| 交叉链接 | 从任何联系人能看到邮件/承诺/日历 |
| 沉默合规 | Sophia 没有重要的事就不显示 |
| 确认合规 | 所有写操作有确认步骤 |
| 温暖感 | 家庭事件用 coral，不是冷色 |
| 移动可用 | 手机上 Sophia Chat 可访问 |

---

*本文档基于 SOPHIA_MANIFESTO.md 校准。所有设计决策以纲领 25 条原则为准。*
