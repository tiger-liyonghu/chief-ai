# Chief 本体模型
## v1.0 | 2026-03-30

---

## 一、设计原则

1. 所有能力共享一个图谱，不再各查各表
2. 实体少而精，关系丰富
3. 支持传递推理（A认识B，B认识C → A可通过B触达C）
4. 新增关系类型不改代码，只加定义
5. 32个工具变成图谱的读写接口

---

## 二、核心实体 (6个)

```
Person          人（自己、家人、联系人、客户高管）
Organization    组织（客户公司、合作伙伴、竞争对手、自己公司）
Commitment      承诺（答应的事、欠的人情、投资的关系）
Context         场景（会议、出差、家庭事件、节日）
Deal            交易（业务pipeline中的机会）
Market          市场（行业、趋势、监管）
```

---

## 三、实体属性

### Person (人)

```
id              UUID
name            名字
alias           别名/昵称（"张总"、"Ah Ming"）
email           邮箱（可多个）
phone           电话（可多个）
avatar          头像

-- 分类
person_type     self / family / contact / lead
role_type       founder / ceo / cfo / vp / director / manager / assistant / other

-- 关系属性
importance      vip / high / normal / low
trust_level     new / building / established / deep
warmth          hot / warm / cool / cold（关系温度，系统计算）

-- 沟通特征
language        en / zh / ms / mixed
register        formal / casual / singlish / mixed（沟通语域）
response_style  fast / normal / slow（对方典型回复速度）
followthrough   0.0-1.0（承诺兑现率，系统积累）

-- 个人信息
birthday        生日
dietary         饮食偏好（不吃海鲜、清真、素食）
hobbies         爱好（高尔夫、跑步、威士忌）
notes           自由备注

-- 来源
source          email / whatsapp / namecard / manual / linkedin
first_met       何时认识
first_met_via   谁介绍的 → Person.id
```

### Organization (组织)

```
id              UUID
name            公司名
alias           简称（"CIMB"、"淡马锡"）
industry        行业
size            startup / sme / enterprise / mnc / government
hq_city         总部城市
hq_country      总部国家
website         官网
status          active / acquired / closed

-- 业务信息
annual_revenue  年营收范围
employee_count  员工数范围
fiscal_year     财年结束月
key_products    主要产品/业务

-- 动态信息
recent_news     近期新闻摘要（系统更新）
news_updated_at 新闻更新时间
stock_ticker    股票代码（如有）
```

### Commitment (承诺)

```
id              UUID
title           承诺内容
description     详细说明

-- 分类
commitment_type deliverable / meeting / favor / introduction / family_promise / investment
direction       i_promised / they_promised / mutual

-- 状态
status          pending / in_progress / waiting / done / overdue / cancelled
confidence      confirmed / likely / tentative / unlikely
urgency         critical / high / medium / low
urgency_score   0-10（系统计算）

-- 时间
deadline        截止日期
deadline_fuzzy  模糊截止（"下周"、"Q2前"）
created_at      创建时间
completed_at    完成时间

-- 来源
source_type     email / whatsapp / voice / calendar / manual
source_ref      来源ID

-- 价值评估
relationship_impact   高管承诺对关系的影响程度
business_impact       对deal/pipeline的影响
```

### Context (场景)

```
id              UUID
title           场景名称

-- 分类
context_type    meeting / trip / family_event / holiday / work_block / deadline

-- 时间
start_time      开始时间
end_time        结束时间
all_day         是否全天
timezone        时区
recurrence      重复规则（weekly/monthly/yearly）
recurrence_day  重复的星期几

-- 地点
city            城市
country         国家
venue           具体地点
address         地址

-- 元信息
metadata        JSON（航班号、酒店确认号、会议链接等）
status          planned / confirmed / active / completed / cancelled
```

### Deal (交易)

```
id              UUID
name            交易名称
description     描述

-- pipeline
stage           prospect / qualification / proposal / negotiation / closing / won / lost
probability     成交概率 0-100
value           预估金额
currency        币种

-- 时间
expected_close  预计成交日期
created_at      创建时间
closed_at       实际成交时间

-- 状态
status          active / won / lost / stalled / abandoned
stall_reason    停滞原因
loss_reason     丢单原因
```

### Market (市场)

```
id              UUID
name            市场/行业名

-- 分类
market_type     industry / segment / geography / regulation

-- 信息
description     描述
trends          趋势摘要（系统更新）
regulations     监管动态
competitors     竞争格局
updated_at      更新时间
```

---

## 四、关系定义 (Relations)

关系是本体的核心。所有关系存在一张统一的 relations 表：

```
id              UUID
from_entity     来源实体ID
from_type       来源实体类型（person/organization/commitment/context/deal/market）
relation        关系类型（见下表）
to_entity       目标实体ID
to_type         目标实体类型
properties      JSON（关系附加属性）
confidence      关系置信度 0-1
source          关系来源（email/whatsapp/manual/inferred）
created_at      创建时间
updated_at      更新时间
```

### Person to Person (人与人)

```
关系                  说明                              示例
introduced_by         谁介绍的                          张总 introduced_by 李明
reports_to            汇报关系                          Sarah reports_to Jason
spouse_of             配偶                              Sarah spouse_of Jason
parent_of             父母-子女                         Jason parent_of Emily
colleague_of          同事                              Sarah colleague_of Jason
classmate_of          校友                              张总 classmate_of 王总
mentor_of             导师                              Ben mentor_of Jason
competes_with         竞争关系                          XX competes_with Jason
```

### Person to Organization (人与组织)

```
关系                  说明                              示例
works_at              在职                              张总 works_at CIMB
                      properties: {role, department, since}
formerly_at           曾在职                            张总 formerly_at Goldman
                      properties: {role, from, to}
founded               创立                              Jason founded FinPay
invested_in           投资了                            Ben invested_in FinPay
advises               顾问                              王总 advises FinPay
board_member_of       董事会成员                        Ben board_member_of FinPay
decision_maker_at     决策人                            王总 decision_maker_at CIMB
influencer_at         影响者（非决策但有影响力）          张总 influencer_at CIMB
```

### Person to Commitment (人与承诺)

```
关系                  说明                              示例
promised_to           我承诺给对方                      Jason promised_to 张总: 合同修改版
promised_by           对方承诺给我                      李明 promised_by Jason: CFO引荐
owes_favor            欠人情                            Jason owes_favor 王总（上次帮了忙）
invested_in_rel       关系投资（没有直接回报的付出）      Jason invested_in_rel 李明
```

### Person to Context (人与场景)

```
关系                  说明                              示例
attends               参加                              张总 attends 4/3会议
hosts                 主持                              Jason hosts Team Sync
travels_to            出差去                            Jason travels_to KL出差
family_event          家庭事件                          Emily family_event 钢琴课
```

### Person to Deal (人与交易)

```
关系                  说明                              示例
champion_of           deal的内部支持者                  张总 champion_of CIMB合作
blocker_of            deal的阻碍者                      法务总监 blocker_of CIMB合作
decision_maker_of     deal的最终决策人                  王总 decision_maker_of CIMB合作
influencer_of         deal的影响者                      张总 influencer_of CIMB合作
```

### Organization to Organization (组织与组织)

```
关系                  说明                              示例
partner_of            合作伙伴                          FinPay partner_of Grab
competitor_of         竞争对手                          FinPay competitor_of XX
subsidiary_of         子公司                            GrabPay subsidiary_of Grab
client_of             客户关系                          CIMB client_of FinPay
vendor_of             供应商                            AWS vendor_of FinPay
```

### Organization to Market (组织与市场)

```
关系                  说明                              示例
operates_in           在某个市场运营                    CIMB operates_in SEA Banking
regulated_by          受监管                            CIMB regulated_by MAS
```

### Deal to Commitment (交易与承诺)

```
关系                  说明                              示例
depends_on            deal依赖某个承诺                  CIMB合作 depends_on 合同修改版
blocked_by            deal被某个承诺阻塞                CIMB合作 blocked_by 法务审批
advanced_by           某个承诺推进了deal                CIMB合作 advanced_by CFO引荐
```

### Deal to Context (交易与场景)

```
关系                  说明                              示例
discussed_at          在某场景讨论                      CIMB合作 discussed_at 4/3会议
target_event          deal的目标事件                    CIMB合作 target_event Q2签约
```

### Context to Context (场景与场景)

```
关系                  说明                              示例
part_of               属于                              4/3会议 part_of KL出差
conflicts_with        冲突                              4/3会议 conflicts_with Emily钢琴课
precedes              先后关系                          4/3 CIMB会 precedes 4/3 Maybank会
```

### Commitment to Commitment (承诺与承诺)

```
关系                  说明                              示例
blocks                阻塞                              合同修改版 blocks NDA签字
depends_on            依赖                              demo准备 depends_on 数据ready
replaces              替代                              新方案 replaces 旧方案
```

---

## 五、关系总数

```
Person-Person:        8种
Person-Organization:  8种
Person-Commitment:    4种
Person-Context:       4种
Person-Deal:          4种
Org-Org:              5种
Org-Market:           2种
Deal-Commitment:      3种
Deal-Context:         2种
Context-Context:      3种
Commitment-Commitment:3种
                      ──────
                      46种关系
```

---

## 六、传递推理

本体的核心价值：通过关系链推理出间接信息

### 推理规则

```
规则1: 可触达路径
  A introduced_by B, B works_at Org
  → A可通过B触达Org的其他人

规则2: Deal影响链
  Commitment.status=overdue, Deal depends_on Commitment
  → Deal处于风险状态

规则3: 家庭冲突传递
  Context1(出差) overlaps Context2(家庭事件)
  → 冲突预警

规则4: 关系温度衰减
  Person.last_interaction > 90天, Person.importance=vip
  → 关系冷却预警

规则5: 人脉二度连接
  我 knows A, A knows B, 我想触达B
  → 建议通过A引荐

规则6: 组织内部路径
  张总 works_at CIMB, 王总 works_at CIMB, 王总 decision_maker_of Deal
  → 见张总时可以请他引荐王总
```

---

## 七、数据库实现

### 表结构

```sql
-- 6个实体表
persons (...)
organizations (...)
commitments (...)      -- 已有，扩展
contexts (...)         -- 合并calendar_events + trips + family_calendar
deals (...)            -- 新增
markets (...)          -- 新增

-- 1个统一关系表
relations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  from_entity UUID NOT NULL,
  from_type TEXT NOT NULL,  -- person/org/commitment/context/deal/market
  relation TEXT NOT NULL,   -- introduced_by/works_at/promised_to/...
  to_entity UUID NOT NULL,
  to_type TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  confidence NUMERIC(3,2) DEFAULT 1.0,
  source TEXT DEFAULT 'manual',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

-- 关系类型定义表（元数据，不存数据）
relation_types (
  id TEXT PRIMARY KEY,       -- introduced_by
  from_type TEXT NOT NULL,   -- person
  to_type TEXT NOT NULL,     -- person
  label TEXT NOT NULL,       -- "introduced by"
  label_zh TEXT,             -- "由...介绍"
  is_symmetric BOOLEAN DEFAULT false,  -- colleague_of是对称的
  is_transitive BOOLEAN DEFAULT false, -- part_of是传递的
  inverse TEXT               -- introduced_by的反向是introduced
)
```

### Context Resolution 查询

```sql
-- "帮我准备明天见张总的资料" → 一次查询
WITH target_person AS (
  SELECT id FROM persons WHERE name ILIKE '%张%' AND user_id = $1
),
related AS (
  SELECT r.relation, r.to_entity, r.to_type, r.properties
  FROM relations r
  WHERE r.from_entity IN (SELECT id FROM target_person)
    AND r.is_active = true
  UNION ALL
  SELECT r.relation, r.from_entity, r.from_type, r.properties
  FROM relations r
  WHERE r.to_entity IN (SELECT id FROM target_person)
    AND r.is_active = true
)
SELECT * FROM related;

-- 返回张总的所有关联：
-- promised_to: 合同修改版
-- works_at: CIMB (含role, department)
-- introduced_by: 李明
-- attends: 明天10:00会议
-- champion_of: CIMB合作deal
-- taste: 不吃海鲜（在persons表）
-- CIMB recent_news（通过works_at关联到organization）
```

---

## 八、与32个工具的关系

```
工具层（32个工具，保留）
  ↕ 读写
本体层（6实体 + 46关系 + 推理规则）
  ↕ 存储
数据层（Supabase，现有表 + relations表 + deals表 + markets表）
```

工具变化：
- 现有工具不删，改为通过本体层读写
- 新增1个核心工具：resolve_context（替代4-5轮调用）
- 新增客户管理工具：query_deal, update_deal, query_org

### 工具映射

```
现有工具                    本体层操作
get_today_calendar    →    query contexts WHERE type=meeting AND date=today
                           + resolve related persons + commitments
get_pending_emails    →    query commitments WHERE source=email AND status=pending
get_follow_ups        →    query commitments WHERE direction=they_promised
create_task           →    create commitment + create relation(person, commitment)
get_contact_info      →    query person + resolve all relations
update_taste          →    update person.dietary/hobbies
get_trip_info         →    query context WHERE type=trip + resolve timeline
recommend_restaurant  →    query person.dietary + context.city

新增工具
resolve_context       →    给定任何实体，遍历所有关联，返回完整上下文包
query_deal            →    查询deal pipeline + 关联的人和承诺
query_org             →    查询组织信息 + 关联的人和deal
relationship_map      →    查询某人的关系网络（1度和2度）
```

---

## 九、实施路径

```
第1步: 建relations表 + relation_types表（1天）
  不动现有表，新增关系层

第2步: 建resolve_context函数（2天）
  给定实体ID → 遍历relations → 返回完整上下文JSON
  替代4-5轮工具调用

第3步: 改造现有工具（3天）
  让工具通过resolve_context获取上下文
  而不是各自查各自的表

第4步: 新增deals表 + markets表（1天）
  客户管理的数据基础

第5步: 新增客户管理工具（2天）
  query_deal, update_deal, query_org, relationship_map

第6步: 建关系自动发现（持续）
  从邮件中自动发现人与人、人与组织的关系
  从日历中自动发现人与场景的关系
  从承诺中自动发现承诺与deal的关系
```
