'use client'

import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Check, MessageSquare, Mail, Settings, Send, Calendar, Users, Plane, BarChart3, Clock, Search } from 'lucide-react'
import Link from 'next/link'

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
}

function StepNumber({ n }: { n: number }) {
  return (
    <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
      {n}
    </div>
  )
}

function SubStep({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm text-slate-700">
      <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

const dashboardPages = [
  { name: 'Today', desc: 'Daily overview: commitments, schedule timeline, agent status', icon: Clock },
  { name: 'Calendar', desc: '4-layer unified calendar: work + family + commitments + trips', icon: Calendar },
  { name: 'Inbox', desc: 'Unified mailbox: Gmail + WhatsApp messages with search and filters', icon: Mail },
  { name: 'People', desc: 'Contact management: VIP tags, interaction frequency, relationship temperature', icon: Users },
  { name: 'Trips', desc: 'Trip management: pre-trip brief, landing recommendations, receipt tracking', icon: Plane },
  { name: 'Insights', desc: 'Weekly report: commitment completion rate, relationship health, travel spend', icon: BarChart3 },
  { name: 'Settings', desc: 'Account, WhatsApp, timezone, language, AI model configuration', icon: Settings },
]

const chatExamples = [
  { cmd: 'What\'s on my schedule today?', desc: 'Sophia checks your Google Calendar and lists today\'s meetings with times and locations.' },
  { cmd: 'Any overdue commitments?', desc: 'Lists promises you made but haven\'t fulfilled, sorted by urgency.' },
  { cmd: 'Help me reply to David\'s email', desc: 'Finds David\'s latest email and drafts a contextual reply. You confirm, Sophia sends.' },
  { cmd: 'Prepare for my Tokyo trip next week', desc: 'Compiles flights, hotel, meetings, cultural tips, and restaurant recommendations.' },
  { cmd: '[Send a photo of a receipt]', desc: 'Auto-recognizes amount, merchant, currency, and category. Links to your current trip.' },
  { cmd: 'Remind me to send Lisa the proposal by Friday', desc: 'Creates a task with deadline. Sophia reminds you before it\'s due.' },
]

const quickActions = [
  { cmd: 'done a3b7', desc: 'Mark commitment as completed' },
  { cmd: 'draft a3b7', desc: 'Auto-draft a reply email' },
  { cmd: 'postpone a3b7', desc: 'Extend deadline by 7 days' },
  { cmd: 'nudge a3b7', desc: 'Generate a polite follow-up email' },
]

export default function GuidePage() {
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
          <Link href="/intro" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
            About
          </Link>
          <Link href="/login" className="text-sm font-medium text-white bg-primary px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
            Try it
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pb-20">
        {/* Hero */}
        <motion.section className="py-12 text-center" {...fadeUp}>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">
            Getting Started with Sophia
          </h1>
          <p className="text-slate-600">
            From login to your first Sophia conversation in 5 minutes.
          </p>
        </motion.section>

        {/* Step 1: Login */}
        <motion.section className="py-8" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={1} />
            <h2 className="text-xl font-bold text-slate-900">Open the website</h2>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 ml-11 space-y-3">
            <SubStep>Open your browser (Chrome, Safari, or Edge)</SubStep>
            <SubStep>Go to <strong className="font-mono text-primary">https://at.actuaryhelp.com</strong></SubStep>
            <SubStep>You will see Sophia's login page with two buttons: "Sign in with Google" and "Sign in with Microsoft"</SubStep>
          </div>
        </motion.section>

        {/* Step 2: Sign in */}
        <motion.section className="py-8" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={2} />
            <h2 className="text-xl font-bold text-slate-900">Sign in</h2>
          </div>
          <div className="ml-11 space-y-4">
            {/* Option A */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold">A</span>
                Use your own Google account (recommended)
              </h3>
              <div className="space-y-2">
                <SubStep>Click <strong>"Sign in with Google"</strong></SubStep>
                <SubStep>Select your work email on the Google login page</SubStep>
                <SubStep>Google will show a permission page: "Sophia requests access to your Gmail and Calendar"</SubStep>
                <SubStep>Click <strong>"Allow"</strong></SubStep>
                <SubStep>You're in! Page redirects to Sophia automatically</SubStep>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                You can revoke access anytime at https://myaccount.google.com/permissions
              </p>
            </div>

            {/* Option B */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-xs font-bold">B</span>
                Use our demo account
              </h3>
              <p className="text-sm text-slate-600 mb-3">If you don't want to use your own email:</p>
              <div className="space-y-2">
                <SubStep>Click <strong>"Sign in with Google"</strong></SubStep>
                <SubStep>On the Google login page, enter email: <strong className="font-mono">aiat.actuaryhelp@gmail.com</strong></SubStep>
                <SubStep>Enter password: <strong className="font-mono">AIAT@actuaryhelp.com</strong></SubStep>
                <SubStep>Click "Next" then click "Allow"</SubStep>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Step 3: Onboarding */}
        <motion.section className="py-8" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={3} />
            <h2 className="text-xl font-bold text-slate-900">Initial setup</h2>
          </div>
          <div className="ml-11 space-y-4">
            <p className="text-sm text-slate-600">First-time login takes you through a quick setup with three sections:</p>

            {/* 3.1 Email */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" /> Email confirmation
              </h3>
              <div className="space-y-2">
                <SubStep>Your login email appears at the top with a green checkmark ✓</SubStep>
                <SubStep>This email is already connected — Sophia can read your inbox and calendar</SubStep>
                <SubStep>Optionally click "Add another email" if you have multiple work accounts</SubStep>
              </div>
            </div>

            {/* 3.2 WhatsApp */}
            <div className="bg-white rounded-2xl border border-primary/30 p-6">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" /> Connect WhatsApp (required)
              </h3>
              <p className="text-sm text-slate-600 mb-3">This is the key step. After binding, you can chat with Sophia directly in WhatsApp.</p>
              <div className="space-y-2">
                <SubStep>Enter your phone number with country code (e.g. <strong>+65 8012 3456</strong>)</SubStep>
                <SubStep>Click <strong>"Connect"</strong></SubStep>
                <SubStep>The page displays an <strong>8-digit pairing code</strong> (e.g. A3B7-K9M2)</SubStep>
                <SubStep>Pick up your phone, open <strong>WhatsApp</strong></SubStep>
                <SubStep>Tap the <strong>three dots ⋮</strong> (Android) or <strong>Settings</strong> (iPhone)</SubStep>
                <SubStep>Tap <strong>"Linked Devices"</strong></SubStep>
                <SubStep>Tap <strong>"Link a Device"</strong></SubStep>
                <SubStep>Select <strong>"Link with phone number"</strong></SubStep>
                <SubStep>Enter the <strong>8-digit pairing code</strong> shown on the Sophia page</SubStep>
                <SubStep>Wait 3-5 seconds, your phone will confirm "Linked"</SubStep>
                <SubStep>Back on Sophia, WhatsApp status turns green ✓</SubStep>
              </div>
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>Privacy:</strong> Sophia only reads messages you send to yourself (self-chat). Your private conversations with others are never accessed.
                </p>
              </div>
            </div>

            {/* 3.3 Scan */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" /> Scan emails
              </h3>
              <div className="space-y-2">
                <SubStep>After WhatsApp is connected, the <strong>"Scan Emails & Discover Commitments"</strong> button lights up</SubStep>
                <SubStep>Click it — Sophia scans your last 7 days of emails</SubStep>
                <SubStep>The page shows discovered commitments in real-time (yours and others')</SubStep>
                <SubStep>When done, click <strong>"Enter Sophia"</strong> to enter the dashboard</SubStep>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Step 4: Settings */}
        <motion.section className="py-8" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={4} />
            <h2 className="text-xl font-bold text-slate-900">Set timezone and daily brief</h2>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 ml-11 space-y-2">
            <SubStep>Click <strong>Settings</strong> in the left sidebar</SubStep>
            <SubStep>Set your <strong>Timezone</strong> (e.g. Asia/Singapore)</SubStep>
            <SubStep>Set <strong>Daily Brief Time</strong> (recommended: 08:00)</SubStep>
            <SubStep>Sophia will push a daily brief via WhatsApp at this time every morning</SubStep>
          </div>
        </motion.section>

        {/* Step 5: Chat */}
        <motion.section className="py-8" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={5} />
            <h2 className="text-xl font-bold text-slate-900">Chat with Sophia on WhatsApp</h2>
          </div>
          <div className="ml-11 space-y-4">
            <p className="text-sm text-slate-600">
              Open WhatsApp on your phone. Find your own chat (saved messages / message yourself). Send a message:
            </p>
            <div className="space-y-2">
              {chatExamples.map(e => (
                <div key={e.cmd} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <Send className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 font-mono">{e.cmd}</p>
                      <p className="text-xs text-slate-500 mt-1">{e.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-sm text-slate-900 mb-3">Quick actions</h3>
              <p className="text-xs text-slate-600 mb-3">
                Sophia's commitment reminders include a short ID (e.g. <span className="font-mono">a3b7</span>). Reply with:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map(a => (
                  <div key={a.cmd} className="bg-white rounded-lg p-3 border border-slate-200">
                    <p className="text-sm font-mono font-medium text-primary">{a.cmd}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{a.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Step 6: Daily Brief */}
        <motion.section className="py-8" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={6} />
            <h2 className="text-xl font-bold text-slate-900">Morning brief</h2>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 ml-11">
            <p className="text-sm text-slate-700 mb-3">
              Every morning at your set time, Sophia pushes a brief via WhatsApp (starts with 🍎):
            </p>
            <div className="space-y-2">
              <SubStep>The 1-2 most important things today (not a list of everything — a judgment call)</SubStep>
              <SubStep>Overdue commitments you promised but haven't delivered</SubStep>
              <SubStep>Emails that need your reply</SubStep>
              <SubStep>Sophia's recommended action (e.g. a draft reply attached)</SubStep>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              If nothing important is happening, Sophia says "Clear day, focus on your work" and doesn't pad the message.
            </p>
          </div>
        </motion.section>

        {/* Step 7: Dashboard */}
        <motion.section className="py-8" {...fadeUp}>
          <div className="flex items-center gap-3 mb-4">
            <StepNumber n={7} />
            <h2 className="text-xl font-bold text-slate-900">Explore the dashboard</h2>
          </div>
          <div className="ml-11 grid grid-cols-1 md:grid-cols-2 gap-3">
            {dashboardPages.map(p => (
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
          <h2 className="text-xl font-bold text-slate-900 mb-4">FAQ</h2>
          <div className="space-y-3">
            {[
              { q: 'Pairing code not working?', a: 'Make sure your WhatsApp is the latest version. Pairing codes expire after ~2 minutes. Go back to Sophia and click "Connect" again for a new code.' },
              { q: 'Sophia not replying on WhatsApp?', a: 'Check two things: (1) Settings → "Sophia AI Assistant" toggle is ON. (2) You must send messages in your own chat (self-chat), not to another contact.' },
              { q: 'Can I use Outlook?', a: 'Yes. On the login page, click "Sign in with Microsoft" and authorize with your Outlook account.' },
              { q: 'Is my data safe?', a: 'All data is stored in encrypted databases. WhatsApp uses end-to-end encryption — messages never pass through third-party servers. You can export or delete your data anytime in Settings.' },
              { q: 'How to disconnect WhatsApp?', a: 'Two ways: (1) Sophia Settings → WhatsApp → "Disconnect". (2) On your phone: WhatsApp → Settings → Linked Devices → remove the Sophia device.' },
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
            Start using Sophia <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-sm text-slate-400 mt-3">Free to start. No credit card required.</p>
        </motion.section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        Sophia by Actuaryhelp &middot; Singapore &middot; Contact: sophie@actuaryhelp.com
      </footer>
    </div>
  )
}
