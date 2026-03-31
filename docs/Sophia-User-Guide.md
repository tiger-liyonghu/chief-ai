# Sophia 使用指南

从登录到跟 Sophia 对话，5 分钟完成。

---

## 第一步：打开网站

1. 打开浏览器（Chrome / Safari / Edge 均可）
2. 在地址栏输入 **https://at.actuaryhelp.com**
3. 你会看到 Sophia 的登录页面，页面上有两个按钮：
   - 「使用 Google 登录」
   - 「使用 Microsoft 登录」

---

## 第二步：登录

### 方式 A：用自己的 Google 账号（推荐）

1. 点击「**使用 Google 登录**」按钮
2. 浏览器会跳转到 Google 登录页面
3. 选择你的工作邮箱（或输入邮箱地址 + 密码）
4. Google 会显示一个授权确认页面，内容是「Sophia 请求访问你的 Gmail 和 Google Calendar」
5. 点击「**允许**」
6. 页面自动跳转，进入 Sophia

> 说明：Sophia 会读取你的邮件和日历来帮你追踪承诺和安排日程。你可以随时在 Google 账号设置（https://myaccount.google.com/permissions）中撤销授权。

### 方式 B：用测试账号体验

如果你不想用自己的邮箱，可以用我们的演示账号：

1. 点击「**使用 Google 登录**」按钮
2. 在 Google 登录页面，输入以下信息：
   - 邮箱：**aiat.actuaryhelp@gmail.com**
   - 密码：**AIAT@actuaryhelp.com**
3. 点击「下一步」→ 点击「允许」
4. 页面自动跳转，进入 Sophia

---

## 第三步：初始设置（Onboarding）

首次登录后，Sophia 会引导你完成初始设置。页面分为三个部分：

### 3.1 邮箱确认

页面顶部会显示你刚才登录的邮箱地址（绿色标记 ✓），表示邮箱已连接。

如果你有多个工作邮箱，可以点击「**Add another email (optional)**」添加。这一步是可选的，跳过也没关系。

### 3.2 绑定 WhatsApp（必须）

这是最关键的一步。绑定后你就可以在 WhatsApp 里直接跟 Sophia 对话。

**操作步骤：**

1. 在页面中间找到 **WhatsApp** 区域
2. 输入你的手机号码（带国家码，例如 +65 8012 3456）
3. 点击「**Connect**」按钮
4. 页面会显示一个 **8 位配对码**（例如 `A3B7-K9M2`）
5. 拿起你的手机，打开 **WhatsApp**
6. 点击右上角 **三个点 ⋮**（安卓）或 **设置**（iPhone）
7. 点击「**Linked Devices（关联设备）**」
8. 点击「**Link a Device（关联设备）**」
9. 选择「**Link with phone number（用手机号关联）**」
10. 输入页面上显示的 **8 位配对码**
11. 等待 3-5 秒，手机提示「已关联」
12. 回到 Sophia 页面，WhatsApp 状态变为绿色 ✓

> 隐私说明：Sophia 只读取你发给自己的消息（self-chat）。你和其他人的私聊不会被读取。

### 3.3 扫描邮件

WhatsApp 绑定成功后，「**Scan Emails & Discover Commitments**」按钮会亮起：

1. 点击按钮
2. Sophia 开始扫描你最近 7 天的邮件
3. 页面会实时显示发现的承诺（你答应的 / 对方答应的）
4. 扫描完成后，点击「**Enter Sophia**」进入仪表盘

---

## 第四步：设置时区和简报时间

进入仪表盘后，建议先完成两个设置：

1. 点击左侧导航栏底部的 **Settings（设置）**
2. 找到「**Timezone（时区）**」→ 选择你所在的时区（如 Asia/Singapore）
3. 找到「**Daily Brief Time（每日简报时间）**」→ 设置你希望收到晨间简报的时间（建议 08:00）

设置完成后，Sophia 每天会在你指定的时间通过 WhatsApp 推送当日重点。

---

## 第五步：跟 Sophia 对话

打开手机 WhatsApp，找到你自己的聊天（saved messages / 给自己发消息），发一条消息：

### 查看日程
```
今天有什么安排？
```
Sophia 会调用你的 Google Calendar，列出今天的会议和时间。

### 查看承诺
```
有什么逾期的事？
```
Sophia 会列出你答应别人但还没完成的承诺，按紧急度排序。

### 草拟邮件
```
帮我回 David 的邮件
```
Sophia 会找到 David 最近的邮件，生成一封回复草稿，你确认后一键发送。

### 出差准备
```
下周东京出差帮我准备一下
```
Sophia 会整理航班信息、酒店确认、当地会议、文化提醒、餐厅推荐。

### 记录发票
直接拍照发给 Sophia（在自己的聊天里），她会自动识别金额、商户、币种、类目，归到对应的出差行程。

### 建任务
```
提醒我周五前给 Lisa 发方案
```
Sophia 会创建一个任务，到期前通过 WhatsApp 提醒你。

### 快捷操作

Sophia 发的承诺提醒里会附带短 ID（如 `a3b7`），你可以直接回复：
- `完成 a3b7` — 标记承诺已完成
- `起草 a3b7` — 自动草拟回复邮件
- `延期 a3b7` — 延期 7 天
- `催 a3b7` — 生成催促邮件

---

## 第六步：体验晨间简报

如果你设置了每日简报时间，Sophia 会在指定时间通过 WhatsApp 推送一条简报，以 🍎 开头。

简报内容：
- 今天最重要的 1-2 件事（不是列清单，而是给判断）
- 逾期的承诺（你答应了但没做的）
- 需要回复的邮件
- Sophia 的行动建议（比如附上草拟的回复）

如果今天没什么重要的事，Sophia 会说「今天清净，安心做事」，不会凑数。

---

## 第七步：探索仪表盘

回到网页端 https://at.actuaryhelp.com/dashboard ，左侧导航栏有以下页面：

| 页面 | 功能 |
|------|------|
| Today（今天） | 今日概览：承诺状态、日程时间线、Agent 工作状态 |
| Calendar（日历） | 四层统一日历：工作事件 + 家庭活动 + 承诺截止日 + 出差行程 |
| Inbox（收件箱） | 统一邮箱：Gmail + WhatsApp 消息，支持搜索和筛选 |
| People（联系人） | 关系管理：VIP 标注、互动频率、关系温度（热/温/冷） |
| Trips（出差） | 出差管理：行前简报、落地推荐、发票追踪、报销汇总 |
| Family（家庭） | 家庭日历：硬约束事件，工作不能覆盖 |
| Insights（洞察） | 周报：承诺完成率、关系健康度、出差开支统计 |
| Settings（设置） | 账号、WhatsApp、时区、语言、AI 模型配置 |

---

## 常见问题

**Q: WhatsApp 配对码输入后没反应？**
A: 确保手机 WhatsApp 是最新版本。配对码有效期约 2 分钟，过期后回到 Sophia 页面重新点「Connect」获取新码。

**Q: Sophia 没有回复我的 WhatsApp 消息？**
A: 两个检查点：
1. Settings 里的「Sophia AI Assistant」开关是否打开
2. 消息必须发在「给自己的聊天」里（不是发给其他联系人）

**Q: 我能用 Outlook 邮箱吗？**
A: 可以。登录页点击「使用 Microsoft 登录」，用 Outlook 账号授权即可。

**Q: 我的数据安全吗？**
A: 所有数据存储在加密数据库中。WhatsApp 使用端到端加密，消息不经过第三方服务器。你可以在 Settings 里随时导出数据或删除账号。

**Q: 测试完想断开 WhatsApp？**
A: 两种方式：
1. Sophia Settings → WhatsApp Integration → 「Disconnect」
2. 手机 WhatsApp → Settings → Linked Devices → 删除 Sophia 设备

---

## 需要帮助？

直接在 WhatsApp 里跟 Sophia 说你要做什么，她会尽力帮你。

如有技术问题，联系：sophie@actuaryhelp.com
