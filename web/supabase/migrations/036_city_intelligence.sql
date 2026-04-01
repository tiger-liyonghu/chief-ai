-- Migration 036: City Intelligence — Sophie 的城市知识库
--
-- 静态种子数据：签证、小费、气候、电源、支付、文化礼仪
-- 按城市/国家索引，Trip 创建时自动查询关联

-- ==========================================
-- 1. COUNTRY_INFO — 国家级信息
-- ==========================================

CREATE TABLE IF NOT EXISTS public.country_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL UNIQUE,   -- "JP", "TH", "SG", "CN", "KR", "ID", "IN", "VN", "HK", "TW"
  country_name TEXT NOT NULL,          -- "Japan"
  country_name_zh TEXT,                -- "日本"

  -- 签证 & 入境（以新加坡护照为基准，未来可扩展多护照）
  visa_type TEXT CHECK (visa_type IN ('visa_free', 'evisa', 'visa_on_arrival', 'pre_arranged')),
  visa_free_days INT,                  -- 90
  evisa_lead_days INT,                 -- 3
  abtc_accepted BOOLEAN DEFAULT false,
  passport_validity_months INT DEFAULT 6,
  blank_pages_required INT DEFAULT 2,
  immigration_notes TEXT,              -- "Visit Japan Web 提前填写"
  customs_notes TEXT,                  -- "现金超 ¥1,000,000 需申报"
  work_permit_notes TEXT,              -- "客户会议免签；咨询/培训>14天需工作许可"
  medication_restrictions TEXT,        -- "含伪麻黄碱感冒药禁止入境"

  -- 小费
  tipping_restaurant TEXT,             -- "不给" / "5-10%" / "含服务费10%"
  tipping_hotel_bellboy TEXT,          -- "不给" / "THB 20-50/件"
  tipping_hotel_housekeeping TEXT,     -- "不给" / "THB 20/晚"
  tipping_taxi TEXT,                   -- "不给" / "凑整" / "10%"
  tipping_summary TEXT,               -- "给小费=侮辱" / "逐渐接受" / "期望小费"

  -- 电源 & 通信
  plug_type TEXT,                      -- "A/B" / "G" / "C/F"
  voltage TEXT,                        -- "100V" / "220-240V"
  esim_available BOOLEAN DEFAULT true,
  vpn_required BOOLEAN DEFAULT false,
  sim_registration_required BOOLEAN DEFAULT false,
  primary_payment TEXT,                -- "Suica/现金" / "Alipay/WeChat" / "GrabPay"
  card_acceptance TEXT,                -- "广泛" / "大城市" / "现金为主"
  cash_dependency TEXT CHECK (cash_dependency IN ('low', 'medium', 'high')),
  tax_refund_notes TEXT,               -- "消费税10%可退"

  -- 气候
  climate_zone TEXT,                   -- "温带" / "热带" / "亚热带"
  typhoon_season TEXT,                 -- "6月-10月" / null
  monsoon_season TEXT,                 -- "5月-10月" / null
  haze_season TEXT,                    -- "8月-10月" / null
  extreme_heat_months TEXT,            -- "4月-6月" / null
  winter_months TEXT,                  -- "12月-2月" / null

  -- 商务天气规则
  weather_business_rules JSONB DEFAULT '[]',
  -- [{"signal":"T8","effect":"全城停工","recovery":"2小时后恢复"},
  --  {"signal":"PSI>101","effect":"减少室外活动"}]

  -- 文化
  business_card_protocol TEXT,         -- "双手递接，认真阅读"
  gift_taboos TEXT,                    -- "4件套（谐音死），白色包装"
  good_gifts TEXT,                     -- "本国特产，精美包装"
  avoid_scheduling TEXT,               -- "お盆（8月中），正月（12/28-1/3）"
  meeting_punctuality TEXT,            -- "迟1分钟就被注意到" / "迟15-30分钟常见"
  dining_etiquette TEXT,               -- "主人先动筷，不给自己倒酒"
  working_hours TEXT DEFAULT '9:00-18:00',
  dress_code_note TEXT,                -- "全黑/深蓝西装" / "可免领带"

  -- 紧急联系
  emergency_police TEXT,               -- "110"
  emergency_ambulance TEXT,            -- "119"
  recommended_hospital TEXT,           -- "St. Luke's（英语服务）"

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 2. CITY_INFO — 城市级补充信息
-- ==========================================

CREATE TABLE IF NOT EXISTS public.city_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES public.country_info(country_code),
  city_name TEXT NOT NULL,             -- "Tokyo"
  city_name_zh TEXT,                   -- "东京"
  airport_code TEXT,                   -- "NRT/HND"

  -- 交通
  airport_to_city TEXT,                -- "Narita Express 36min ¥3,250 / Limousine Bus 90min ¥3,200"
  local_transport TEXT,                -- "Suica卡，地铁+JR覆盖全城"
  traffic_notes TEXT,                  -- "新宿站容易迷路，用东口"
  grab_available BOOLEAN DEFAULT false,
  grab_alternative TEXT,               -- "JapanTaxi app"

  -- 实用信息
  timezone TEXT,                       -- "Asia/Tokyo" (UTC+9)
  currency_code TEXT,                  -- "JPY"
  language TEXT,                       -- "Japanese"
  english_level TEXT,                  -- "基础" / "较好" / "流利"

  -- 推荐
  business_district TEXT,              -- "Marunouchi, Otemachi"
  recommended_hotels JSONB DEFAULT '[]',  -- [{"name":"Park Hyatt","tier":"luxury"},...]
  recommended_restaurants JSONB DEFAULT '[]',
  coworking_spaces JSONB DEFAULT '[]',

  -- 特殊注意
  local_tips TEXT,                     -- "Suica卡便利店买；现金要备 ¥30,000+"
  safety_notes TEXT,                   -- "极其安全，深夜出行无问题"

  UNIQUE(country_code, city_name),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 3. Indexes & RLS
-- ==========================================

-- country_info is public reference data, no RLS needed
-- city_info is public reference data, no RLS needed

CREATE INDEX IF NOT EXISTS idx_city_info_country ON public.city_info(country_code);
CREATE INDEX IF NOT EXISTS idx_city_info_airport ON public.city_info(airport_code);

-- ==========================================
-- 4. SEED DATA — 核心亚太商务城市
-- ==========================================

INSERT INTO public.country_info (country_code, country_name, country_name_zh, visa_type, visa_free_days, abtc_accepted, passport_validity_months, immigration_notes, customs_notes, medication_restrictions, tipping_restaurant, tipping_hotel_bellboy, tipping_hotel_housekeeping, tipping_taxi, tipping_summary, plug_type, voltage, vpn_required, primary_payment, card_acceptance, cash_dependency, climate_zone, typhoon_season, business_card_protocol, gift_taboos, good_gifts, avoid_scheduling, meeting_punctuality, dining_etiquette, dress_code_note, emergency_police, emergency_ambulance, recommended_hospital)
VALUES
('JP', 'Japan', '日本', 'visa_free', 90, true, 6, 'Visit Japan Web 提前在线填写入境信息', '现金超 ¥1,000,000 需申报', '含伪麻黄碱/甲基苯丙胺的药品禁止入境', '不给小费', '不给', '不给', '不给', '给小费=侮辱', 'A/B', '100V', false, 'Suica/现金', '大城市信用卡可用，小店现金', 'medium', '温带', '6月-10月', '双手递接meishi，认真阅读，会议中放桌上，绝不在上面写字', '4件套（谐音死）、白色包装（丧事）、梳子（谐音苦）', '本国特产（TWG茶、小CK等），精美包装，奇数件', 'お盆（8月中旬）、正月（12/28-1/3）、Golden Week（4/29-5/5）', '迟1分钟就会被注意到，提前5分钟到是礼貌', '主人先动筷；不给自己倒酒（互相倒）；筷子不插饭里（像上香）；不需要小费', '全黑或深蓝西装，白衬衫，保守', '110', '119', 'St. Luke''s International Hospital（英语服务）'),

('CN', 'China', '中国', 'visa_free', 15, true, 6, '144小时过境免签（部分城市）；正式商务需L签或M签', '现金超 $5,000 等值需申报；无人机需提前报备', '处方药带医生英文证明', '不需要（高端酒店可留少量）', 'CN¥20-50', 'CN¥20-50/晚', '不需要', '不需要/高端可少量', 'A/C/I', '220V', true, 'Alipay/WeChat Pay', '移动支付覆盖极广', 'low', '大陆性/亚热带', '7月-9月（东南沿海）', '双手递接，但WeChat比名片更重要，立即加微信', '钟表（送终）、绿帽子（戴绿帽）、梨（分离）、伞（散）', '好茶、好酒（茅台/红酒）、本国特产', '春节（1-2月，至少一周）、国庆（10/1-7）、清明/中秋', '基本准时，但弹性比日本大', '主人点菜做东；干杯文化（商务场合不可推辞）；座位有主客之分', '商务正装，可不打领带（南方城市）', '110', '120', '和睦家医院（外籍服务）'),

('SG', 'Singapore', '新加坡', 'visa_free', 90, true, 6, '电子入境卡 SG Arrival Card 提前填写', '烟酒有严格限额；口香糖禁止带入', '精神类药物需医生证明', '含10%服务费', 'SGD 2', '不需要', '不需要', '服务费已含，不另给', 'G', '230V', false, 'PayNow/GrabPay', '广泛', 'low', '热带', null, '单手递可接受，但双手更佳', '无特殊禁忌', '本国特产', '华人新年（1-2月）、开斋节、屠妖节', '准时，5分钟内可接受', '多元文化，注意清真/素食需求；筷子/叉勺都可', '商务正装，可穿长袖衬衫免西装外套（热带）', '999', '995', 'Raffles Hospital / Mount Elizabeth'),

('HK', 'Hong Kong', '香港', 'visa_free', 90, true, 6, '入境无需填表，自助通道', '烟酒有限额', '无特殊限制', '含10%服务费', 'HKD 10-20', 'HKD 10-20/晚', '凑整', '服务费已含，小额找零可留', 'G', '220V', false, 'Octopus/AlipayHK', '广泛', 'low', '亚热带', '6月-10月', '双手递接，中英文双面', '同中国大陆', '好酒、本国特产', '春节、中秋', '准时，直接高效（接近西方风格）', '点心商务午餐常见高效；不需要干杯', '商务正装', '999', '999', 'Queen Mary Hospital / Matilda International'),

('KR', 'South Korea', '韩国', 'visa_free', 90, true, 6, 'K-ETA 提前申请（部分国籍免除）', '现金超 $10,000 需申报', '无特殊限制', '不给小费', '不给', '不给', '不给', '不需要小费', 'C/F', '220V', false, 'T-money/信用卡', '广泛', 'low', '温带', '7月-9月', '双手递接，类似日本但稍轻松', '刀具（断绝关系）、红墨水写名字（死人）', '高档水果、保健品、化妆品', '설날（春节）、秋夕（中秋）', '准时', '长辈先动筷；接酒双手；啤酒+烧酒文化（包含续摊noraebang）', '深色西装', '112', '119', 'Severance Hospital（延世大学）'),

('TH', 'Thailand', '泰国', 'visa_free', 30, true, 6, '免签入境，填入境卡', '烟限200支，酒限1升', '无特殊限制', '5-10%（高端）；含服务费则不另给', 'THB 20-50/件', 'THB 20/晚', '凑整', '逐渐接受小费', 'A/B/C', '220V', false, 'PromptPay/现金/Grab', '大城市信用卡可用', 'medium', '热带', null, '单手递可接受', '无特殊禁忌；避免摸头', '水果、花束', '泼水节（4月中旬）、国王生日', '迟15分钟常见，留余量', 'Wai合十礼；辣椒多；不要用脚指东西', '可免领带（热带），长袖衬衫', '191', '1669', 'Bumrungrad International Hospital'),

('ID', 'Indonesia', '印尼', 'visa_free', 30, true, 6, 'eVOA 在线申请或落地签', '烟限200支', '无特殊限制', '5-10%（不含服务费时）', 'IDR 10,000-20,000', 'IDR 10,000/晚', '凑整', '可给可不给', 'C/F', '230V', false, 'GoPay/OVO/Dana/现金', '大城市可用，小城现金', 'high', '热带', null, '单手递（右手）', '猪肉制品（穆斯林多）；左手不洁', '椰枣、茶叶', '斋月（每年不同）、开斋节', '迟15-30分钟常见', '右手进食（穆斯林）；注意清真餐饮', '长袖衬衫', '110', '118', 'Pondok Indah Hospital / Siloam'),

('IN', 'India', '印度', 'evisa', null, true, 6, 'eVisa 提前4天以上申请', '现金超 $5,000 需申报', '处方药需英文证明', '10%', 'INR 100+/件', 'INR 250-500/晚', 'INR 50-100', '期望小费', 'C/D/M', '230V', false, 'UPI/Paytm/现金', '大城市可用', 'medium', '热带/亚热带', null, '双手递接', '皮革制品（牛神圣）；黑色（不吉利）', '干果、甜品、银器', '排灯节（10-11月）、洒红节（3月）、独立日（8/15）', '迟15分钟常见', '右手吃饭；素食选项很重要；不喝牛奶的严格素食注意', '商务正装', '100', '102', 'Apollo Hospital / Max Healthcare'),

('VN', 'Vietnam', '越南', 'evisa', null, true, 6, 'eVisa 提前申请，25美元', '现金超 $5,000 需申报', '无特殊限制', '10%（高端餐厅）', 'USD 1-2/件', 'USD 1/晚', '凑整+VND 10,000-20,000', '美元受欢迎', 'A/C', '220V', true, '现金/MoMo', '大城市信用卡渐普及', 'high', '热带', '7月-11月（中部）', '双手递接', '无特殊禁忌', '咖啡、腰果', '越南新年（Tết，1-2月）', '基本准时', '年长者先动；敬酒文化', '商务正装', '113', '115', 'FV Hospital（胡志明市）/ Vinmec')

ON CONFLICT (country_code) DO NOTHING;

-- City-level seed data (top business cities)
INSERT INTO public.city_info (country_code, city_name, city_name_zh, airport_code, airport_to_city, local_transport, grab_available, grab_alternative, timezone, currency_code, english_level, business_district, local_tips, safety_notes)
VALUES
('JP', 'Tokyo', '东京', 'NRT/HND', 'NRT: Narita Express 60min ¥3,250 / Limousine Bus 90min ¥3,200; HND: 单轨20min ¥500', 'Suica/Pasmo IC卡覆盖全城地铁+JR', false, 'JapanTaxi app / Uber（有限）', 'Asia/Tokyo', 'JPY', '基础（年轻人较好）', 'Marunouchi / Otemachi / Shibuya / Roppongi', 'Suica卡便利店买；新宿站容易迷路用东口；现金备¥30,000+；7-11 ATM支持外卡', '极其安全，深夜出行无问题'),
('JP', 'Osaka', '大阪', 'KIX', 'Haruka Express 50min ¥2,860 / 南海电铁45min ¥930', 'ICOCA卡', false, 'JapanTaxi', 'Asia/Tokyo', 'JPY', '基础', 'Umeda / Namba / Shinsaibashi', '比东京友好，英语沟通更难，Google翻译必备', '安全'),
('CN', 'Shanghai', '上海', 'PVG/SHA', 'PVG: 磁悬浮8min+地铁 / 地铁90min ¥7; SHA: 地铁30min', '地铁覆盖广，滴滴出行', false, '滴滴出行', 'Asia/Shanghai', 'CNY', '商务圈较好', '陆家嘴 / 静安 / 虹桥', 'VPN必装（提前下载）；微信支付绑外卡困难，备现金；地铁安检', '安全，注意扒手'),
('CN', 'Beijing', '北京', 'PEK/PKX', 'PEK: 机场快轨25min; PKX: 大兴线', '地铁+滴滴', false, '滴滴出行', 'Asia/Shanghai', 'CNY', '商务圈较好', 'CBD国贸 / 金融街 / 中关村', 'VPN必装；空气质量差时备N95口罩；冬天极冷-10°C', '安全'),
('SG', 'Singapore', '新加坡', 'SIN', 'MRT 30min SGD 2.50 / Taxi 20min SGD 25-40', 'MRT+Bus+Grab', true, null, 'Asia/Singapore', 'SGD', '流利', 'CBD / Marina Bay / One North', '樟宜机场T4航站楼较新；Grab比出租车便宜；室内冷气强备薄外套', '极其安全'),
('HK', 'Hong Kong', '香港', 'HKG', 'Airport Express 24min HKD 115 / Bus A21 40min HKD 33', 'MTR+巴士+叮叮车', true, null, 'Asia/Hong_Kong', 'HKD', '流利', 'Central / Admiralty / Wan Chai / Tsim Sha Tsui', '八达通卡地铁站买；T8台风信号全城停工；星期天菲佣占满中环', '安全'),
('KR', 'Seoul', '首尔', 'ICN', 'AREX 直达43min KRW 9,500 / 机场巴士60-90min', 'T-money卡地铁+公交', false, 'Kakao T', 'Asia/Seoul', 'KRW', '年轻人较好', 'Gangnam / Yeouido / Jongno', 'T-money卡便利店买；地铁超大但标识清楚；韩语导航比英语准', '安全'),
('TH', 'Bangkok', '曼谷', 'BKK/DMK', 'BKK: Airport Rail Link 30min THB 45 / Taxi 45-90min THB 300-500', 'BTS+MRT+Grab', true, null, 'Asia/Bangkok', 'THB', '旅游区较好', 'Silom / Sathorn / Sukhumvit', '从BKK到市区高峰期2小时；Grab比出租车靠谱；注意出租车打表', '基本安全，注意诈骗'),
('ID', 'Jakarta', '雅加达', 'CGK', 'Airport Train 50min IDR 70,000 / Taxi 60-120min', 'Grab/Gojek', true, null, 'Asia/Jakarta', 'IDR', '商务圈可用', 'SCBD / Sudirman / Kuningan', '从CGK到SCBD至少留2小时；Grab/Gojek必装；洪水季雨后交通瘫痪', '注意扒手和诈骗'),
('IN', 'Mumbai', '孟买', 'BOM', 'Taxi 60-90min INR 500-800 / Metro+Local Train', 'Ola/Uber', false, 'Ola app', 'Asia/Kolkata', 'INR', '商务圈较好', 'BKC / Lower Parel / Nariman Point', '交通拥堵严重；Uber/Ola比自己打车靠谱；monsoon季6-9月出行受影响', '注意个人物品'),
('VN', 'Ho Chi Minh City', '胡志明市', 'SGN', 'Taxi 30-45min VND 150,000-250,000 / Grab', 'Grab', true, null, 'Asia/Ho_Chi_Minh', 'VND', '年轻人较好', 'District 1 / District 2 (Thu Duc) / District 7', '过马路要慢慢走不要突然停（摩托车会绕你）；Grab必装；现金为主', '基本安全，注意飞车抢劫')

ON CONFLICT (country_code, city_name) DO NOTHING;
