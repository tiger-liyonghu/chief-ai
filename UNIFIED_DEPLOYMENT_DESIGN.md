# Chief — 一体化部署方案设计

## 2026-03-30

---

## 问题

当前是两个独立服务：
- **web/** — Next.js，部署在 Vercel（serverless）
- **whatsapp-service/** — Express + Baileys，未部署

这导致：
1. 部署复杂（两个服务、两套环境变量、两个域名）
2. 通信靠 HTTP proxy，增加延迟和故障点
3. 代码重复（Supabase client、AI client、prompt 在两边都有）
4. WhatsApp service 没有好的部署方案（Vercel 不支持长连接）

## 核心约束

**Baileys（WhatsApp Web）需要长连接**。它维护一个 WebSocket 到 WhatsApp 服务器，必须持续在线。这意味着：

- Vercel（serverless）不可用 — 函数最长 300 秒就断
- 需要一个能跑常驻进程的平台

## 方案对比

### 方案 A：迁移到 Railway/Fly.io（推荐）

**架构**：一个 Next.js app + 一个后台 worker 进程，同一个 Docker 容器

```
Docker Container (Railway / Fly.io)
├── Next.js Server (port 3000)
│   ├── app/api/...           所有 API routes
│   ├── app/(dashboard)/...   所有页面
│   └── app/api/whatsapp/...  WhatsApp API（直接调用 lib/）
│
└── Worker Process (同一容器内)
    ├── lib/whatsapp/client.ts      Baileys 连接管理
    ├── lib/whatsapp/ai-handler.ts  AI 消息处理
    └── lib/whatsapp/scheduler.ts   晨间简报 + 承诺提醒（setInterval）
```

**关键设计**：
- Next.js 的 `instrumentation.ts`（Next.js 内置）在服务器启动时运行，用来启动 WhatsApp 后台 worker
- Worker 和 API routes 共享同一个进程，通过内存直接通信（不需要 HTTP proxy）
- Baileys session 存在容器的持久化存储或 Supabase Storage

**部署平台对比**：

| 平台 | 价格 | 长连接 | 部署难度 | 适合 |
|------|------|--------|---------|------|
| **Railway** | $5/月起 | 支持 | 低（Dockerfile） | 最适合当前阶段 |
| **Fly.io** | $5/月起 | 支持 | 中（fly.toml） | 适合，需要更多配置 |
| **Render** | $7/月起 | 支持 | 低 | 适合 |
| **AWS ECS/Fargate** | ~$15/月 | 支持 | 高 | 过度工程 |
| **自己的服务器** | 看配置 | 支持 | 高 | 维护成本大 |

**优点**：
- 一个服务，一套部署，一个域名
- 代码共享（prompt、filter、Supabase client 只有一份）
- 内存通信，零延迟
- 简单

**缺点**：
- 离开 Vercel（失去 Edge CDN、自动 preview deploy）
- 需要自己管理 Dockerfile
- 月费 $5-7（Vercel hobby 是免费的）

---

### 方案 B：Vercel + 独立 Worker

**架构**：Vercel 跑 web，Worker 独立跑在 Railway

```
Vercel (web, serverless)          Railway (worker, 常驻)
├── app/api/...                   ├── WhatsApp Baileys 连接
├── app/(dashboard)/...           ├── 晨间简报 scheduler
└── app/api/whatsapp/ ──HTTP──→   └── 承诺提醒 scheduler
                                       ↕
                                    Supabase
```

**优点**：
- 保留 Vercel 的 CDN 和 preview deploy
- Web 部分免费
- Worker 只跑 WhatsApp 相关，$5/月

**缺点**：
- 还是两个服务
- HTTP 通信延迟
- 两套环境变量
- 代码仍然分散

---

### 方案 C：Vercel + Supabase Edge Functions

**架构**：Web 在 Vercel，用 Supabase Edge Functions 跑 WhatsApp

**问题**：Edge Functions 也是 serverless，不能维持长连接。**不可行**。

---

### 方案 D：Vercel + Upstash QStash（事件驱动）

**架构**：不用 Baileys 长连接，改用 WhatsApp Business API（Meta 官方）

```
Vercel (全部在这里)
├── app/api/whatsapp/webhook  ← Meta 推送消息到这里
├── app/api/whatsapp/send     → 调用 Meta API 发消息
└── 不需要长连接
```

**优点**：
- 纯 serverless，Vercel 搞定一切
- 不需要 worker
- Meta 官方 API，稳定

**缺点**：
- Meta Business API 需要注册 Meta 开发者账号 + 商业验证
- 每条消息收费（$0.005-0.08/条，按地区）
- 不能用 self-chat 模式（Meta API 不支持）
- 申请流程 1-2 周

---

## 推荐：方案 A（Railway 一体化）

理由：
1. 一个服务 = 一个产品，部署和维护最简单
2. $5/月可接受
3. 代码合并后复用性最好
4. 以后如果要迁移到方案 D（Meta 官方 API），代码已经在一起了

---

## 实施步骤（方案 A）

### Phase 1：合并代码（2-3 小时）

1. **移动 WhatsApp 代码到 web/**：
   ```
   whatsapp-service/src/client.ts      → web/lib/whatsapp/client.ts
   whatsapp-service/src/ai-handler.ts  → web/lib/whatsapp/ai-handler.ts
   whatsapp-service/src/morning-briefing.ts → web/lib/whatsapp/scheduler.ts
   whatsapp-service/src/tools/         → web/lib/whatsapp/tools/
   whatsapp-service/src/notification-log.ts → web/lib/whatsapp/notification-log.ts
   ```

2. **统一 import 路径**：用 web/ 已有的 `@/lib/supabase/admin`、`@/lib/ai/unified-client` 替代 whatsapp-service 自己的 client

3. **删除重复代码**：whatsapp-service 的 Supabase client、OpenAI client、prompt 全部指向 web/ 已有的

4. **合并 API routes**：
   ```
   whatsapp-service Express routes → web/app/api/whatsapp/route.ts（已存在，改为直接调用 lib/）
   ```

5. **启动 worker**：在 `web/instrumentation.ts` 中启动 WhatsApp 后台进程

### Phase 2：Docker 化（1 小时）

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY web/package*.json ./
RUN npm ci --production
COPY web/ ./
RUN npm run build
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
```

### Phase 3：Railway 部署（30 分钟）

1. 创建 Railway 项目
2. 连接 GitHub repo
3. 设置 root directory = `web/`
4. 配置环境变量
5. 绑定 at.actuaryhelp.com 域名（CNAME 改指向 Railway）

### Phase 4：清理（30 分钟）

1. 删除 `whatsapp-service/` 目录
2. 更新 README
3. 更新 CLAUDE.md

---

## 长期演进

| 阶段 | 时间 | 变化 |
|------|------|------|
| 现在 | 今天 | Railway 一体化部署 |
| 用户增长到 100+ | 2-3 个月 | 考虑迁移到 Meta Business API（方案 D） |
| 用户增长到 1000+ | 6 个月 | Baileys → Meta API，K8s 或 ECS 部署 |

Baileys 适合早期（免费、快速、self-chat），Meta API 适合规模化（稳定、合规、收费）。

---

## 环境变量（合并后，一套）

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# DeepSeek (chat)
DEEPSEEK_API_KEY=...

# SiliconFlow (vision)
SILICONFLOW_API_KEY=...
LLM_VISION_MODEL=Qwen/Qwen3-VL-8B-Instruct

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Token encryption
TOKEN_ENCRYPTION_KEY=...

# App
NEXT_PUBLIC_APP_URL=https://at.actuaryhelp.com
PORT=3000

# WhatsApp
WA_SESSIONS_PATH=/data/.wa-sessions
```

---

## 风险

| 风险 | 概率 | 缓解 |
|------|------|------|
| Railway 宕机 | 低 | 99.9% SLA，自动重启 |
| Baileys 连接断开 | 中 | 自动重连逻辑已有 |
| 容器重启丢 session | 中 | 持久化存储 or Supabase Storage |
| 月费增长 | 低 | 初期 $5/月，流量大了再说 |
