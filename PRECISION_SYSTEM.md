# Chief Precision System
## 承诺提取精度体系 v1.0 | 2026-03-30

---

## 一、核心架构：单次调用自我审判

```
邮件/消息输入
      │
      ▼
┌─────────────────────────────────────────────┐
│  预过滤（零成本，不调LLM）                    │
│                                             │
│  发件人是 newsletter/noreply?  → 跳过        │
│  标题是 Out of Office?        → 跳过        │
│  用户不在 To 只在 CC?          → 跳过        │
│  内容少于20字?                 → 跳过        │
│  系统自动通知(calendar/AWS)?   → 跳过        │
│                                             │
│  预估过滤率: 50-70% 的邮件不需要调LLM        │
└─────────────────┬───────────────────────────┘
                  │ 通过
                  ▼
┌─────────────────────────────────────────────┐
│  LLM 单次调用：提取 + 自我审判               │
│                                             │
│  步骤1: 扫描邮件，列出所有候选承诺            │
│  步骤2: 对每个候选，跑三关审判：              │
│         Q1 后果测试 — 忘了会怎样？            │
│         Q2 主动性测试 — 主动承诺还是条件性？   │
│         Q3 追踪价值 — 值得单独追踪吗？        │
│  步骤3: 只输出通过三关的承诺                  │
│                                             │
│  内置负样本: 6类明确不提取的模式              │
│  内置规则: confidence < 0.7 不输出            │
│  内置规则: 保留原文语言                       │
└─────────────────┬───────────────────────────┘
                  │ 提取结果
                  ▼
┌─────────────────────────────────────────────┐
│  后过滤（零成本，规则层）                     │
│                                             │
│  title含条件词(probably/might/if)?  → 丢弃   │
│  title少于3个词?                    → 丢弃   │
│  同一邮件超过4个承诺?     → 只保留top 3       │
│  与已有active承诺重复?            → 丢弃      │
└─────────────────┬───────────────────────────┘
                  │ 最终结果
                  ▼
┌─────────────────────────────────────────────┐
│  反馈收集（被动，不打扰用户）                 │
│                                             │
│  用户点"完成"    → 正样本（真承诺）            │
│  用户点"删除"    → 负样本（假阳性）            │
│  用户手动添加    → 漏检样本（假阴性）          │
│                                             │
│  数据存入 commitment_feedback 表              │
│  每周自动统计假阳性率/假阴性率                │
└─────────────────────────────────────────────┘
```

---

## 二、自我审判 Prompt

### 2.1 承诺提取（邮件场景）

```
你是承诺提取专家。分析邮件，执行两步：

═══ 第一步：候选提取 ═══

从邮件中找出所有可能的承诺。分两种：
1. i_promised: 发件人承诺要做的事（"I'll send", "我来处理", "下周给你"）
2. waiting_on_them: 发件人要求收件人做的事（"Could you", "请帮忙", "什么时候能"）

═══ 第二步：三关审判（每个候选必须全部通过） ═══

Q1 后果测试: 如果这件事被忘了，会发生什么？
   → 有真实后果（丢客户/错过deadline/失信/损失金钱） → 通过
   → 无真实后果（社交场合缺席/日常寒暄/内部例行） → 不通过

Q2 主动性测试: 这是一个主动的、明确的承诺吗？
   → 明确主动（"I will", "我来", "下周前发给你"） → 通过
   → 自动模板（Out of Office "I will respond"） → 不通过
   → 条件限定（"probably", "if no one else", "maybe"） → 不通过
   → 模糊意向（"we should catch up sometime"） → 不通过

Q3 追踪价值测试: 这件事值得单独追踪吗？
   → 有明确的可交付物或行动（发文档/回复邮件/完成任务） → 通过
   → 日常例行（参加例会/回复已处理的邮件） → 不通过
   → 太琐碎（"I'll take a look"没有具体产出） → 不通过

═══ 明确不是承诺（不要提取） ═══

- "I'll be there" / "Count me in" / "See you" → 简单出席确认
- "I will respond when I return" → Out of Office 自动回复
- "Sounds good" / "OK" / "Got it" / "Thanks" → 确认或感谢
- "I can probably..." / "if time permits..." → 条件性表述
- "Looking forward to..." / "Let me know if you need..." → 客套话
- "As discussed..." / "Per our call..." → 总结已发生的事，不是新承诺
- 日历邀请 / 系统通知 / Newsletter → 自动生成的内容

═══ 输出规则 ═══

- JSON格式: { "commitments": [...], "rejected": [...], "summary": "..." }
- 每个commitment: { type, title, due_date, due_reason, confidence }
- rejected: 列出被审判淘汰的候选及淘汰原因（用于调试）
- confidence < 0.7 的不要放进 commitments，放进 rejected
- title 保留原文语言（中文邮件用中文title，英文用英文，混合保留混合）
- 一封邮件最多提取 4 个承诺，多了大概率是过度提取
```

### 2.2 承诺提取（WhatsApp/语音场景）

```
你是承诺提取专家。分析聊天消息，执行同样的两步提取+审判。

额外规则（聊天场景特有）：
- 聊天比邮件更口语化，"好的我来"比"I will"更常见
- 语音转文字可能有错别字，理解意图而非字面
- 家庭承诺也要提取，type 用 "family"
  "答应孩子周末去动物园" → family
  "老婆说要买菜" → 不是承诺（是信息传递）
  "跟儿子说好了暑假去日本" → family

其他审判规则同上。
```

### 2.3 rejected 字段的价值

输出的 `rejected` 数组不展示给用户，但对我们极有价值：

```json
{
  "commitments": [
    { "type": "i_promised", "title": "Send term sheet to Li Ming", "confidence": 0.92 }
  ],
  "rejected": [
    { "title": "Respond when I return", "reason": "Q2 failed: auto-reply template", "confidence": 0.4 },
    { "title": "Attend the meeting", "reason": "Q3 failed: routine attendance", "confidence": 0.6 }
  ]
}
```

用途：
1. 调试：看模型在审判什么，审判理由对不对
2. 精度追踪：如果用户手动添加了一个被rejected的承诺，说明审判标准太严
3. 数据积累：rejected里的负样本可以用来微调

---

## 三、预过滤层

### 3.1 邮件预过滤

```typescript
function shouldSkipEmail(email: {
  from_address: string
  from_name: string
  subject: string
  snippet: string
  to_address: string
  user_email: string
}): { skip: boolean; reason: string } {

  const from = email.from_address.toLowerCase()
  const subject = (email.subject || '').toLowerCase()
  const snippet = (email.snippet || '').trim()

  // 1. 系统发件人
  const systemSenders = [
    'noreply', 'no-reply', 'donotreply', 'mailer-daemon',
    'notifications@', 'alert@', 'billing@',
    'calendar-notification', 'calendar@google',
  ]
  if (systemSenders.some(s => from.includes(s))) {
    return { skip: true, reason: 'system_sender' }
  }

  // 2. Newsletter/营销
  const marketingPatterns = [
    'newsletter', 'digest', 'weekly update', 'unsubscribe',
    'marketing', 'promo', 'campaign',
  ]
  if (marketingPatterns.some(p => from.includes(p) || subject.includes(p))) {
    return { skip: true, reason: 'newsletter' }
  }

  // 3. 自动回复
  const autoReply = [
    'out of office', 'auto-reply', 'automatic reply',
    'away from', 'on vacation', '自动回复', '不在办公室',
  ]
  if (autoReply.some(p => subject.includes(p))) {
    return { skip: true, reason: 'auto_reply' }
  }

  // 4. 用户只在CC不在TO
  if (email.to_address && !email.to_address.toLowerCase().includes(email.user_email.toLowerCase())) {
    return { skip: true, reason: 'cc_only' }
  }

  // 5. 内容太短
  if (snippet.length < 20) {
    return { skip: true, reason: 'too_short' }
  }

  // 6. 日历/会议系统
  if (from.includes('calendar') || subject.includes('.ics') || subject.match(/^(accepted|declined|tentative):/i)) {
    return { skip: true, reason: 'calendar_system' }
  }

  return { skip: false, reason: '' }
}
```

### 3.2 预过滤指标追踪

```
每次同步记录：
  总邮件数: N
  预过滤跳过: M (原因分布)
  送入LLM: N-M
  LLM提取到承诺: K

目标: M/N > 50% (过滤掉一半以上的邮件不调LLM)
```

---

## 四、后过滤层

```typescript
function postFilterCommitments(
  commitments: Array<{ type: string; title: string; confidence: number }>,
  existingCommitments: Array<{ title: string }>
): Array<{ type: string; title: string; confidence: number; filtered_reason?: string }> {

  const passed: typeof commitments = []
  const filtered: Array<typeof commitments[0] & { filtered_reason: string }> = []

  for (const c of commitments) {
    // 1. 条件性语言（LLM可能漏判）
    const conditionalPattern = /\b(probably|might|maybe|perhaps|could possibly|if .{3,20} then|depends on|not sure)\b/i
    if (conditionalPattern.test(c.title)) {
      filtered.push({ ...c, filtered_reason: 'conditional_language' })
      continue
    }

    // 2. title太短（可能是噪音）
    if (c.title.replace(/\s/g, '').length < 8) {
      filtered.push({ ...c, filtered_reason: 'title_too_short' })
      continue
    }

    // 3. 去重（跟已有active承诺比较）
    const isDupe = existingCommitments.some(existing =>
      similarity(existing.title.toLowerCase(), c.title.toLowerCase()) > 0.8
    )
    if (isDupe) {
      filtered.push({ ...c, filtered_reason: 'duplicate' })
      continue
    }

    passed.push(c)
  }

  // 4. 单邮件上限（LLM可能过度提取）
  if (passed.length > 4) {
    const sorted = passed.sort((a, b) => b.confidence - a.confidence)
    const kept = sorted.slice(0, 3)
    const dropped = sorted.slice(3)
    for (const d of dropped) {
      filtered.push({ ...d, filtered_reason: 'per_email_limit' })
    }
    return kept
  }

  return passed
}

// 简单的字符串相似度（Jaccard on words）
function similarity(a: string, b: string): number {
  const setA = new Set(a.split(/\s+/))
  const setB = new Set(b.split(/\s+/))
  const intersection = new Set([...setA].filter(x => setB.has(x)))
  const union = new Set([...setA, ...setB])
  return intersection.size / union.size
}
```

---

## 五、反馈收集系统

### 5.1 数据模型

```sql
-- 承诺反馈表
CREATE TABLE commitment_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  commitment_id UUID REFERENCES commitments(id) ON DELETE SET NULL,

  -- 反馈类型
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'confirmed',     -- 用户标记完成 = 真承诺
    'rejected',      -- 用户删除 = 假阳性
    'manual_add',    -- 用户手动添加 = 我们漏检的
    'modified'       -- 用户修改了title/type = 我们提取不准
  )),

  -- 原始数据（用于复盘）
  original_title TEXT,
  original_type TEXT,
  modified_title TEXT,          -- 如果用户改了
  source_email_snippet TEXT,    -- 来源邮件片段
  source_type TEXT,             -- email/whatsapp/manual

  -- LLM提取的元信息
  llm_confidence NUMERIC(3,2),
  llm_rejected_reason TEXT,     -- 如果是从rejected列表里手动添加的

  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE commitment_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own feedback" ON commitment_feedback
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_feedback_user ON commitment_feedback(user_id, feedback_type);
```

### 5.2 反馈触发点

```
用户操作                    触发
─────────────────────────────────────
点"完成"按钮             → confirmed
点"删除"或"不是承诺"     → rejected
手动添加新承诺            → manual_add
编辑承诺的title或type     → modified
```

### 5.3 周度精度报告（自动生成）

```
Chief 精度周报 (2026-04-07)
===========================

本周数据:
  邮件扫描: 312 封
  预过滤跳过: 189 封 (60.6%)
  送入LLM: 123 封
  提取承诺: 47 个
  LLM自我审判淘汰: 23 个

用户反馈:
  confirmed (标记完成): 38 个
  rejected (用户删除): 4 个
  manual_add (手动添加): 2 个
  modified (修改内容): 3 个

精度指标:
  Precision: 38/(38+4) = 90.5%   ← 目标 >85%
  假阳性率: 4/47 = 8.5%          ← 目标 <10%
  假阴性数: 2                     ← 越少越好

假阳性分析:
  - "Attend team standup" → 日常例会，审判Q3应该拦截
  - "Review PR comments" → 太琐碎，审判Q3应该拦截
  - "Book restaurant" → 被误认为承诺，实际是自己的提醒
  - "Respond to survey" → newsletter里的CTA

优化建议:
  1. 在负样本列表中加入"attend standup/daily/weekly"
  2. 降低"book/reserve"类动作的confidence
```

---

## 六、进化路径

### Phase 1: 基础精度（现在 → 2周内）
```
实现:
  ✦ 自我审判prompt（替换当前commitment-extraction.ts）
  ✦ 预过滤函数（在sync/process调LLM前执行）
  ✦ 后过滤函数（LLM返回后执行）
  ✦ rejected字段记录被淘汰的候选

预期:
  Precision: 71% → 90%+
  Recall: 91.7% → 88%+
  Token消耗: 减少40-60%（预过滤砍掉大量无效调用）
```

### Phase 2: 反馈闭环（2周 → 1个月）
```
实现:
  ✦ commitment_feedback表
  ✦ 承诺卡片加"不是承诺"按钮
  ✦ 手动添加时关联来源邮件
  ✦ 周度精度报告（cron自动生成）

预期:
  开始积累真实的正负样本数据
  每周可以看到精度趋势
```

### Phase 3: 个性化Few-shot（1个月 → 3个月）
```
实现:
  ✦ 每个用户积累50+反馈后，提取其独特的正/负样本
  ✦ 动态构建per-user prompt:
    "以下是你通常认为是承诺的例子: [从confirmed里选3个]"
    "以下是你通常不追踪的事: [从rejected里选3个]"
  ✦ prompt不再是通用的，而是用户专属的

预期:
  Precision: 90% → 95%+
  不同用户有不同的"承诺"标准，系统自动适应
```

### Phase 4: 微调（3个月 → 6个月，如果有1000+用户）
```
实现:
  ✦ 积累全体用户的反馈数据
  ✦ 清洗标注 → 微调DeepSeek/Qwen专属模型
  ✦ 微调模型替代通用模型做承诺提取

预期:
  Precision: 95%+
  推理成本: 降低80%（小模型比大模型便宜）
  延迟: 降低60%
```

---

## 七、指标体系

### 核心指标

| 指标 | 定义 | 目标 | 当前 |
|------|------|------|------|
| Precision | confirmed / (confirmed + rejected) | >90% | 71% |
| Recall | (confirmed + manual_add未漏) / 总真实承诺 | >85% | 91.7% |
| F1 | 2*P*R/(P+R) | >87% | 80% |
| 假阳性率 | rejected / 总提取 | <10% | 29% |
| 假阴性率 | manual_add / (confirmed + manual_add) | <15% | 未知 |
| 预过滤率 | 跳过邮件 / 总邮件 | >50% | 0% |
| Token/承诺 | 平均每个承诺消耗的token | <500 | ~1500 |

### 监控告警

```
假阳性率 > 15% → 告警: prompt可能需要调整
假阴性率 > 20% → 告警: prompt可能太严格
预过滤率 < 30% → 告警: 过滤规则可能太松
Token/承诺 > 2000 → 告警: 成本异常
```

---

## 八、与token优化的整合

自我审判方案同时解决精度和成本两个问题:

| 优化点 | 精度影响 | 成本影响 |
|--------|---------|---------|
| 预过滤跳过50%邮件 | 不影响 | token减少50% |
| 单次调用(不用二次验证) | 同等或更好 | 不增加成本 |
| rejected字段 | 可调试 | 增加~50 tokens/调用 |
| 后过滤规则 | 提升precision | 零成本 |
| confidence 0.7门槛内置 | 减少假阳性 | 减少存储的无效数据 |

**综合效果: precision从71%→90%+, 同时token消耗减少40-60%。**
