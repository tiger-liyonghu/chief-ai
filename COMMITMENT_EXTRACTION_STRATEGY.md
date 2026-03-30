# Chief 承诺提取引擎 — 技术策略

## 2026-03-30 | v1.0

---

## 一、现状诊断

### 1.1 Baseline 数据（210 封测试邮件）

| 指标 | 当前值 | 世界级标准 | 差距 |
|------|--------|-----------|------|
| Precision | 58% | >95% | -37 |
| Recall | 63% | >85% | -22 |
| F1 | 60% | >90% | -30 |
| Pre-filter | 97% | >95% | OK |

### 1.2 分类表现

| 分类 | F1 | 诊断 |
|------|-----|------|
| Easy 正例 | 84% | 基本功 OK |
| Deadline 推断 | 87% | 强项 |
| 隐含承诺 | 86% | 强项 |
| 长邮件 | 90% | 强项 |
| 回复链 | 88% | 强项 |
| 中文正例 | 69% | 中等，方向判断是弱点 |
| 多承诺邮件 | 42% | 弱 — 提取不全 |
| 混合语言 | 22% | 很弱 |
| 高误报风险 | 0% | 负例邮件全在误提取 |
| 语气歧义 | 40% | 弱 — 无法判断是否真承诺 |

### 1.3 核心问题分类

| 问题类型 | 占总误差 | 根因 |
|---------|---------|------|
| **方向混淆** (i_promised vs waiting_on_them) | ~25% | Prompt 缺乏明确的方向指导 + DeepSeek-chat 推理弱 |
| **负例误提取** (policy/agenda 当承诺) | ~30% | 单次调用无法可靠区分"描述"和"承诺" |
| **多承诺漏检** | ~20% | Max token 不够 + 模型倾向保守 |
| **语气/文化误判** | ~15% | "我尽量"在中文商务语境是承诺，但模型当成 hedge |
| **匹配问题** (eval 框架) | ~10% | Ground truth pattern 不够宽 |

---

## 二、方法论框架

### 2.1 信任优先原则

来自全球最佳实践的核心共识：

**一个误报对用户信任的伤害 = 5-10 个漏检**

这意味着：
- 宁可少提取，不可乱提取
- Precision 优先级永远高于 Recall
- 不确定时，不提取 → 放入"可能"队列让用户决定
- 用户手动添加漏掉的承诺是可接受的；用户删除误报承诺是不可接受的

### 2.2 三层置信度架构

| 置信度 | 范围 | 行为 | 用户体验 |
|--------|------|------|---------|
| **HIGH** | >0.9 | 直接展示为"检测到的承诺" | 主动推送到 WhatsApp |
| **MEDIUM** | 0.7-0.9 | 展示为"可能的承诺"，柔性 UI | Dashboard 显示，不推送 |
| **LOW** | <0.7 | 不展示，仅记录 | 用户不可见 |

### 2.3 两步 Pipeline 架构（全球趋势）

```
邮件输入
    │
    ▼
┌──────────────────┐
│ Step 0: Pre-filter│  ← 规则层，零成本，过滤系统邮件/newsletter
│ (现有，97% 准确)  │
└────────┬─────────┘
         │ 通过的邮件
         ▼
┌──────────────────┐
│ Step 1: Extract   │  ← DeepSeek-chat，宽松提取
│ 快速模型，高召回   │     目标：Recall >95%，Precision ~60%
│ (~1-2s per email) │     "宁多勿漏"
└────────┬─────────┘
         │ 候选承诺 (含 confidence)
         ▼
┌──────────────────┐
│ Step 2: Verify    │  ← DeepSeek-reasoner 或第二次 chat 调用
│ 推理模型，高精度   │     逐个验证：这真的是承诺吗？
│ (~3-5s per item)  │     目标：Precision >95%
└────────┬─────────┘
         │ 验证后的承诺
         ▼
┌──────────────────┐
│ Step 3: Post-filter│  ← 规则层，去重、过滤已知模式
│ + 日历交叉验证     │     与日历比对 deadline
└────────┬─────────┘
         │
         ▼
    展示给用户（按置信度分层）
```

### 2.4 Chat vs Reasoner 策略

| 模型 | 角色 | 特点 | 适用场景 |
|------|------|------|---------|
| **DeepSeek-chat** | 提取器 (Step 1) | 快 (~1s)、便宜、召回高 | 所有邮件的初始扫描 |
| **DeepSeek-reasoner** | 验证器 (Step 2) | 慢 (~5s)、贵 10x、推理强 | 仅处理 Step 1 产出的候选项 |

**成本估算**（100 封邮件）：
- 纯 chat：100 次调用 × $0.001 = $0.10，耗时 ~15s
- chat + reasoner：100 次 chat + ~80 个候选 × reasoner = $0.10 + $0.80 = $0.90，耗时 ~30s
- **生产策略**：默认 chat-only（快），用户可选"深度扫描"触发 reasoner

### 2.5 对比式 Few-shot（最高 ROI 技术）

全球实践证明：**正例 + 近似负例并排** 比单纯给正例效果好 10-15%。

```
EXAMPLE 1 — IS a commitment:
"I'll send you the proposal by Friday"
→ i_promised: "Send proposal by Friday" (confidence: 0.95)

EXAMPLE 1b — NOT a commitment (near miss):
"Thanks for sending the proposal on Friday"
→ Rejected: past tense, already completed (Q3)

EXAMPLE 2 — IS a commitment:
"我下周二前把合同发给你"
→ i_promised: "发送合同" (deadline: 下周二, confidence: 0.95)

EXAMPLE 2b — NOT a commitment (near miss):
"好的我知道了"
→ Rejected: acknowledgment, not a commitment (Q2)
```

---

## 三、短期计划（1-2 周）— 把 Easy 做到极致

### 目标
- Easy 类 F1: 84% → 95%
- 整体 Precision: 58% → 80%
- 负例邮件零误提取率: ? → 95%

### 3.1 修复 Eval 框架的度量问题
- **正例邮件**：额外提取不惩罚（precision 只在负例上算）
- **负例邮件**：任何提取都算 false positive
- 分开报告：正例 recall + 负例 precision
- 这能让我们看清真实的模型能力

### 3.2 Prompt v2：对比式 Few-shot
在 COMMITMENT_EXTRACTION_SYSTEM 中加入 5 组对比示例：
1. 明确承诺 vs 感谢/确认
2. 带 deadline 的承诺 vs 过去时态
3. 请求对方做事 vs 描述政策
4. 中文承诺 vs 中文客套
5. 多承诺邮件 vs 会议议程

### 3.3 修复方向判断
- 在 user message 中明确标注 `[OUTBOUND]` 或 `[INBOUND]`
- Prompt 中加入方向判断规则
- 对 scan endpoint 和 process route 统一添加方向标注

### 3.4 Post-filter 增强
- 提高 confidence threshold: 0.7 → 0.85
- 加入更多中文确认词过滤
- 加入"讨论"/"议程"类关键词过滤

### 3.5 验证
- 跑 210 封 eval，对比 baseline
- 在真实 163 邮箱上测试（已有 50 封真实邮件）
- 记录每轮 eval 的变化，形成 prompt engineering 日志

---

## 四、中期计划（3-4 周）— Two-pass Pipeline

### 目标
- 整体 F1: 80% → 90%
- Precision: 80% → 95%
- 支持"快速扫描"和"深度扫描"两种模式

### 4.1 实现 Step 2 验证器
新建 `lib/ai/commitment-verifier.ts`：

```typescript
interface VerifyInput {
  commitment: ExtractedCommitment
  email_context: { from: string, to: string, subject: string, body: string }
}

interface VerifyResult {
  is_valid: boolean
  adjusted_confidence: number
  adjusted_type?: 'i_promised' | 'waiting_on_them'
  reason: string
}
```

Reasoner prompt 设计（Chain-of-Thought）：
```
Given this email and a candidate commitment extracted from it,
verify whether this is a genuine, trackable commitment.

Think step by step:
1. WHO committed? (Is there a clear actor?)
2. WHAT did they commit to? (Is there a clear deliverable?)
3. IS IT REAL? (Did they actually promise, or just mention/describe?)
4. DIRECTION: Based on From/To, is this i_promised or waiting_on_them?
5. CONFIDENCE: How certain are you? (0-1)

If ANY of steps 1-3 fail, output is_valid: false.
```

### 4.2 快速 vs 深度模式
- **快速模式**（默认）：chat-only，~15s/100封，precision ~85%
- **深度模式**（用户手动触发）：chat + reasoner，~30s/100封，precision ~95%
- Onboarding 首次扫描用快速模式（wow moment 要快）
- 每日定时用深度模式（后台跑，不急）

### 4.3 日历交叉验证
- 提取的 deadline 与 Google Calendar 比对
- "before the board meeting" → 查到 board meeting 日期 → 填入具体 deadline
- 提升 deadline 推断准确率

### 4.4 用户反馈闭环
- 每个承诺卡片加"不是承诺"按钮
- 收集 confirmed / rejected / modified 反馈
- 每周自动算 precision rate
- 反馈数据用于 prompt 迭代

### 4.5 测试数据扩展
- 从真实用户邮件（脱敏后）抽取 100 封加入测试集
- 覆盖：中文商务邮件、新加坡政府邮件、保险行业特定语言
- 总测试集：310+ 封

---

## 五、长期计划（2-3 个月）— 个性化 + 学习

### 目标
- Precision: >97%（接近人工水平）
- 个性化：不同用户有不同的承诺敏感度
- 自进化：系统越用越准

### 5.1 个性化 Prompt
基于用户反馈数据，动态调整 prompt：
- 用户经常确认某类承诺 → 降低该类 threshold
- 用户经常拒绝某类承诺 → 提高该类 threshold
- 用户的 few-shot examples 从自己的历史中来

### 5.2 Fine-tuning（当反馈 >500 条时）
- LoRA fine-tune DeepSeek-chat on 用户的 confirmed/rejected 数据
- 预期 +5-8% F1 over zero-shot
- 或用 DPO：让模型偏好用户确认的输出

### 5.3 多模型交叉验证
- 对高价值承诺（VIP 联系人、大金额、法律截止日期）
- 用 2 个不同模型分别提取，取交集
- Precision 可达 98%+，但成本 2x

### 5.4 关系感知提取
- 结合联系人图谱：VIP 的邮件更严格提取
- 结合历史承诺：如果之前有类似承诺，提高匹配权重
- 结合交互模式：某联系人经常催 → 他的"请帮忙"更可能是真需求

### 5.5 语音 + 图片输入
- WhatsApp 语音消息 → Whisper 转文字 → 承诺提取
- 白板照片 → OCR → 承诺提取
- 会议纪要 → 承诺提取

---

## 六、实验节奏

| 阶段 | 时间 | 关键实验 | 成功标准 |
|------|------|---------|---------|
| **短期 Sprint 1** | 本周 | Prompt v2 (对比式 few-shot) + eval 框架修复 | Easy F1 >95%, 整体 P >80% |
| **短期 Sprint 2** | 下周 | 方向判断修复 + post-filter 增强 | 负例零误提取 >90% |
| **中期 Sprint 3** | W3-4 | Two-pass pipeline (chat + reasoner) | 整体 F1 >85%, P >90% |
| **中期 Sprint 4** | W5-6 | 日历交叉 + 反馈闭环 + 真实邮件测试 | 真实邮件 P >90% |
| **长期 Sprint 5** | M2-3 | 个性化 + fine-tuning + 多模型 | P >97%, 个性化生效 |

---

## 七、DeepSeek-chat vs Reasoner 实验设计

### 7.1 实验目标
量化 reasoner 在哪些场景有显著优势，指导 chat/reasoner 分流策略。

### 7.2 实验方案
用相同的 210 封测试邮件，分别跑：
- **A 组**：deepseek-chat，温度 0.2
- **B 组**：deepseek-reasoner，温度 0
- **C 组**：chat 提取 + reasoner 验证（two-pass）

### 7.3 对比维度
- 整体 P/R/F1
- 分 category 对比（哪些类别 reasoner 显著好？）
- 分 difficulty 对比（hard 类差距多大？）
- 延迟对比（每封平均耗时）
- 成本对比（token 消耗）

### 7.4 预期假设
- Easy 类：chat ≈ reasoner（差距 <3%）
- Hard 类（方向判断、语气歧义）：reasoner > chat（预期差距 10-20%）
- 负例类（policy/agenda）：reasoner 显著好（推理能力更强）
- 成本：reasoner 约 10x chat
- 延迟：reasoner 约 3-5x chat

### 7.5 分流决策树（基于实验结果）

```
邮件进来
   │
   ├── Pre-filter skip? → 不处理
   │
   ├── 快速模式？
   │   └── chat 提取 → confidence >0.9 → 直接展示
   │                 → confidence 0.7-0.9 → 标为"可能"
   │                 → confidence <0.7 → 不展示
   │
   └── 深度模式？
       └── chat 提取 → 每个候选 → reasoner 验证
                       → verified + confidence >0.8 → 展示
                       → not verified → 不展示
```

---

## 八、关键决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| Precision vs Recall 优先 | Precision | 误报伤害信任 5-10x |
| 单模型 vs 双模型 | 双模型（短期单、中期双） | 单模型 precision 天花板 ~85% |
| 中英文分 pipeline vs 合一 | 合一 | 现代 LLM 原生多语言 |
| Fine-tune vs Prompt | 先 prompt（数据不够 fine-tune） | 需 500+ 反馈数据才值得 fine-tune |
| 实时 vs 异步 | 冷启动实时，日常异步 | Wow moment 要快，日常可以后台 |

---

## 九、风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| DeepSeek API 不稳定 | 中 | 高 | 支持多 provider fallback（已有） |
| Reasoner 太慢影响体验 | 高 | 中 | 仅后台深度扫描用，不影响实时 |
| 中文商务语言特殊性 | 高 | 中 | 加入中文对比 few-shot，持续迭代 |
| 用户反馈数据不够 | 中 | 低 | 先用合成测试数据，真实反馈后替换 |
| 竞品（Kinso/Google）追赶 | 中 | 高 | 差异化：WhatsApp 原生 + 家庭层 + 中文优势 |
