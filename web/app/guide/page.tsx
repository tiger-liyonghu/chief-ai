'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Check, MessageSquare, Mail, Settings, Send, Calendar, Users, Plane, BarChart3, Clock, Search, Shield } from 'lucide-react'
import Link from 'next/link'

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
}

const t = (zh: string, en: string, lang: 'zh' | 'en') => lang === 'zh' ? zh : en

function StepNumber({ n }: { n: number }) {
  return (
    <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
      {n}
    </div>
  )
}

function SubStep({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-sm text-slate-700 py-1">
      <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function ScreenShot({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{title}</div>
      <p className="text-sm text-slate-700">{desc}</p>
    </div>
  )
}

export default function GuidePage() {
  const [lang, setLang] = useState<'zh' | 'en'>('zh')
  const L = (zh: string, en: string) => t(zh, en, lang)

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-slate-900">Sophia</span>
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className="text-xs font-medium px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
          <Link href="/intro" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
            {L('产品介绍', 'About')}
          </Link>
          <Link href="/login" className="text-sm font-medium text-white bg-primary px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
            {L('立即体验', 'Try it')}
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pb-20">
        {/* Hero */}
        <motion.section className="py-12 text-center" {...fadeUp}>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">
            {L('Sophia 使用指南', 'Getting Started with Sophia')}
          </h1>
          <p className="text-slate-600">
            {L('从登录到跟 Sophia 对话，5 分钟完成。', 'From login to your first Sophia conversation in 5 minutes.')}
          </p>
          {/* Demo account - small text */}
          <div className="mt-4 inline-block bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
            <p className="text-xs text-slate-400">
              {L('测试账号', 'Demo account')}: <span className="font-mono text-slate-500">aiat.actuaryhelp@gmail.com</span> / <span className="font-mono text-slate-500">AIAT@actuaryhelp.com</span>
            </p>
          </div>
        </motion.section>

        {/* Step 1: Open */}
        <motion.section className="py-6" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={1} />
            <h2 className="text-xl font-bold text-slate-900">{L('打开网站', 'Open the website')}</h2>
          </div>
          <div className="ml-11 space-y-3">
            <ScreenShot
              title={L('你看到的页面', 'What you see')}
              desc={L(
                'Sophia 登录页。中间是产品标语，下方有两个按钮：「使用 Google 登录」和「使用 Microsoft 登录」。',
                'Sophia login page. Product tagline in the center, two buttons below: "Sign in with Google" and "Sign in with Microsoft".'
              )}
            />
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
              <SubStep>{L('打开浏览器（Chrome / Safari / Edge）', 'Open your browser (Chrome / Safari / Edge)')}</SubStep>
              <SubStep>{L('地址栏输入', 'Enter in the address bar')}: <strong className="font-mono text-primary">https://at.actuaryhelp.com</strong></SubStep>
            </div>
          </div>
        </motion.section>

        {/* Step 2: Login */}
        <motion.section className="py-6" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={2} />
            <h2 className="text-xl font-bold text-slate-900">{L('登录', 'Sign in')}</h2>
          </div>
          <div className="ml-11 space-y-4">
            {/* Option A */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold">A</span>
                {L('用自己的 Google 账号（推荐）', 'Use your own Google account (recommended)')}
              </h3>
              <div className="space-y-1">
                <SubStep>{L('点击「使用 Google 登录」', 'Click "Sign in with Google"')}</SubStep>
                <SubStep>{L('在 Google 页面选择你的工作邮箱', 'Select your work email on the Google page')}</SubStep>
                <SubStep>{L('Google 显示授权确认：「Sophia 请求访问你的 Gmail 和日历」', 'Google shows permission: "Sophia requests access to your Gmail and Calendar"')}</SubStep>
                <SubStep>{L('点击「允许」', 'Click "Allow"')}</SubStep>
                <SubStep>{L('自动跳转，进入 Sophia', 'Auto-redirects into Sophia')}</SubStep>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                {L('你可以随时在 Google 账号设置中撤销授权', 'You can revoke access anytime at myaccount.google.com/permissions')}
              </p>
            </div>
            {/* Option B */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-xs font-bold">B</span>
                {L('用测试账号体验', 'Use demo account')}
              </h3>
              <div className="space-y-1">
                <SubStep>{L('点击「使用 Google 登录」', 'Click "Sign in with Google"')}</SubStep>
                <SubStep>{L('邮箱输入', 'Enter email')}: <strong className="font-mono">aiat.actuaryhelp@gmail.com</strong></SubStep>
                <SubStep>{L('密码输入', 'Enter password')}: <strong className="font-mono">AIAT@actuaryhelp.com</strong></SubStep>
                <SubStep>{L('点「下一步」→ 点「允许」→ 自动进入 Sophia', 'Click "Next" → "Allow" → enters Sophia')}</SubStep>
              </div>
            </div>

            <ScreenShot
              title={L('登录后你看到的页面', 'What you see after login')}
              desc={L(
                '初始设置页面（Onboarding）。分三个区域：邮箱确认、WhatsApp 绑定、邮件扫描。',
                'Initial setup page (Onboarding). Three sections: email confirmation, WhatsApp binding, email scanning.'
              )}
            />
          </div>
        </motion.section>

        {/* Step 3: Onboarding - Email */}
        <motion.section className="py-6" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={3} />
            <h2 className="text-xl font-bold text-slate-900">{L('初始设置 — 邮箱确认', 'Setup — Email Confirmation')}</h2>
          </div>
          <div className="ml-11 space-y-3">
            <ScreenShot
              title={L('页面顶部', 'Top of the page')}
              desc={L(
                '你的登录邮箱显示在绿色方框中，带 ✓ 标记。表示 Sophia 已经连接你的 Gmail，可以读取邮件和日历。',
                'Your login email appears in a green box with ✓. This means Sophia has connected your Gmail and can read your emails and calendar.'
              )}
            />
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
              <SubStep>{L('确认邮箱地址正确', 'Confirm the email address is correct')}</SubStep>
              <SubStep>{L('如果有多个工作邮箱，可以点「Add another email (optional)」添加', 'If you have multiple work emails, click "Add another email (optional)" to add more')}</SubStep>
              <SubStep>{L('这一步是可选的，跳过也没关系', 'This step is optional, you can skip it')}</SubStep>
            </div>
          </div>
        </motion.section>

        {/* Step 4: Onboarding - WhatsApp */}
        <motion.section className="py-6" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={4} />
            <h2 className="text-xl font-bold text-slate-900">{L('初始设置 — 绑定 WhatsApp', 'Setup — Connect WhatsApp')}</h2>
          </div>
          <div className="ml-11 space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800 font-medium">
                {L('这是最关键的一步。绑定后你可以在 WhatsApp 里直接跟 Sophia 对话。', 'This is the most important step. After binding, you can chat with Sophia directly in WhatsApp.')}
              </p>
            </div>

            <ScreenShot
              title={L('页面中间', 'Middle of the page')}
              desc={L(
                'WhatsApp 区域。有一个手机号输入框和「Connect」按钮。输入手机号后会显示 8 位配对码。',
                'WhatsApp section. A phone number input field and "Connect" button. After entering your number, an 8-digit pairing code appears.'
              )}
            />

            <div className="bg-white rounded-xl border border-primary/30 p-5">
              <h3 className="font-semibold text-sm text-slate-900 mb-3">{L('在 Sophia 网页上', 'On the Sophia webpage')}</h3>
              <div className="space-y-1">
                <SubStep>{L('输入手机号码（带国家码，如 +65 8012 3456）', 'Enter your phone number with country code (e.g. +65 8012 3456)')}</SubStep>
                <SubStep>{L('点击「Connect」按钮', 'Click the "Connect" button')}</SubStep>
                <SubStep>{L('页面显示一个 8 位配对码（如 A3B7-K9M2）', 'Page shows an 8-digit pairing code (e.g. A3B7-K9M2)')}</SubStep>
              </div>

              <h3 className="font-semibold text-sm text-slate-900 mt-5 mb-3">{L('在手机上操作', 'On your phone')}</h3>
              <div className="space-y-1">
                <SubStep>{L('打开手机上的 WhatsApp', 'Open WhatsApp on your phone')}</SubStep>
                <SubStep>{L('点击右上角三个点 ⋮（安卓）或设置（iPhone）', 'Tap the three dots ⋮ (Android) or Settings (iPhone)')}</SubStep>
                <SubStep>{L('点击「Linked Devices / 关联设备」', 'Tap "Linked Devices"')}</SubStep>
                <SubStep>{L('点击「Link a Device / 关联设备」', 'Tap "Link a Device"')}</SubStep>
                <SubStep>{L('选择「Link with phone number / 用手机号关联」', 'Select "Link with phone number"')}</SubStep>
                <SubStep>{L('输入 Sophia 页面上显示的 8 位配对码', 'Enter the 8-digit pairing code shown on Sophia\'s page')}</SubStep>
                <SubStep>{L('等待 3-5 秒，手机提示「已关联」', 'Wait 3-5 seconds, phone confirms "Linked"')}</SubStep>
              </div>

              <h3 className="font-semibold text-sm text-slate-900 mt-5 mb-3">{L('确认成功', 'Confirm success')}</h3>
              <div className="space-y-1">
                <SubStep>{L('回到 Sophia 页面，WhatsApp 状态变为绿色 ✓', 'Back on Sophia, WhatsApp status turns green ✓')}</SubStep>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-slate-400 px-1">
              <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{L('隐私：Sophia 只读取你发给自己的消息（self-chat），你和别人的私聊不会被读取。', 'Privacy: Sophia only reads messages you send to yourself (self-chat). Private chats with others are never accessed.')}</span>
            </div>
          </div>
        </motion.section>

        {/* Step 5: Onboarding - Scan */}
        <motion.section className="py-6" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={5} />
            <h2 className="text-xl font-bold text-slate-900">{L('初始设置 — 扫描邮件', 'Setup — Scan Emails')}</h2>
          </div>
          <div className="ml-11 space-y-3">
            <ScreenShot
              title={L('页面底部按钮', 'Bottom of the page')}
              desc={L(
                'WhatsApp 绑定成功后，「Scan Emails & Discover Commitments」按钮亮起（蓝色）。点击后 Sophia 开始扫描你最近 7 天的邮件。',
                'After WhatsApp is connected, the "Scan Emails & Discover Commitments" button lights up (blue). Click it and Sophia scans your last 7 days of emails.'
              )}
            />
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
              <SubStep>{L('点击「Scan Emails & Discover Commitments」', 'Click "Scan Emails & Discover Commitments"')}</SubStep>
              <SubStep>{L('Sophia 实时显示发现的承诺（你答应的 / 对方答应的）', 'Sophia shows discovered commitments in real-time (yours and others\')')}</SubStep>
              <SubStep>{L('扫描完成后，显示发现的承诺总数', 'When done, shows total commitments found')}</SubStep>
              <SubStep>{L('点击「Enter Sophia」进入仪表盘', 'Click "Enter Sophia" to enter the dashboard')}</SubStep>
            </div>

            <ScreenShot
              title={L('扫描完成页面', 'Scan complete page')}
              desc={L(
                '显示发现的承诺数量（如「12 commitments discovered」），一个大按钮「Enter Sophia」引导你进入仪表盘。',
                'Shows number of commitments found (e.g. "12 commitments discovered"), with a big "Enter Sophia" button to enter the dashboard.'
              )}
            />
          </div>
        </motion.section>

        {/* Step 6: Settings */}
        <motion.section className="py-6" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={6} />
            <h2 className="text-xl font-bold text-slate-900">{L('设置时区和简报时间', 'Set timezone and daily brief')}</h2>
          </div>
          <div className="ml-11 space-y-3">
            <ScreenShot
              title={L('仪表盘 → 左侧导航 → Settings', 'Dashboard → Left sidebar → Settings')}
              desc={L(
                '设置页面。上方是账号信息，下方有时区选择器和每日简报时间设置。',
                'Settings page. Account info at top, timezone picker and daily brief time setting below.'
              )}
            />
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
              <SubStep>{L('点击左侧导航栏的「Settings / 设置」', 'Click "Settings" in the left sidebar')}</SubStep>
              <SubStep>{L('设置「Timezone / 时区」（如 Asia/Singapore）', 'Set "Timezone" (e.g. Asia/Singapore)')}</SubStep>
              <SubStep>{L('设置「Daily Brief Time / 每日简报时间」（建议 08:00）', 'Set "Daily Brief Time" (recommended: 08:00)')}</SubStep>
              <SubStep>{L('Sophia 每天在你设的时间通过 WhatsApp 推送当日重点', 'Sophia pushes daily highlights via WhatsApp at your set time')}</SubStep>
            </div>
          </div>
        </motion.section>

        {/* Step 7: Chat */}
        <motion.section className="py-6" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={7} />
            <h2 className="text-xl font-bold text-slate-900">{L('在 WhatsApp 里跟 Sophia 对话', 'Chat with Sophia on WhatsApp')}</h2>
          </div>
          <div className="ml-11 space-y-4">
            <ScreenShot
              title={L('在手机上', 'On your phone')}
              desc={L(
                '打开 WhatsApp → 找到「给自己的聊天」（saved messages / 发消息给自己）→ 发一条消息。',
                'Open WhatsApp → find "Message yourself" (saved messages) → send a message.'
              )}
            />
            <div className="space-y-2">
              {[
                { cmd: L('今天有什么安排？', 'What\'s on my schedule today?'), desc: L('调用 Google Calendar，列出今天的会议', 'Checks Google Calendar, lists today\'s meetings') },
                { cmd: L('有什么逾期的事？', 'Any overdue commitments?'), desc: L('列出你答应但没完成的承诺，按紧急度排序', 'Lists promises you made but haven\'t fulfilled, sorted by urgency') },
                { cmd: L('帮我回 David 的邮件', 'Help me reply to David\'s email'), desc: L('找到 David 最近的邮件，生成回复草稿', 'Finds David\'s latest email, generates a reply draft') },
                { cmd: L('下周东京出差帮我准备一下', 'Prepare for my Tokyo trip next week'), desc: L('整理航班、酒店、会议、文化提醒、餐厅推荐', 'Compiles flights, hotel, meetings, cultural tips, restaurant picks') },
                { cmd: L('[拍照发送一张发票]', '[Send a photo of a receipt]'), desc: L('自动识别金额、商户、币种、类目，归到对应出差行程', 'Auto-recognizes amount, merchant, currency, category, links to trip') },
                { cmd: L('提醒我周五前给 Lisa 发方案', 'Remind me to send Lisa the proposal by Friday'), desc: L('创建任务，到期前通过 WhatsApp 提醒', 'Creates a task, reminds via WhatsApp before deadline') },
              ].map(e => (
                <div key={e.cmd} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
                  <Send className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{e.cmd}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{e.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-sm text-slate-900 mb-2">{L('快捷操作', 'Quick actions')}</h3>
              <p className="text-xs text-slate-600 mb-3">
                {L(
                  'Sophia 的承诺提醒会附带短 ID（如 a3b7），直接回复：',
                  'Sophia\'s commitment reminders include a short ID (e.g. a3b7). Reply with:'
                )}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { cmd: L('完成 a3b7', 'done a3b7'), desc: L('标记完成', 'Mark complete') },
                  { cmd: L('起草 a3b7', 'draft a3b7'), desc: L('草拟回复邮件', 'Draft reply email') },
                  { cmd: L('延期 a3b7', 'postpone a3b7'), desc: L('延期 7 天', 'Extend 7 days') },
                  { cmd: L('催 a3b7', 'nudge a3b7'), desc: L('生成催促邮件', 'Generate follow-up') },
                ].map(a => (
                  <div key={a.cmd} className="bg-white rounded-lg p-3 border border-slate-200">
                    <p className="text-sm font-mono font-medium text-primary">{a.cmd}</p>
                    <p className="text-xs text-slate-500">{a.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Step 8: Morning Brief */}
        <motion.section className="py-6" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={8} />
            <h2 className="text-xl font-bold text-slate-900">{L('晨间简报', 'Morning Brief')}</h2>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 ml-11 space-y-2">
            <p className="text-sm text-slate-700 mb-3">
              {L(
                '每天你设定的时间，Sophia 通过 WhatsApp 推送一条简报（以 🍎 开头）：',
                'Every day at your set time, Sophia pushes a brief via WhatsApp (starts with 🍎):'
              )}
            </p>
            <SubStep>{L('今天最重要的 1-2 件事（给判断，不列清单）', 'The 1-2 most important things today (judgment, not a list)')}</SubStep>
            <SubStep>{L('逾期的承诺（你答应了但没做的）', 'Overdue commitments you promised but haven\'t delivered')}</SubStep>
            <SubStep>{L('需要回复的邮件', 'Emails that need your reply')}</SubStep>
            <SubStep>{L('Sophia 的行动建议（比如附上草拟的回复）', 'Sophia\'s recommended action (e.g. a draft reply attached)')}</SubStep>
            <p className="text-xs text-slate-400 mt-2">
              {L('没什么重要的事时，Sophia 会说「今天清净，安心做事」，不会凑数。', 'When nothing important, Sophia says "Clear day, focus on your work." No padding.')}
            </p>
          </div>
        </motion.section>

        {/* Step 9: Dashboard */}
        <motion.section className="py-6" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={9} />
            <h2 className="text-xl font-bold text-slate-900">{L('探索仪表盘', 'Explore the Dashboard')}</h2>
          </div>
          <div className="ml-11 grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { icon: Clock, name: L('今天 Today', 'Today'), desc: L('今日概览：承诺状态、日程时间线、Agent 工作状态', 'Daily overview: commitment status, schedule timeline, agent status') },
              { icon: Calendar, name: L('日历 Calendar', 'Calendar'), desc: L('四层统一日历：工作 + 家庭 + 承诺 + 出差', '4-layer calendar: work + family + commitments + travel') },
              { icon: Mail, name: L('收件箱 Inbox', 'Inbox'), desc: L('统一邮箱：Gmail + WhatsApp 消息，支持搜索和筛选', 'Unified inbox: Gmail + WhatsApp messages with search and filters') },
              { icon: Users, name: L('联系人 People', 'People'), desc: L('关系管理：VIP 标注、互动频率、关系温度', 'Relationship management: VIP tags, interaction frequency, temperature') },
              { icon: Plane, name: L('出差 Trips', 'Trips'), desc: L('出差管理：行前简报、落地推荐、发票追踪、报销汇总', 'Trip management: pre-trip brief, landing tips, receipt tracking, expense summary') },
              { icon: BarChart3, name: L('洞察 Insights', 'Insights'), desc: L('周报：承诺完成率、关系健康度、出差开支', 'Weekly report: commitment rate, relationship health, travel spend') },
              { icon: Settings, name: L('设置 Settings', 'Settings'), desc: L('账号、WhatsApp、时区、语言、AI 模型配置', 'Account, WhatsApp, timezone, language, AI model config') },
            ].map(p => (
              <div key={p.name} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <p.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-900">{p.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* FAQ */}
        <motion.section className="py-8" {...fadeUp}>
          <h2 className="text-xl font-bold text-slate-900 mb-4">{L('常见问题', 'FAQ')}</h2>
          <div className="space-y-3">
            {[
              {
                q: L('配对码输入后没反应？', 'Pairing code not working?'),
                a: L('确保手机 WhatsApp 是最新版本。配对码有效期约 2 分钟，过期后回到 Sophia 页面重新点「Connect」获取新码。', 'Make sure WhatsApp is the latest version. Codes expire after ~2 minutes. Click "Connect" again for a new code.'),
              },
              {
                q: L('Sophia 没有回复我的 WhatsApp 消息？', 'Sophia not replying on WhatsApp?'),
                a: L('检查两点：① Settings 里「Sophia AI Assistant」开关是否打开；② 消息必须发在「给自己的聊天」里，不是发给其他联系人。', 'Check two things: (1) "Sophia AI Assistant" toggle is ON in Settings. (2) Messages must be in your own chat (self-chat), not to another contact.'),
              },
              {
                q: L('可以用 Outlook 邮箱吗？', 'Can I use Outlook?'),
                a: L('可以。登录页点「使用 Microsoft 登录」，用 Outlook 账号授权即可。', 'Yes. Click "Sign in with Microsoft" on the login page and authorize with your Outlook account.'),
              },
              {
                q: L('我的数据安全吗？', 'Is my data safe?'),
                a: L('所有数据存储在加密数据库中。WhatsApp 使用端到端加密，消息不经过第三方服务器。你可以在 Settings 里随时导出或删除数据。', 'All data is stored in encrypted databases. WhatsApp uses end-to-end encryption. You can export or delete data anytime in Settings.'),
              },
              {
                q: L('测试完想断开 WhatsApp？', 'How to disconnect WhatsApp?'),
                a: L('两种方式：① Sophia Settings → WhatsApp → 「Disconnect」；② 手机 WhatsApp → Settings → Linked Devices → 删除 Sophia 设备。', 'Two ways: (1) Sophia Settings → WhatsApp → "Disconnect". (2) Phone WhatsApp → Settings → Linked Devices → remove the Sophia device.'),
              },
            ].map(faq => (
              <div key={faq.q} className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-sm text-slate-900">{faq.q}</h3>
                <p className="text-sm text-slate-600 mt-1">{faq.a}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* CTA */}
        <motion.section className="py-12 text-center" {...fadeUp}>
          <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 text-lg">
            {L('开始使用 Sophia', 'Start using Sophia')} <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-xs text-slate-400 mt-3">
            {L('测试账号', 'Demo')}: <span className="font-mono">aiat.actuaryhelp@gmail.com</span> / <span className="font-mono">AIAT@actuaryhelp.com</span>
          </p>
        </motion.section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        Sophia by Actuaryhelp &middot; Singapore &middot; sophie@actuaryhelp.com
      </footer>
    </div>
  )
}
