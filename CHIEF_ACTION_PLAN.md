# Chief AI — 最终行动方案
## 基于五方专家研讨结论

**日期**: 2026-03-27
**专家**: 麦肯锡顾问 × 商务出差用户 × 系统架构师 × PM 专家 × OpenClaw 内部人

---

## 核心共识

> **1. 聚焦。PRD 70% 应该删掉。每季度只做一件"哇"的事。**
> **2. Chief ≠ 更好的 OpenClaw。做 OpenClaw 永远不做的事。**
> **3. 真正的对手不是 OpenClaw，是"不用任何工具"的惯性。**

---

## 定位

**Chief 是商务旅行者的 AI 幕僚长。**
- OpenClaw = 开发者的 Linux（管道层）
- Chief = CEO 的幕僚（决策层）
- 两者不重叠，不竞争

---

## Q1 目标（4-6月）：让 50 人爱上 Daily Briefing

| 周 | 做什么 | 不做什么 |
|----|--------|---------|
| 1-2 | 部署到线上 + Daily Briefing 邮件推送 + 浏览器通知 | 不加新功能 |
| 3-4 | 邮件能真发 + 搜索可用 + 出差端到端 | 不做 WhatsApp |
| 5-6 | 招 10 个 SG 创始人 beta + 修 bug | 不做团队版 |
| 7-8 | Product Hunt + 收费 $15/月 | 不做餐厅推荐 |

## Q2（7-9月）：出差功能上线

- 起飞前必回（自动推送）
- 落地简报（自动推送）
- 会议准备卡（自动准备）
- Product Hunt 正式发布

## Q3（10-12月）：WhatsApp + 联系人图谱

- WhatsApp 只读集成
- 跨渠道联系人关联
- 付费转化（Reverse Trial）

## Q4（1-3月2027）：变现

- 出差报告
- Slack 集成
- 团队版 beta
- ARR $10K+/月

---

## 永远不做

| 功能 | 原因 |
|------|------|
| 比拼消息平台数量 | OpenClaw 50+ 渠道，追不上 |
| 自主代理/Shell 执行 | 不是 Chief 的战场 |
| 餐厅推荐（深度版） | Google Maps 做得更好 |
| 微信集成 | 技术太复杂，ICP 不在中国 |
| 自建 AI 模型 | $10M+ 投资 |
| 企业版 SSO | 100 个付费用户之前不碰 |

---

## 关键数字

| 指标 | 目标 |
|------|------|
| 盈亏平衡付费用户 | 50-80 人 × $15/月 |
| Year 1 目标 ARR | $50-100K |
| Day 7 留存 | > 30% |
| AI 草稿采纳率 | > 40% |
| 北极星指标 | 每周打开 Daily Briefing 的用户比例 |

---

## 架构紧急修复

1. ✅ Chat route 重复代码（已由 WhatsApp AI agent 修复）
2. 🔄 Function Calling 替代文本标记
3. 🔄 Vercel 部署修复
4. 待做：AI 上下文 Redis 缓存
5. 待做：WhatsApp 独立部署（长连接服务器）
6. 待做：Gmail 推送通知替代轮询

---

## 安全修复（已完成）

- ✅ /api/ai/draft-reply 加鉴权
- ✅ FORWARD_EMAIL 需要用户确认
- ✅ google_accounts RLS 改为 USING(false)
