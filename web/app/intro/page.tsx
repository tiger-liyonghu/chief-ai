'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Mail, Calendar, MessageSquare, Plane, Heart, ArrowRight, CheckCircle2, Clock, Users } from 'lucide-react'
import Link from 'next/link'

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
}

const t = (zh: string, en: string, lang: 'zh' | 'en') => lang === 'zh' ? zh : en

export default function IntroPage() {
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
          <Link href="/guide" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
            {L('使用指南', 'Guide')}
          </Link>
          <Link href="/login" className="text-sm font-medium text-white bg-primary px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
            {L('立即体验', 'Try it')}
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pb-20">
        {/* Hero */}
        <motion.section className="py-16 text-center" {...fadeUp}>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            {L('Sophia — 你的 AI 幕僚长', 'Sophia — Your AI Chief of Staff')}
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            {L(
              '连接你的邮箱、日历和 WhatsApp，自动追踪每一个承诺，管好每一次出差。像一个跟了你三年的秘书，但 24 小时在线。',
              'Connects your email, calendar, and WhatsApp. Automatically tracks every commitment and manages every trip. Like a secretary who has worked with you for three years — but available 24/7.'
            )}
          </p>
          <div className="flex items-center justify-center gap-3 mt-8">
            <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
              {L('免费开始', 'Start Free')} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/guide" className="inline-flex items-center gap-2 px-6 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors">
              {L('查看使用指南', 'Setup Guide')}
            </Link>
          </div>
        </motion.section>

        {/* Problem */}
        <motion.section className="py-8" {...fadeUp}>
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {L('你有没有遇到过这些问题？', 'Sound familiar?')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                L('邮件里答应了客户的事，忙起来就忘了', 'Promised a client something in an email, then forgot about it'),
                L('出差回来，一堆发票不知道怎么整理', 'Came back from a trip with scattered receipts everywhere'),
                L('日历排满了，但最重要的事情反而没时间做', 'Calendar is packed, but the most important things get squeezed out'),
              ].map((problem, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700">
                  {problem}
                </div>
              ))}
            </div>
            <p className="text-slate-600 mt-4 text-sm">
              {L(
                'Sophia 帮你解决这些问题。不需要学新工具，直接在 WhatsApp 里跟她说就行。',
                'Sophia solves these. No new tools to learn — just talk to her in WhatsApp.'
              )}
            </p>
          </div>
        </motion.section>

        {/* What Sophia Does */}
        <motion.section className="py-8" {...fadeUp}>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            {L('Sophia 能帮你做什么', 'What Sophia Does')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: CheckCircle2, color: 'text-emerald-500',
                title: L('承诺追踪', 'Commitment Tracking'),
                desc: L(
                  '自动从邮件中提取你答应别人的事和别人答应你的事，到期前提醒，不让任何承诺落空。',
                  'Automatically extracts promises from emails — yours and theirs. Reminds you before deadlines. Nothing falls through the cracks.'
                ),
              },
              {
                icon: Plane, color: 'text-teal-500',
                title: L('出差管理', 'Trip Management'),
                desc: L(
                  '出发前推送行前简报，落地时推荐餐厅，随时拍照记发票，回来后自动生成报销单。',
                  'Pre-trip briefs before departure, restaurant picks on landing, snap receipts anytime, auto-generated expense reports when you return.'
                ),
              },
              {
                icon: Clock, color: 'text-blue-500',
                title: L('每日简报', 'Daily Brief'),
                desc: L(
                  '每天早上通过 WhatsApp 告诉你：今天最重要的 1-2 件事、逾期的承诺、需要回复的邮件。',
                  'Every morning via WhatsApp: the 1-2 most important things today, overdue commitments, emails that need your reply.'
                ),
              },
              {
                icon: Mail, color: 'text-indigo-500',
                title: L('邮件草稿', 'Email Drafts'),
                desc: L(
                  '跟 Sophia 说「帮我回 David 的邮件」，她找到邮件、理解上下文、草拟回复，你确认后发送。',
                  'Tell Sophia "reply to David\'s email" — she finds it, understands the context, drafts a reply. You confirm, she sends.'
                ),
              },
              {
                icon: Calendar, color: 'text-purple-500',
                title: L('日历管理', 'Calendar Management'),
                desc: L(
                  '四层统一视图：工作会议、家庭活动、承诺截止日、出差行程，一眼看清全局。',
                  '4-layer unified view: work meetings, family events, commitment deadlines, travel schedules — the full picture at a glance.'
                ),
              },
              {
                icon: Heart, color: 'text-pink-500',
                title: L('家庭时间保护', 'Family Time Protection'),
                desc: L(
                  '孩子的活动和家庭聚会是硬约束，工作不能覆盖。发现冲突时主动提醒并建议替代时间。',
                  'Kids\' activities and family time are hard constraints — work can\'t override them. Flags conflicts and suggests alternatives.'
                ),
              },
            ].map(f => (
              <div key={f.title} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
                <f.icon className={`w-6 h-6 ${f.color} shrink-0 mt-0.5`} />
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">{f.title}</h3>
                  <p className="text-sm text-slate-600">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* How It Works */}
        <motion.section className="py-8" {...fadeUp}>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            {L('怎么用', 'How It Works')}
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <div className="flex flex-col md:flex-row gap-6">
              {[
                { n: '1', icon: '🔐', title: L('Google 登录', 'Sign in with Google'), desc: L('一键授权，连接你的 Gmail 和日历', 'One-click authorization, connects your Gmail and Calendar') },
                { n: '2', icon: '📱', title: L('绑定 WhatsApp', 'Connect WhatsApp'), desc: L('输入手机号，输入配对码，30 秒完成', 'Enter your phone number, type a pairing code, done in 30 seconds') },
                { n: '3', icon: '💬', title: L('开始对话', 'Start Chatting'), desc: L('在 WhatsApp 里给自己发消息，Sophia 会回复', 'Send yourself a message on WhatsApp, Sophia replies') },
              ].map(step => (
                <div key={step.n} className="flex-1 text-center">
                  <div className="text-3xl mb-2">{step.icon}</div>
                  <div className="w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-2">{step.n}</div>
                  <h3 className="font-semibold text-slate-900 mb-1 text-sm">{step.title}</h3>
                  <p className="text-xs text-slate-500">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* WhatsApp Examples */}
        <motion.section className="py-8" {...fadeUp}>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            {L('在 WhatsApp 里你可以这样说', 'What You Can Say in WhatsApp')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { cmd: L('今天有什么安排？', "What's on my schedule today?"), desc: L('查看今日会议和待办', 'See today\'s meetings and to-dos') },
              { cmd: L('有什么逾期的事？', 'Any overdue commitments?'), desc: L('列出你答应但还没做的事', 'Lists promises you haven\'t fulfilled') },
              { cmd: L('帮我回 David 的邮件', "Reply to David's email"), desc: L('找到邮件，草拟回复', 'Finds the email, drafts a reply') },
              { cmd: L('下周东京出差帮我准备', 'Prep for my Tokyo trip next week'), desc: L('航班、酒店、会议、餐厅一站整理', 'Flights, hotel, meetings, restaurants — all in one') },
              { cmd: L('[拍一张发票发过去]', '[Send a photo of a receipt]'), desc: L('自动识别金额、商户、币种', 'Auto-recognizes amount, merchant, currency') },
              { cmd: L('提醒我周五前给 Lisa 发方案', 'Remind me to send Lisa the proposal by Friday'), desc: L('到期前 WhatsApp 提醒', 'WhatsApp reminder before deadline') },
            ].map(e => (
              <div key={e.cmd} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
                <MessageSquare className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{e.cmd}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{e.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* CTA */}
        <motion.section className="py-12 text-center" {...fadeUp}>
          <div className="bg-primary/5 rounded-2xl p-10">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {L('2 分钟设置，免费使用', 'Set up in 2 minutes. Free to use.')}
            </h2>
            <p className="text-slate-600 mb-6 text-sm">
              {L('用自己的 Gmail 登录，或使用测试账号体验：', 'Sign in with your Gmail, or try our demo account:')}
            </p>
            <div className="inline-block bg-white border border-slate-200 rounded-xl p-4 text-left text-sm mb-6">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                <div>
                  <span className="text-xs text-slate-400">{L('邮箱', 'Email')}</span>
                  <p className="font-mono text-slate-800">aiat.actuaryhelp@gmail.com</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">{L('密码', 'Password')}</span>
                  <p className="font-mono text-slate-800">AIAT@actuaryhelp1</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 text-lg">
                {L('开始使用', 'Get Started')} <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/guide" className="inline-flex items-center gap-2 px-6 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors">
                {L('使用指南', 'Setup Guide')}
              </Link>
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        Sophia by Actuaryhelp &middot; Singapore &middot; sophie@actuaryhelp.com
      </footer>
    </div>
  )
}
