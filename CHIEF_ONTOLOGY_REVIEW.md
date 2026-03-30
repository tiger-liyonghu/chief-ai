# Chief 本体模型专家评审
## 7位专家三轮讨论 | 2026-03-30

---

## 参与专家

1. CRM专家（Salesforce/HubSpot架构师，15年）
2. BD专家（东南亚，12年）
3. 高频商旅人士（年200+趟，C-suite）
4. 麦肯锡资深合伙人
5. 系统架构师
6. 产品经理（熟悉Chief代码）
7. 本体论专家（PhD，知识表示）

---

## 核心发现

### 做得好的
- 6实体模型覆盖基本CRM需求
- 统一relations表是正确的选择
- confidence字段从第一天就有
- properties JSONB避免schema爆炸

### 必须修改的

1. 缺少Activity/Interaction实体
   -- 折中方案：给Context加outcome_summary/action_items/mood字段
   -- 不加第7个实体，但让Context承载"发生了什么"

2. Deal实体太薄
   -- 加latent阶段（东南亚的deal在正式pipeline前就存在）
   -- 加Deal-Organization关系（champion离开后deal不能跟organization断联）

3. trust_level和warmth放错了位置
   -- 从Person实体移到Person-Person关系的properties里
   -- 信任是关系的属性，不是人的属性

4. 关系缺少时间维度
   -- relations表加valid_from/valid_to字段
   -- 取消formerly_at关系类型，改用works_at + valid_to

5. 缺少facilitator_of关系
   -- 东南亚的中间人/引荐人是deal的持续参与者，不只是历史记录

6. 缺少same_as关系
   -- 实体去重（张总/Zhang Wei/Wei Zhang是同一个人）

7. Context缺少priority/flexibility字段
   -- 不是所有冲突都一样重要
   -- "女儿钢琴表演"和"堂弟生日"不能同等对待

8. Person缺少base_timezone
   -- "现在不要打电话给东京的田中先生，那边晚上11点了"

### 架构建议

1. 新增entity_types注册表
   -- 防止from_type/to_type字符串漂移
   -- 新增实体类型只需插入一行

2. 新增properties_schema字段到relation_types
   -- 记录每种关系的properties结构
   -- 防止同类关系的properties格式不一致

3. 兼容视图（最关键的实施建议）
   -- 在新schema上创建Postgres视图模拟旧表接口
   -- 25个工具函数不需要同时重写
   -- 逐个迁移，一个模块一个模块来

4. resolve_context分层返回
   -- 第1层：200 token摘要（实体数量、关键事实、紧急标志）
   -- 第2层：完整1跳关系集
   -- 第3层（按需）：2跳关系集
   -- LLM先收第1层，需要时再请求第2/3层

### 5个实施优先级

1. 第1周：relations表 + relation_types表 + entity_types表 + 索引
2. 第2-3周：resolve_context函数（Supabase RPC）
3. 第2-3周（并行）：兼容视图覆盖旧表
4. 第3-4周：双写（contact创建和task创建同时写新旧两层）
5. 第4-5周：Deal实体表（含latent阶段）

### 明确不做的事

1. 不建God Context Blob -- resolve_context分层返回，不是一次返回所有
2. 不搞关系类型爆炸 -- 用少量通用类型+丰富properties，不是每个场景一个类型
3. 不提前物化推理规则 -- 当前数据量下实时查询毫秒级，等P95超200ms再物化
4. 不同时迁移25个工具 -- 兼容视图+逐模块迁移
5. 不把本体当静态设计 -- 每季度review，追踪哪些关系类型实际被使用

### Market实体推迟到Phase 2
- 当前没有数据源填充它
- 没有工具读写它
- 空实体会让用户觉得系统有死区

### 评分

```
                    当前    优化后
可扩展性            7/10    8.5/10
兼容性              5/10    8/10
稳定性(2-3年)       6/10    8/10
全球竞争力          6/10    7.5/10
东南亚适配          5/10    8/10
实施可行性          4/10    7/10
```

### 各专家一句话

CRM专家："加Deal-Organization，trust移到关系上，就有了Salesforce复制不了的个人CRM。"

BD专家："facilitator角色和互惠追踪把这个从西方CRM变成了在亚洲真正能用的东西。"

商旅人士："给Context加priority/flexibility，给Person加timezone——光这个每趟出差就省30分钟。"

麦肯锡合伙人："抵制在Deal功能上跟Salesforce竞争的冲动。拥有关系图谱。那才是护城河。"

系统架构师："兼容视图方案是5周交付和3个月迁移地狱之间的区别。"

产品经理："分阶段实施计划尊重我们已经建好的东西。v3专家组说'不要重写'。这个本体可以叠加上去而不需要重写。"

本体专家："时间维度关系和entity_types注册表是把本体有效期从1年延长到3年的两个关键添加。"
