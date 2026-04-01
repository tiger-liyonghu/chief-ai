# Sophie 联系人本体模型 — 个人客户知识图谱

## 2026-04-01 | v0.1 — 设计草案

---

## 设计原则

1. **多源融合** — 通讯录、邮件、WhatsApp、日历、LinkedIn、名片 → 同一个 Person
2. **渐进丰富** — 初次只有 email/phone，随着交互逐步补全 profile
3. **关系是核心** — 不只存"谁"，更存"谁跟谁什么关系"、"最后什么时候联系"、"答应了什么"
4. **记忆不丢失** — 每个联系人的偏好、送礼记录、饮食禁忌、子女信息，跨 trip/meeting 复用
5. **Signal 驱动** — 所有信息从 Signal（邮件/消息）自动提取，不需要人工录入

---

## 一、Person（个人 — 核心实体）

现有 `contacts` 表的扩展，成为完整的个人档案。

```
Person / Contact
  │
  ├── 基本信息（多源融合）
  │     name                "Yamamoto Kenji"
  │     name_zh             "山本健二"（如有）
  │     aliases             ["Yamamoto-san", "Ken"]（别名/昵称）
  │     email               "kenji.yamamoto@dbs.com"（主邮箱）
  │     emails              ["kenji.yamamoto@dbs.com", "ken.y@gmail.com"]
  │     phone               "+81-90-xxxx-xxxx"
  │     phones              ["+81-90-xxxx", "+81-3-xxxx"]
  │     linkedin_url        "linkedin.com/in/kenyamamoto"
  │     wechat_id           "ken_yamamoto_tokyo"
  │     whatsapp            "+81-90-xxxx-xxxx"
  │     avatar_url          "https://..."
  │
  ├── 职业信息
  │     current_title       "VP Digital Banking"
  │     current_company     "DBS Bank"
  │     company_profile_id  → CompanyProfile
  │     department          "Digital Innovation"
  │     seniority           c_suite / vp / director / manager / ic / assistant
  │     career_history      [
  │                           { company: "DBS", title: "VP", from: "2023", to: null },
  │                           { company: "OCBC", title: "Director", from: "2019", to: "2023" }
  │                         ]
  │     education           [{ school: "NUS", degree: "MBA", year: "2015" }]
  │     skills              ["digital banking", "API strategy", "insurtech"]
  │
  ├── 关系分类
  │     relationship        client / investor / partner / vendor / boss / team /
  │                         board_member / advisor / personal / family / other
  │     importance          vip / high / normal / low
  │     warmth              hot / warm / cool / cold（系统计算：基于互动频率+回复速度）
  │     trust_level         new / building / established / deep
  │
  ├── 互动统计（系统自动计算）
  │     total_interactions   156
  │     email_count          120
  │     whatsapp_count       30
  │     meeting_count        6
  │     last_contact_at      "2026-03-28"
  │     last_contact_channel "email"
  │     avg_response_time    "4.2h"（对方平均回复速度）
  │     interaction_trend    increasing / stable / decreasing / dormant
  │     first_contact_at     "2024-06-15"
  │
  ├── 承诺追踪
  │     active_commitments   3（对方未兑现）
  │     my_commitments       1（我对他的未兑现）
  │     followthrough_rate   0.85（承诺兑现率，系统积累）
  │
  ├── 个人偏好（跨 trip/meeting 复用）
  │     language             en / zh / ja / mixed
  │     communication_style  formal / casual / mixed
  │     timezone             "Asia/Tokyo"
  │     dietary              "no shellfish"
  │     alcohol              "清酒，不劝酒"
  │     hobbies              ["golf", "sake tasting", "jazz"]
  │     birthday             "1978-03-15"
  │     spouse_name          "Yamamoto Yuki"
  │     children             [{ name: "Hana", age: 12 }]
  │     pet_peeves           "不喜欢迟到"
  │
  ├── 送礼记录
  │     gift_history         [
  │                           { date: "2026-01", item: "TWG 茶礼盒", occasion: "New Year", reaction: "很喜欢" },
  │                           { date: "2025-09", item: "小CK钱包", occasion: "birthday", reaction: null }
  │                         ]
  │     gift_notes           "喜欢茶；不收太贵重的东西"
  │
  ├── 名片信息（OCR 提取）
  │     business_card_image  "cards/yamamoto-kenji-2026.jpg"
  │     card_scanned_at      "2026-04-16"
  │     card_raw_text        "Yamamoto Kenji | VP Digital Banking | DBS Bank..."
  │
  ├── 会面记录（自动从 Meeting 聚合）
  │     meetings_history     [
  │                           { date: "2026-04-16", city: "Tokyo", topic: "Pilot project review" },
  │                           { date: "2026-01-10", city: "Singapore", topic: "Initial partnership discussion" }
  │                         ]
  │     last_met_in_person   "2026-04-16, Tokyo"
  │     next_meeting         → trip_meetings.id
  │
  └── 数据来源追踪
        sources             ["email_auto", "linkedin", "business_card", "manual"]
        enriched_at          最后一次数据丰富时间
        enrichment_source   "linkedin" / "email_signature" / "manual" / "business_card"
```

---

## 二、Person 的 EA/助理信息

重要联系人的助理信息，Sophie 需要知道跟谁沟通安排事务。

```
AssistantInfo
  ├── contact_id         → Person（这个助理服务的高管）
  │
  ├── assistant_name     "Sato Yuki"
  │   assistant_email    "yuki.sato@dbs.com"
  │   assistant_phone    "+81-3-xxxx-xxxx"
  │   assistant_role     "Executive Assistant"
  │
  └── notes              "排会议找 Sato-san；直接找 Yamamoto-san 只在紧急时"
```

---

## 三、互动时间线（Interaction Timeline）

每次跟联系人的互动，不分渠道聚合。

```
Interaction（从 Signal 自动生成）
  ├── contact_id         → Person
  │
  ├── channel            email / whatsapp / meeting / call / linkedin / wechat
  │   direction          inbound / outbound / mutual（会议）
  │   timestamp          "2026-03-28T14:30:00"
  │   signal_id          → Signal（来源信号）
  │
  ├── summary            "讨论了 Q2 pilot 的时间表，他们需要先拿内部审批"
  │   sentiment          positive / neutral / negative
  │   topics             ["pilot timeline", "internal approval"]
  │
  └── commitments        → Commitment[]（这次互动产生的承诺）
```

---

## 四、关系图谱（Relationship Graph）

人与人之间的关系，不只是"我认识谁"，更是"谁认识谁"。

```
Relationship
  ├── from_person_id     → Person
  │   to_person_id       → Person
  │
  ├── type               colleague / manager / reports_to / spouse /
  │                      referred_by / introduced_by / classmate / friend
  │
  ├── context            "DBS Digital Banking 同事"
  │   since              "2023"
  │   strength           strong / moderate / weak
  │
  └── 传递价值
        intro_potential   true/false（"Yamamoto 能帮我介绍 DBS CEO"）
        intro_notes       "通过 Yamamoto 可以触达 DBS C-suite"
```

---

## 五、联系人丰富策略（Enrichment Pipeline）

Sophie 如何从各个来源自动丰富联系人档案。

### 5.1 邮件签名提取

```
邮件签名 → AI 提取：
  - 姓名、职位、公司
  - 电话号码
  - LinkedIn URL
  - 办公地址
  - 公司 logo（图片签名）
```

### 5.2 名片 OCR

```
名片照片 → OCR + AI 结构化：
  - 双面扫描（中英文）
  - 提取所有字段
  - 自动匹配已有联系人（email/phone dedup）
  - 无匹配则创建新联系人
```

### 5.3 LinkedIn 信息（手动触发）

```
LinkedIn URL → Enrichment API / 手动输入：
  - 当前职位 + 公司
  - 职业历史
  - 教育背景
  - 技能标签
  - 共同联系人
```

### 5.4 交互模式分析（Sophie 自动计算）

```
每周自动计算：
  - warmth score（互动频率 + 回复速度 + 主动联系比例）
  - interaction_trend（近30天 vs 前90天）
  - followthrough_rate（承诺兑现率）
  - 关系健康度预警："30天未联系 Yamamoto-san，上次约了Q2 follow-up"
```

---

## 六、与现有本体的关系

```
Person（联系人）
  │
  ├── Signal（邮件/WhatsApp）──→ Interaction Timeline
  │
  ├── Commitment（承诺）←──→ 追踪谁答应了谁什么
  │
  ├── Trip → Meeting/Dinner ──→ 出差时见过谁、聊了什么
  │
  ├── Topic ──→ 跟这个人讨论中的事项
  │
  └── CompanyProfile ──→ 这个人所在的公司
```

---

## 七、实施优先级

| 阶段 | 内容 | 价值 |
|------|------|------|
| **P0** | 扩展 contacts 表：career_history, seniority, dietary, hobbies, linkedin_url, wechat_id, gift_history | 基础个人档案 |
| **P1** | 邮件签名提取 pipeline | 自动丰富，零人工 |
| **P2** | 互动统计自动计算 | warmth, trend, followthrough_rate |
| **P3** | 名片 OCR → 联系人创建 | 论坛/会议后快速录入 |
| **P4** | 关系图谱（Person-Person） | 传递推荐，"通过A可以认识B" |
| **P5** | LinkedIn enrichment | 职业历史，共同联系人 |

---

## 八、数据隐私

- 所有联系人数据 per-user 隔离（RLS）
- 不存储第三方密码（LinkedIn 等）
- 名片图片可选存储到 Supabase Storage
- gift_history, dietary, hobbies 等个人信息不对外暴露
- 用户可删除任何联系人及其全部关联数据
