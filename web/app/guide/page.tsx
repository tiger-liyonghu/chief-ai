'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Check, MessageSquare, Shield } from 'lucide-react'
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

export default function GuidePage() {
  const [lang, setLang] = useState<'zh' | 'en'>('zh')
  const L = (zh: string, en: string) => t(zh, en, lang)

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-3xl mx-auto">
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
          <Link href="/login" className="text-sm font-medium text-white bg-primary px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
            {L('立即体验', 'Try it')}
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pb-20">
        {/* Hero */}
        <motion.section className="py-10 text-center" {...fadeUp}>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {L('两步开始使用 Sophia', 'Get started in 2 steps')}
          </h1>
          <p className="text-slate-500">
            {L('登录 + 绑定 WhatsApp，2 分钟搞定。', 'Login + connect WhatsApp. Takes 2 minutes.')}
          </p>
        </motion.section>

        {/* Step 1: Login */}
        <motion.section className="py-6" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={1} />
            <h2 className="text-xl font-bold text-slate-900">{L('登录', 'Sign in')}</h2>
          </div>
          <div className="ml-11 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="space-y-1">
                <SubStep>
                  {L('打开', 'Open')} <strong className="font-mono text-primary">https://at.actuaryhelp.com</strong>
                </SubStep>
                <SubStep>{L('点击「使用 Google 登录」', 'Click "Sign in with Google"')}</SubStep>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-3">{L('你可以用自己的 Gmail 登录，也可以用我们的测试账号体验：', 'You can use your own Gmail, or try our demo account:')}</p>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-xs text-slate-400">{L('邮箱', 'Email')}</span>
                      <p className="font-mono font-medium text-slate-800">aiat.actuaryhelp@gmail.com</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">{L('密码', 'Password')}</span>
                      <p className="font-mono font-medium text-slate-800">AIAT@actuaryhelp1</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Google login detailed steps - Advanced warning */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-2">{L('Google 登录时会有一个额外确认步骤：', 'Google login has an extra confirmation step:')}</p>
                <div className="space-y-1 text-sm">
                  <SubStep>{L('输入邮箱和密码后，Google 会显示安全提示页面', 'After entering email and password, Google shows a security prompt')}</SubStep>
                  <SubStep>
                    {L(
                      '点击左下角「Advanced / 高级」',
                      'Click "Advanced" at bottom left'
                    )}
                  </SubStep>
                  <SubStep>
                    {L(
                      '点击「Go to actuaryhelp.com (unsafe) / 前往 actuaryhelp.com（不安全）」',
                      'Click "Go to actuaryhelp.com (unsafe)"'
                    )}
                  </SubStep>
                  <SubStep>{L('点击「Continue / 继续」，完成授权', 'Click "Continue" to finish authorization')}</SubStep>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {L('这是 Google 对新应用的标准验证流程，Sophia 不会存储你的 Google 密码。', 'This is Google\'s standard verification for new apps. Sophia never stores your Google password.')}
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Step 2: WhatsApp */}
        <motion.section className="py-6" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={2} />
            <h2 className="text-xl font-bold text-slate-900">{L('绑定 WhatsApp', 'Connect WhatsApp')}</h2>
          </div>
          <div className="ml-11 space-y-4">
            <div className="bg-white rounded-xl border border-primary/30 p-5">
              {/* On Sophia */}
              <h3 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                {L('在 Sophia 网页上', 'On Sophia')}
              </h3>
              <div className="space-y-1">
                <SubStep>{L('进入 Settings（设置）→ WhatsApp', 'Go to Settings → WhatsApp')}</SubStep>
                <SubStep>{L('输入手机号（带国家码，如 +65 9123 4567）', 'Enter phone number with country code (e.g. +65 9123 4567)')}</SubStep>
                <SubStep>{L('点击「Connect」，页面显示一个 8 位配对码', 'Click "Connect", an 8-digit pairing code appears')}</SubStep>
              </div>

              {/* On phone */}
              <h3 className="font-semibold text-sm text-slate-900 mt-5 mb-3 flex items-center gap-2">
                <span className="text-lg">📱</span>
                {L('在手机 WhatsApp 上', 'On your phone')}
              </h3>
              <div className="space-y-1">
                <SubStep>{L('设置 → 关联设备 → 关联新设备', 'Settings → Linked Devices → Link a Device')}</SubStep>
                <SubStep>{L('选择「用手机号关联」', 'Select "Link with phone number"')}</SubStep>
                <SubStep>{L('输入 Sophia 页面上的 8 位配对码', 'Enter the 8-digit code from Sophia')}</SubStep>
                <SubStep>{L('等几秒，Sophia 页面自动显示「已连接」', 'Wait a few seconds, Sophia shows "Connected"')}</SubStep>
                <SubStep>{L('Sophia 会在 WhatsApp 里主动发一条问候消息，说明绑定成功', 'Sophia will send a welcome message in WhatsApp to confirm the connection')}</SubStep>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-slate-400 px-1">
              <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{L('Sophia 只读取你发给自己的消息，不会读取你和其他人的聊天。', 'Sophia only reads messages you send to yourself. It never accesses your chats with others.')}</span>
            </div>
          </div>
        </motion.section>

        {/* Done */}
        <motion.section className="py-10 text-center" {...fadeUp}>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 mb-6">
            <p className="text-2xl mb-2">✅</p>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {L('搞定！', 'You\'re all set!')}
            </h3>
            <p className="text-sm text-slate-600">
              {L(
                '现在打开 WhatsApp，给自己发一条消息，Sophia 会回复你。',
                'Now open WhatsApp, send a message to yourself, and Sophia will reply.'
              )}
            </p>
          </div>

          <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 text-lg">
            {L('开始使用 Sophia', 'Start using Sophia')} <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        Sophia by Actuaryhelp &middot; Singapore &middot; sophie@actuaryhelp.com
      </footer>
    </div>
  )
}
