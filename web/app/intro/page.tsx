'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Mail, Calendar, MessageSquare, Plane, Heart, ArrowRight, Brain, Eye, Ear, Hand, Mic } from 'lucide-react'
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
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-3">
            {L(
              '一个有眼、耳、脑、心、手、嘴的 AI 助手。打通你的邮箱、日历和 WhatsApp，像一个跟了你三年的真人秘书一样，替你盯住每一个承诺、管好每一次出差。',
              'An AI assistant with eyes, ears, brain, heart, hands, and voice. Connects your email, calendar, and WhatsApp — like a real executive secretary who has worked with you for three years, tracking every promise and managing every trip.'
            )}
          </p>
          <div className="flex items-center justify-center gap-3 mt-8">
            <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
              {L('免费开始', 'Start Free')} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/guide" className="inline-flex items-center gap-2 px-6 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors">
              {L('查看使用指南', 'See how it works')}
            </Link>
          </div>
        </motion.section>

        {/* Vision: Collaborative Office */}
        <motion.section className="py-12" {...fadeUp}>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            {L('协同办公的未来', 'The Future of Collaborative Work')}
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-4">
            <p className="text-slate-700">
              {L(
                '高管每天在三个系统之间来回切换：Gmail 里答应了客户的事，日历上排了会议，WhatsApp 里约了饭局。这些信息散在三个地方，没有人帮你串起来。',
                'Executives switch between three systems daily: promises in Gmail, meetings in Calendar, dinner plans in WhatsApp. These live in three places, and nobody connects them.'
              )}
            </p>
            <p className="text-slate-700">
              {L(
                'Sophia 不是又一个待办工具。她是你的 AI 幕僚长 — 把邮箱、日历、通讯工具打通成一个统一的工作上下文，自动追踪承诺、主动提醒、替你草拟回复、保护你的家庭时间。',
                'Sophia is not another to-do app. She is your AI Chief of Staff — connecting email, calendar, and messaging into a unified work context, automatically tracking commitments, proactively reminding, drafting replies, and protecting your family time.'
              )}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              {[
                { icon: Mail, title: L('邮箱', 'Email'), desc: L('Gmail / Outlook 多账号接入，自动提取承诺', 'Multi-account Gmail / Outlook, auto-extract commitments') },
                { icon: Calendar, title: L('日历', 'Calendar'), desc: L('四层统一视图：工作+家庭+承诺+出差', '4-layer view: work + family + commitments + travel') },
                { icon: MessageSquare, title: L('WhatsApp', 'WhatsApp'), desc: L('原生对话交互，查日程建任务不切换 App', 'Native chat interface, check schedule and create tasks without switching apps') },
              ].map(f => (
                <div key={f.title} className="bg-slate-50 rounded-xl p-5 text-center">
                  <f.icon className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h3 className="font-semibold text-slate-900 mb-1">{f.title}</h3>
                  <p className="text-xs text-slate-600">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Sophia's Organs */}
        <motion.section className="py-12" {...fadeUp}>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {L('Sophia 的六大器官', 'Sophia\'s Six Organs')}
          </h2>
          <p className="text-slate-600 mb-6">
            {L(
              '不是一个只会聊天的 AI，而是一个有感知、有判断、有行动力的完整体系。',
              'Not just a chatbot — a complete system that perceives, judges, and acts.'
            )}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                emoji: '🧠', name: L('脑 Brain', 'Brain'),
                desc: L('三层记忆：工作记忆（当前对话）、情景记忆（重要事件）、行为模型（你的工作方式）。越用越懂你。', 'Three-layer memory: working memory (current conversation), episodic memory (key events), behavioral model (your work patterns). Gets smarter over time.'),
              },
              {
                emoji: '👀', name: L('眼 Eyes', 'Eyes'),
                desc: L('监控 10+ 种信号：承诺逾期、VIP 关系降温、日历冲突、出差前遗忘、邮件语气变化。', 'Monitors 10+ signals: overdue commitments, VIP relationship cooling, calendar conflicts, pre-trip oversights, email tone shifts.'),
              },
              {
                emoji: '👂', name: L('耳 Ears', 'Ears'),
                desc: L('感知你的情绪状态。深夜不催工作、忙的时候更简短、检测到焦虑先稳定情绪再说事。', 'Senses your emotional state. Doesn\'t push work late at night, keeps it brief when you\'re busy, stabilizes your mood before delivering news when stress is detected.'),
              },
              {
                emoji: '🫀', name: L('心 Heart', 'Heart'),
                desc: L('主动干预：发现 over-commit 提醒你、保护家庭时间不被覆盖、连续出差时关心一句「剩下的不急」。', 'Proactive intervention: warns when you over-commit, protects family time from being overridden, says "the rest can wait" when you\'ve been traveling non-stop.'),
              },
              {
                emoji: '🤲', name: L('手 Hands', 'Hands'),
                desc: L('12+ 种工具能力：查日程、草拟邮件、建任务、记发票、搜新闻、管联系人、出差推荐。说一句话就执行。', '12+ tool capabilities: check schedule, draft emails, create tasks, record receipts, search news, manage contacts, travel recommendations. One sentence and it\'s done.'),
              },
              {
                emoji: '👄', name: L('嘴 Mouth', 'Mouth'),
                desc: L('三面人格：秘书的执行力、谋士的判断力、老朋友的分寸感。克制、有立场、长记性、不邀功。', 'Three-sided personality: secretary\'s execution, advisor\'s judgment, old friend\'s tact. Restrained, opinionated, long memory, no credit-taking.'),
              },
            ].map(o => (
              <div key={o.name} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
                <span className="text-3xl shrink-0">{o.emoji}</span>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">{o.name}</h3>
                  <p className="text-sm text-slate-600">{o.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Travel Deep Dive */}
        <motion.section className="py-12" {...fadeUp}>
          <div className="bg-gradient-to-br from-teal-50 to-blue-50 border border-teal-200 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <Plane className="w-7 h-7 text-teal-600" />
              <h2 className="text-2xl font-bold text-slate-900">
                {L('出差好帮手', 'Your Travel Companion')}
              </h2>
            </div>
            <p className="text-slate-700 mb-6">
              {L(
                '出差是高管最痛的场景：时区变化、陌生城市、密集会议、发票散落。Sophia 从出差前到回来后，全程覆盖。',
                'Business travel is the hardest scenario: time zone changes, unfamiliar cities, packed meetings, scattered receipts. Sophia covers everything from pre-trip to post-trip.'
              )}
            </p>
            <div className="space-y-3">
              {[
                { stage: L('出差前', 'Before'), color: 'bg-blue-100 text-blue-700', desc: L('自动生成行前简报：航班、酒店、目的地会议、当地联系人、文化礼仪提醒', 'Auto-generates pre-trip brief: flights, hotel, meetings, local contacts, cultural etiquette tips') },
                { stage: L('落地时', 'Landing'), color: 'bg-teal-100 text-teal-700', desc: L('推送落地简报：当日安排、餐厅推荐（尊重饮食偏好）、交通建议、本地攻略', 'Pushes landing brief: today\'s schedule, restaurant picks (respecting dietary preferences), transport, local tips') },
                { stage: L('出差中', 'During'), color: 'bg-emerald-100 text-emerald-700', desc: L('随时查日程、找附近餐厅、拍照记发票（自动识别金额、商户、币种、类目）', 'Check schedule anytime, find nearby restaurants, snap receipts (auto-recognizes amount, merchant, currency, category)') },
                { stage: L('回来后', 'After'), color: 'bg-indigo-100 text-indigo-700', desc: L('自动整理差旅报销单（按类目分组、标注币种），发现缺少的发票主动提醒', 'Auto-compiles expense report (grouped by category, multi-currency), proactively reminds about missing receipts') },
              ].map(s => (
                <div key={s.stage} className="bg-white/80 rounded-xl p-4 flex gap-4 items-start">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${s.color}`}>{s.stage}</span>
                  <p className="text-sm text-slate-700">{s.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-500 mt-4">
              {L(
                'Sophia 记住你的偏好：座位选择、酒店品牌、饮食禁忌、常用航空公司。下次出差直接用。',
                'Sophia remembers your preferences: seat choice, hotel brand, dietary restrictions, preferred airlines. Next trip, it just works.'
              )}
            </p>
          </div>
        </motion.section>

        {/* Family */}
        <motion.section className="py-12" {...fadeUp}>
          <div className="bg-pink-50 border border-pink-200 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <Heart className="w-6 h-6 text-pink-500" />
              <h2 className="text-2xl font-bold text-slate-900">
                {L('家庭时间守护', 'Family Time Protection')}
              </h2>
            </div>
            <p className="text-slate-700">
              {L(
                'Sophia 维护一个独立的家庭日历层。孩子的钢琴课、家庭徒步、纪念日是「硬约束」——工作事件不能覆盖。如果有冲突，Sophia 主动标出并建议替代时间。',
                'Sophia maintains a separate family calendar layer. Piano lessons, family hikes, anniversaries are hard constraints — work events cannot override them. If there is a conflict, Sophia flags it and suggests alternatives.'
              )}
            </p>
          </div>
        </motion.section>

        {/* Why Travel Entry Point */}
        <motion.section className="py-12" {...fadeUp}>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            {L('为什么从出差切入？', 'Why Start with Travel?')}
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-4">
            <p className="text-slate-700">
              {L(
                '现有工具各管一段：携程管机票、Google Calendar 管日程、Expensify 管报销。没有人把整个出差流程串起来。',
                'Existing tools each handle one piece: Skyscanner for flights, Google Calendar for meetings, Expensify for receipts. Nobody connects the entire trip.'
              )}
            </p>
            <p className="text-slate-700">
              {L(
                'Sophia 从出差切入，但底层是邮箱+日历+通讯的统一 AI 层。出差验证了核心能力后，自然延伸到日常办公。',
                'Sophia enters through travel, but the foundation is a unified AI layer across email, calendar, and messaging. After travel proves the core capability, it naturally extends to daily office work.'
              )}
            </p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-primary/5 rounded-xl p-5">
                <div className="text-xs font-bold text-primary mb-2">{L('短期', 'SHORT TERM')}</div>
                <p className="text-sm text-slate-700">{L('出差场景做深做透，让用户体验到「AI 真的能帮我省时间」', 'Go deep on travel. Let users feel "AI actually saves me time."')}</p>
              </div>
              <div className="bg-primary/5 rounded-xl p-5">
                <div className="text-xs font-bold text-primary mb-2">{L('长期', 'LONG TERM')}</div>
                <p className="text-sm text-slate-700">{L('成为高管的 AI 幕僚长，管理所有工作上下文', 'Become the executive\'s AI Chief of Staff, managing all work context.')}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Try It */}
        <motion.section className="py-16 text-center" {...fadeUp}>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            {L('立即体验 Sophia', 'Try Sophia Now')}
          </h2>
          <p className="text-slate-600 mb-6">
            {L('用自己的 Google 账号登录，或使用测试账号：', 'Use your own Google account, or our demo account:')}
          </p>
          <div className="inline-block bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-sm mb-6">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
              <div>
                <span className="text-slate-500">{L('邮箱', 'Email')}:</span>{' '}
                <span className="font-mono text-slate-900">aiat.actuaryhelp@gmail.com</span>
              </div>
              <div>
                <span className="text-slate-500">{L('密码', 'Password')}:</span>{' '}
                <span className="font-mono text-slate-900">AIAT@actuaryhelp.com</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
              {L('登录', 'Login')} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/guide" className="inline-flex items-center gap-2 px-6 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors">
              {L('查看使用指南', 'Step-by-step guide')}
            </Link>
          </div>
        </motion.section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        Sophia by Actuaryhelp &middot; Singapore &middot; sophie@actuaryhelp.com
      </footer>
    </div>
  )
}
