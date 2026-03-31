# Sophia 全面测试计划

## 测试层次

```
Layer 1: 单元测试（纯函数，零依赖）     ← 先跑这个
Layer 2: 集成测试（API + Supabase）     ← 再跑这个
Layer 3: 场景测试（多模块组合）          ← 然后这个
Layer 4: QA 测试（用户视角 + UI）       ← 最后这个
```

---

## Layer 1: 单元测试（19 个模块）

### 👂 情绪检测 (emotion/detect.ts)
| # | 输入 | 期望输出 |
|---|------|---------|
| E1 | "好累啊" | tired, confidence > 0.8 |
| E2 | "完了完了全完了" | panicked, confidence > 0.85 |
| E3 | "帮我查一下日程" | calm, confidence 0 |
| E4 | "太好了搞定了" | happy, confidence > 0.7 |
| E5 | "气死了这什么玩意" | angry, confidence > 0.8 |
| E6 | "紧急！！！马上！" | anxious, confidence > 0.7 |
| E7 | "URGENT!!!" (ALL CAPS) | angry or anxious |
| E8 | "ok" (very short) | stressed, low confidence |
| E9 | 凌晨 3 点发 "帮我查邮件" | tired (time signal) |
| E10 | formatEmotionContext(calm) | 空字符串 |
| E11 | formatEmotionContext(panicked) | 包含 "reassurance" |

### 🧠 情景记忆 (memory/episodic-memory.ts)
| # | 操作 | 期望 |
|---|------|------|
| M1 | saveMemory → recallMemories | 能存能取 |
| M2 | recall by contactId | 只返回该联系人的记忆 |
| M3 | recall by keywords | 关键词匹配 |
| M4 | recall 空库 | 返回空数组 |
| M5 | formatMemoriesForPrompt([]) | 空字符串 |
| M6 | formatMemoriesForPrompt([memory]) | 包含 📌 |
| M7 | recordCommitmentCompletion (on time) | importance < 5 |
| M8 | recordCommitmentCompletion (late) | importance > 5 |

### 🧠 工作记忆 (memory/working-memory.ts)
| # | 操作 | 期望 |
|---|------|------|
| W1 | getSession (无 session) | null |
| W2 | updateSession → getSession | 返回 summary |
| W3 | getSession (24h 后) | null (过期) |
| W4 | formatSessionContext(null) | 空字符串 |
| W5 | formatSessionContext(session) | 包含 PREVIOUS_CONTEXT |

### 🧠 行为模型 (memory/behavior-model.ts)
| # | 操作 | 期望 |
|---|------|------|
| B1 | analyzeBehavior (有数据) | 返回 peak_hours + delay |
| B2 | analyzeBehavior (无数据) | 返回空 profile |
| B3 | formatBehaviorForPrompt (< 10 data points) | 空字符串 |
| B4 | formatBehaviorForPrompt (有数据) | 包含 peak hours |

### 🫀 心 (heart/intervention.ts)
| # | 条件 | 期望干预 |
|---|------|---------|
| H1 | 10+ active + rate < 60% | burnout_warning |
| H2 | VIP 14 天没联系 | relationship_cooling |
| H3 | 凌晨 3 点 + 有消息 | health_protection |
| H4 | 家庭 hard constraint 冲突 | family_protection |
| H5 | 3+ 取消今天 | decision_anomaly |
| H6 | 2+ 压力消息 + 紧急任务 | emotional_protection |
| H7 | 已发 2 条今天 | 不再发（rate limit）|

### 👀 眼 (alerts/detect.ts)
| # | 信号类型 | 条件 |
|---|---------|------|
| A1 | calendar_conflict | 两个会议时间重叠 |
| A2 | transit_impossible | 15 分钟换地点 |
| A3 | meeting_fatigue | 3+ 连续会议 |
| A4 | overdue_reply | 邮件 > 24h 未回 |
| A5 | overdue_commitment | 承诺逾期 |
| A6 | stale_urgent_task | P1 任务 > 48h |
| A7 | commitment_chain_break | 描述含"依赖" |
| A8 | pre_trip_unfinished | 出差前有逾期 |
| A9 | vip_silence | VIP 14 天无互动 |
| A10 | email_tone_shift | VIP 2+ 冷邮件 |

### 分层 Context (context.ts)
| # | 消息 | 应加载的 context |
|---|------|----------------|
| C1 | "今天有什么会" | schedule (events + tasks) |
| C2 | "Lisa 怎么样" | person (contacts) |
| C3 | "有什么逾期的" | commitment |
| C4 | "下周出差" | trip + family |
| C5 | "好累" | commitment (emotional) |
| C6 | "帮我回邮件" | email |
| C7 | "你好" | general (all core) |

---

## Layer 2: 集成测试（API 端到端）

### 日历 API
| # | 测试 | 方法 |
|---|------|------|
| CA1 | /api/calendar/unified 返回 4 层 | GET + 验证 layer 字段 |
| CA2 | 家庭 recurring 展开 | 验证周三的 weekly 事件出现 |
| CA3 | 冲突检测 | 同时有 work + family → is_conflict=true |
| CA4 | /api/calendar/suggest-time | 验证返回空闲 slot |
| CA5 | 创建事件 + 家庭冲突警告 | POST event 在 Emily 钢琴课时间 |

### 承诺 API
| # | 测试 |
|---|------|
| CM1 | /api/commitments/graph 返回 nodes + edges |
| CM2 | /api/commitments/stats compliance_rate = null 当无数据 |
| CM3 | /api/export 返回 JSON + 正确 headers |
| CM4 | /api/account DELETE 需要认证 |

### Chat API
| # | 测试 |
|---|------|
| CH1 | 简单问题不触发工具 → 正常回复 |
| CH2 | "有什么逾期的" → 找到承诺 |
| CH3 | "好累" → 情绪检测 + 克制回复 |
| CH4 | 长中文输入 + 空搜索结果 → 不返回空 |
| CH5 | 工作记忆：连续两条消息有上下文 |

### Briefing API
| # | 测试 |
|---|------|
| BR1 | /api/briefing?refresh=1 → 返回 briefing |
| BR2 | overdue 承诺排在最前 |
| BR3 | 包含 Sophia's Memory 数据 |

---

## Layer 3: 场景测试（30+ 极端场景）

### 核心 5 件事同时发生
| # | 场景 | 测试点 |
|---|------|--------|
| S1 | 东京三重冲突（女儿+投资人+宕机） | 判断力：家人优先 |
| S2 | Pitch 前恐慌 | 情商：先稳情绪 |
| S3 | 中国 SOE 晚宴（送钟） | 文化知识：阻止 |
| S4 | 春节前 5 线崩溃 | 多线程拆解 |
| S5 | 凌晨 5 个坏消息 | 情绪+判断力 |

### 出差场景
| S6 | 航班取消连锁 | 应变+重排 |
| S7 | 签证被扣 | 紧急方案 |
| S8 | 7 国 7 币种报销 | 费用复杂度 |

### 家庭场景
| S9 | 保姆辞职 + 融资路演 | 家庭优先 |
| S10 | 孩子辅导班 + 出差冲突 | 硬约束检测 |
| S11 | 老婆生日 + 投资人晚餐同天 | 优先级 |

### 情绪/健康
| S12 | 倦怠悬崖（2 周数据异常） | 主动干预 |
| S13 | 丧亲后失控决策 | 模式识别 |
| S14 | 异国生病 | 紧急方案 |

### 跨文化
| S15 | 日本道歉协议 | 文化知识 |
| S16 | 中东斋月排程 | 时区+文化 |
| S17 | 印度付款迷宫 | 合规知识 |

### 多账号/安全
| S18 | 数据隔离 | ✅ 已测（18/18） |
| S19 | FK 约束 | ✅ 已测 |
| S20 | 注册→删除→重注册 | 需要手动测 |

### Sophia 记忆/学习
| S21 | 完成承诺 → 下次提到记得 | 情景记忆 |
| S22 | 连续对话保持上下文 | 工作记忆 |
| S23 | 行为模式识别 | 行为模型 |

### 日历
| S24 | 4 层叠加显示 | UI 验证 |
| S25 | 创建事件触发家庭冲突 | 硬约束 |
| S26 | 找空闲时间 | 智能排程 |
| S27 | 出差期间双时区 | 时区显示 |

---

## 执行顺序

```
Phase 1: 单元测试（纯代码，不需要浏览器）
  → 自动化脚本，立刻跑
  → 发现 bug 立刻修

Phase 2: 集成测试（API 调用）
  → 用 Supabase admin 直接调 API
  → 需要 cookie 才能测 auth-required 的

Phase 3: 场景测试（Chat 对话）
  → 需要浏览器 cookie
  → 逐场景发消息，记录回复

Phase 4: QA（全站浏览器测试）
  → 需要浏览器 cookie
  → 截图 + 报告
```
