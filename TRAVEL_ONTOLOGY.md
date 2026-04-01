# Sophie 商旅本体模型

## 2026-04-01 | v0.1 — 设计草案

---

## 设计原则

1. **层层递进** — 从 Trip → Occasion → 细节，每一层都有独立价值
2. **记忆驱动** — 每个细节都可以积累偏好（"Tiger 喜欢靠窗"），越用越懂
3. **Signal 驱动** — 所有数据从邮件/WhatsApp/日历自动提取，不需要人工录入
4. **承诺打通** — 每个环节产生的承诺自动进入承诺追踪

---

## 一、Trip（一次出差）

顶层容器，一次出差 = 一个 Trip。

```
Trip
  ├── 基本信息
  │     title           "东京客户拜访 + InsurTech 论坛"
  │     purpose         client_visit / conference / internal / mixed
  │     status          planning → confirmed → active → completed → archived
  │     departure_date  2026-04-15
  │     return_date     2026-04-18
  │     cities          ["Tokyo", "Osaka"]
  │
  ├── 关联
  │     topic_id        → 关联 Topic（跨渠道聚合这次出差的所有 Signal）
  │     commitments     → 出发前准备 + 回来后跟进
  │     travelers       → 同行人
  │
  └── 元数据
        budget          预算
        trip_report     出差总结（AI 生成）
        roi_notes       成果评估
```

---

## 二、Leg（物流环节）

一次出差由多个物流环节组成，按时间排列。

### 2.1 Flight（航班）

```
Flight
  ├── 基本
  │     airline         "Singapore Airlines"
  │     flight_number   "SQ638"
  │     route           SIN → NRT
  │     departure_at    2026-04-15T08:30+08:00
  │     arrival_at      2026-04-15T16:45+09:00
  │     terminal        T3 / T1
  │     booking_ref     "ABC123"
  │     ticket_number   "6185432198765"
  │     status          booked → checked_in → boarded → completed
  │
  ├── 座位偏好（记忆）
  │     seat_number     "12A"
  │     seat_pref       window / aisle / bulkhead
  │     cabin_class     economy / premium_economy / business / first
  │     meal_pref       regular / vegetarian / halal / hindu / kosher
  │
  ├── 常旅客
  │     ff_program      "KrisFlyer"
  │     ff_number       "8829xxxxxx"
  │     status_level    gold / silver / pvp
  │
  ├── 机场服务
  │     lounge_access   "SilverKris Lounge T3"
  │     lounge_method   status / priority_pass / credit_card
  │     fast_track      true/false
  │     transfer_time   中转时间（如有）
  │
  └── 注意事项
        visa_required   true/false
        checkin_opens   出发前 48h
        baggage_allow   "30kg checked + 7kg carry-on"
        boarding_pass   URL / 已下载
```

### 2.2 Hotel（酒店）

```
Hotel
  ├── 基本
  │     name            "Hotel Gracery Shinjuku"
  │     address         "1-19-1 Kabukicho, Shinjuku"
  │     checkin_at      2026-04-15T15:00
  │     checkout_at     2026-04-18T12:00
  │     booking_ref     "HTL-9876"
  │     booking_source  direct / booking.com / corporate
  │     status          booked → checked_in → checked_out
  │
  ├── 房间偏好（记忆）
  │     room_type       standard / deluxe / suite / executive
  │     floor_pref      high_floor / low_floor / specific
  │     bed_pref        king / twin
  │     view_pref       city_view / quiet_side
  │     smoking         non_smoking
  │     pillow_pref     soft / firm（有些酒店支持）
  │
  ├── 服务
  │     late_checkout   requested / confirmed / denied
  │     early_checkin   requested / confirmed
  │     airport_shuttle true/false
  │     breakfast_incl  true/false
  │     gym / pool      true/false
  │     wifi_code       "GUEST2026"
  │
  ├── 会员
  │     loyalty_program "Marriott Bonvoy" / "IHG" / "Hilton Honors"
  │     member_number   "xxxxxxxx"
  │     member_level    gold / platinum / diamond
  │
  └── 注意事项
        cancellation    "免费取消至 4月13日"
        deposit         "已预授权 ¥50,000"
        nearby          "距客户办公室步行 10 分钟"
```

### 2.3 Transport（地面交通）

```
Transport
  ├── 类型
  │     mode            airport_transfer / city_car / train / rental / ride_hail
  │     provider        "Grab" / "JapanTaxi" / "Corporate driver"
  │
  ├── 详情
  │     pickup_at       2026-04-15T17:00
  │     pickup_location "NRT Terminal 1 Arrival Gate"
  │     dropoff         "Hotel Gracery Shinjuku"
  │     driver_name     "Tanaka-san"
  │     driver_phone    "+81-90-xxxx-xxxx"
  │     vehicle         "Black Toyota Crown, 品川 300 す 1234"
  │     booking_ref     "GRB-xxxx"
  │
  ├── 记忆
  │     driver_rating   4.8 / "上次很准时"
  │     route_notes     "成田到新宿约 90 分钟，避开 17:00 高峰"
  │
  └── 备选
        alternative     "Narita Express 到新宿，36 分钟，¥3,250"
```

---

## 三、Occasion（工作场景）

出差的核心价值不在物流，在 Occasion。

### 3.1 Meeting（会议）

```
Meeting
  ├── 基本
  │     title           "DBS Digital Banking 合作讨论"
  │     datetime        2026-04-16T14:00+09:00
  │     duration        60min
  │     location        "DBS Tokyo Office, Marunouchi"
  │     meeting_type    client / partner / internal / board / government
  │     status          tentative → confirmed → completed → cancelled
  │
  ├── 参会人
  │     host            "Yamamoto Kenji, VP Digital Banking"
  │     attendees       ["Yamamoto", "Lisa Wong (我方)", "Tiger"]
  │     host_ea         "Sato Yuki <yuki.sato@dbs.com>"  ← 对方助理
  │
  ├── 会前准备（Sophie 自动生成）
  │     brief           "上次见面：2026-01 SG，讨论了 API 接入；
  │                      未兑现承诺：Yamamoto 承诺给 sandbox access，未收到；
  │                      本次目标：推进 pilot 签约"
  │     materials       ["pitch_deck_v3.pdf", "pricing_sheet.xlsx"]
  │     dress_code      business_formal / smart_casual
  │     cultural_notes  "名片双手递，日语打招呼"
  │     gift            "新加坡 TWG 茶礼盒"（如需要）
  │
  ├── 会中
  │     notes           会议笔记（手动或语音转写）
  │     decisions       ["同意启动 pilot", "Q2 签 MOU"]
  │
  └── 会后
        action_items    → Commitment[]
        follow_up       "24h 内发感谢邮件 + 会议纪要"
        next_meeting    "Q2 再见，地点待定"
```

### 3.2 BusinessDinner（商务餐）

```
BusinessDinner
  ├── 基本
  │     datetime        2026-04-16T19:00+09:00
  │     purpose         relationship / celebration / negotiation
  │     formality       casual / semi_formal / formal
  │     status          planning → reserved → completed
  │
  ├── 餐厅
  │     restaurant      "鮨 さいとう"
  │     cuisine         omakase / chinese / western / local
  │     address         "Minato-ku, Roppongi..."
  │     reservation_ref "SAI-2026-0415"
  │     reserved_by     "对方安排" / "我方订"
  │     private_room    true / false
  │     price_range     "¥30,000-50,000/人"
  │
  ├── 出席者
  │     host            谁做东
  │     guests          ["Yamamoto", "Tiger", "Lisa"]
  │     seating_notes   "Yamamoto 坐上座"（文化礼仪）
  │
  ├── 饮食偏好（记忆，跨次出差积累）
  │     dietary_map     {
  │                       "Yamamoto": "no shellfish",
  │                       "Tiger": "no restrictions",
  │                       "Lisa": "vegetarian"
  │                     }
  │     alcohol         "Yamamoto 喝清酒，不劝酒"
  │     allergies       ["花生 — Lisa"]
  │
  ├── 文化礼仪（按目的地）
  │     etiquette       "日本：主人先动筷；不要给自己倒酒；
  │                      不需要小费；结账不在桌上，去前台"
  │     conversation    "避开政治话题；可聊高尔夫（Yamamoto 爱好）"
  │
  └── 会后
        expense_split   "我方请客" / "对方请客" / "AA"
        thank_you       "明早发感谢 WhatsApp"
        follow_up       → Commitment
```

### 3.3 Forum（论坛 / 峰会 / 展会）

```
Forum
  ├── 基本
  │     name            "InsurTech Asia Summit 2026"
  │     dates           2026-04-17 ~ 2026-04-18
  │     venue           "Tokyo Big Sight"
  │     registration    "已注册，确认号 IAS-xxxx"
  │     badge_type      speaker / attendee / exhibitor / VIP
  │     status          registered → attending → completed
  │
  ├── 议程（Sophie 从邮件/网站提取）
  │     sessions        [
  │                       { time: "09:00", title: "Keynote: Future of InsurTech", speaker: "..." },
  │                       { time: "14:00", title: "Panel: AI in Underwriting", speaker: "Tiger" }
  │                     ]
  │     starred         用户标记的感兴趣场次
  │
  ├── 演讲准备（如果是 speaker）
  │     talk_title      "AI-Powered Digital Twins for Insurance"
  │     slides          "IAS_deck_v2.pptx"
  │     duration        20min + 10min Q&A
  │     av_requirements "HDMI, clicker, lavalier mic"
  │     rehearsal       "4月16日晚在酒店过一遍"
  │
  ├── 社交目标
  │     target_people   [
  │                       { name: "Sarah Chen", company: "Swiss Re", reason: "讨论再保方案" },
  │                       { name: "James Tan", company: "Grab Financial", reason: "探索合作" }
  │                     ]
  │     booth_visits    ["AWS booth", "Stripe booth"]
  │
  ├── 展位（如果是 exhibitor）
  │     booth_number    "B-23"
  │     setup_time      "4月16日 16:00-18:00"
  │     materials       ["展架", "宣传册 200 份", "名片 500 张"]
  │     staff           ["Tiger", "Lisa", "Wei"]
  │
  └── 会后
        contacts_made   → 新联系人列表
        cards_collected "拍照上传 → OCR → 入联系人库"
        follow_ups      → Commitment[]（"答应给 Sarah 发白皮书"）
        learnings       "竞品 X 发布了新功能 Y，需要关注"
```

---

## 四、Expense（费用）

每笔费用关联到具体的 Leg 或 Occasion。

```
Expense
  ├── 基本
  │     amount          15000
  │     currency        JPY
  │     amount_sgd      135.50（自动换算，用交易日汇率）
  │     date            2026-04-16
  │     description     "客户晚餐 — 鮨 さいとう"
  │
  ├── 分类
  │     category        flight / hotel / transport / meal_client / meal_self /
  │                     conference / gift / telecom / visa / other
  │     subcategory     "client_entertainment"
  │     client_code     "DBS-2026-Q2"（可分摊到客户）
  │     project_code    "PROJ-PILOT-DBS"
  │
  ├── 凭证
  │     receipt_image   "receipts/2026-04-16-dinner.jpg"
  │     receipt_ocr     { vendor: "鮨 さいとう", total: "¥45,000", tax: "¥4,090" }
  │     payment_method  corporate_card / personal_card / cash / grab_pay
  │     card_last4      "4532"
  │
  ├── 报销
  │     reimbursable    true / false
  │     status          pending → submitted → approved → paid
  │     policy_check    "在每日餐饮限额内" / "超限需审批"
  │     submitted_at    提交时间
  │     approved_by     审批人
  │
  └── 关联
        trip_id         → Trip
        leg_id          → 关联的 Flight/Hotel/Transport
        occasion_id     → 关联的 Meeting/Dinner/Forum
```

---

## 五、Preference（偏好记忆）

跨出差积累，越用越懂。

```
Preference
  ├── 航空
  │     preferred_airline     "Singapore Airlines"
  │     preferred_alliance    Star Alliance
  │     seat_pref             "aisle, front of cabin"
  │     meal_pref             "Hindu vegetarian"
  │     ff_numbers            { "SQ": "xxx", "ANA": "xxx" }
  │
  ├── 酒店
  │     preferred_chains      ["Marriott", "IHG"]
  │     room_pref             "high floor, king bed, non-smoking"
  │     loyalty_numbers       { "Marriott": "xxx", "IHG": "xxx" }
  │     blacklist             ["Hotel X — 上次隔音很差"]
  │
  ├── 地面交通
  │     preferred_mode        "专车 > 出租 > 地铁"
  │     trusted_drivers       { "Jakarta": "Pak Budi +62-xxx", "Tokyo": "Tanaka +81-xxx" }
  │
  ├── 餐饮
  │     dietary               "no restrictions"
  │     preferred_cuisines    ["Japanese", "Italian"]
  │     favorite_restaurants  { "Tokyo": ["鮨 さいとう", "Gonpachi"], "HK": ["Lung King Heen"] }
  │     alcohol               "red wine, Japanese whisky"
  │
  ├── 城市经验
  │     city_notes            {
  │                             "Tokyo": "Suica 卡在便利店买；新宿站很容易迷路用东口",
  │                             "Jakarta": "从 CGK 到 SCBD 至少留 2 小时；用 Bluebird 出租",
  │                             "HK": "八达通卡；T8 台风信号会停工"
  │                           }
  │
  └── 文化备忘
        gift_history          { "Yamamoto": ["TWG 2026-01", "小 CK 钱包 2025-09"] }
        business_card_notes   "日本韩国：双手递，认真看；中国：WeChat 更重要"
```

---

## 六、与现有本体的关系

```
Signal（邮件/WhatsApp/日历）
  │
  ├──提取──→ Trip（识别出差意图）
  │             ├── Leg（航班确认邮件 → Flight）
  │             ├── Occasion（会议邀请 → Meeting）
  │             └── Expense（收据邮件 → Expense）
  │
  ├──聚合──→ Topic（"东京出差"这件事）
  │
  └──提取──→ Commitment（"出发前准备 deck"、"回来后发 follow-up"）
                 └── 关联到 Trip / Occasion
```

---

## 七、实施优先级

| 阶段 | 内容 | 价值 |
|------|------|------|
| **P0** | Trip + Flight + Hotel 基础表 | 能聚合出"一次出差"的完整视图 |
| **P1** | Meeting + BusinessDinner + Forum | 工作层，Sophie 的核心差异化 |
| **P2** | Expense + Receipt OCR | 报销痛点，高频刚需 |
| **P3** | Preference 记忆系统 | 越用越懂，长期护城河 |
| **P4** | 文化礼仪 + Gift tracking | 精细化，打动高端用户 |

---

## 八、待讨论

1. Preference 记忆的冷启动 — 第一次出差没有历史，怎么提供价值？
2. 多人出差 — Trip 是个人的还是共享的？团队出差怎么建模？
3. 审批流 — 出差申请 → 审批 → 订票，是否建模？
4. 与日历的双向同步 — Trip 自动生成日历事件？还是从日历事件推断 Trip？
