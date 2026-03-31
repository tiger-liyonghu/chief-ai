'use client'

import { motion } from 'framer-motion'
import { Sparkles, Mail, Calendar, MessageSquare, Plane, Target, Heart, Users, Brain, PenTool, Search, BarChart3, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
}

const agents = [
  { name: 'Radar', desc: 'Monitors signals: overdue commitments, VIP relationship cooling, calendar conflicts', icon: Search },
  { name: 'Prep', desc: 'Pushes attendee background, email history, and last meeting notes 30 min before meetings', icon: Brain },
  { name: 'Ghostwriter', desc: 'Drafts email replies with context, supports formal / friendly / brief tones', icon: PenTool },
  { name: 'Closer', desc: 'Tracks every promise you made, auto-reminds when overdue with draft replies attached', icon: Target },
  { name: 'Weaver', desc: 'Maintains your relationship network, alerts when VIPs go cold (90+ days no contact)', icon: Users },
  { name: 'Travel Brain', desc: 'End-to-end trip management: briefings, recommendations, receipts, expense reports', icon: Plane },
  { name: 'Debrief', desc: 'Weekly insights: commitment completion rate, relationship health, travel spend', icon: BarChart3 },
]

const travelStages = [
  { stage: 'Before', desc: 'Auto-generates pre-trip brief: flights, hotel, meetings at destination, local contacts, cultural tips' },
  { stage: 'Landing', desc: 'Pushes landing brief: today\'s schedule, restaurant recommendations (respecting your dietary preferences), transport' },
  { stage: 'During', desc: 'Check schedule anytime, find nearby restaurants, record receipts (photo auto-recognizes amount, merchant, category)' },
  { stage: 'After', desc: 'Auto-compiles expense report (grouped by category, multi-currency), reminds you of missing receipts' },
]

export default function IntroPage() {
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
          <Link href="/guide" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
            Guide
          </Link>
          <Link href="/login" className="text-sm font-medium text-white bg-primary px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
            Try it
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pb-20">
        {/* Hero */}
        <motion.section className="py-16 text-center" {...fadeUp}>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Sophia — Your AI Chief of Staff
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
            Connects your email, calendar, and WhatsApp into one system. Automatically tracks every commitment. Takes care of everything when you travel.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
              Start Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/guide" className="inline-flex items-center gap-2 px-6 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors">
              See how it works
            </Link>
          </div>
        </motion.section>

        {/* Problem */}
        <motion.section className="py-12" {...fadeUp}>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">The Problem</h2>
          <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-4">
            <p className="text-slate-700">
              Executives and founders switch between three systems every day: promises made in Gmail, meetings in Calendar, dinner plans in WhatsApp. Nothing connects them.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              {[
                { num: '47%', desc: 'of reply-needed emails are forgotten' },
                { num: '3/10', desc: 'promises made in meetings go untracked' },
                { num: '4.5h', desc: 'per week spent on meeting prep that AI could automate' },
              ].map(s => (
                <div key={s.num} className="text-center p-4 bg-red-50 rounded-xl">
                  <div className="text-2xl font-bold text-red-600">{s.num}</div>
                  <div className="text-sm text-red-700 mt-1">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Core: Connected */}
        <motion.section className="py-12" {...fadeUp}>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Email + Calendar + WhatsApp, Connected</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Mail, title: 'Commitment Tracking', desc: 'Auto-extracts "I promised" and "they promised" from emails, with deadlines and urgency scoring' },
              { icon: Calendar, title: 'Calendar-Aware', desc: 'Checks family calendar conflicts before scheduling, adjusts reminders when you change time zones' },
              { icon: MessageSquare, title: 'WhatsApp Native', desc: 'Chat with Sophia directly in WhatsApp: check schedule, draft emails, create tasks, track commitments' },
            ].map(f => (
              <div key={f.title} className="bg-white rounded-xl border border-slate-200 p-6">
                <f.icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Travel Deep Dive */}
        <motion.section className="py-12" {...fadeUp}>
          <div className="flex items-center gap-3 mb-6">
            <Plane className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-slate-900">Business Travel — Deep Vertical</h2>
          </div>
          <p className="text-slate-600 mb-6">
            Travel is the hardest scenario for executives: time zone changes, unfamiliar cities, packed meetings, scattered receipts. Sophia covers the entire trip end-to-end.
          </p>
          <div className="space-y-3">
            {travelStages.map(s => (
              <div key={s.stage} className="bg-white rounded-xl border border-slate-200 p-5 flex gap-4">
                <div className="w-20 shrink-0">
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">{s.stage}</span>
                </div>
                <p className="text-sm text-slate-700">{s.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-500 mt-4">
            Sophia remembers your preferences: seat choice, hotel brand, dietary restrictions, preferred airlines. Next trip, it just works.
          </p>
        </motion.section>

        {/* 7 Agents */}
        <motion.section className="py-12" {...fadeUp}>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">7 Specialized Agents</h2>
          <p className="text-slate-600 mb-6">Not one generic chatbot. Seven agents, each with a specific job.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {agents.map(a => (
              <div key={a.name} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <a.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-900">{a.name}</h3>
                  <p className="text-xs text-slate-600 mt-0.5">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Family */}
        <motion.section className="py-12" {...fadeUp}>
          <div className="bg-pink-50 border border-pink-200 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <Heart className="w-6 h-6 text-pink-500" />
              <h2 className="text-2xl font-bold text-slate-900">Family Time Protection</h2>
            </div>
            <p className="text-slate-700">
              Sophia maintains a separate family calendar layer. Piano lessons, family hikes, anniversaries are <strong>hard constraints</strong> — work events cannot override them. If there is a conflict, Sophia flags it and suggests alternative times.
            </p>
          </div>
        </motion.section>

        {/* Why Travel First */}
        <motion.section className="py-12" {...fadeUp}>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Why Start with Travel?</h2>
          <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-4">
            <p className="text-slate-700">
              Existing tools handle one piece: Skyscanner for flights, Google Calendar for meetings, Expensify for receipts. Nobody connects the entire trip.
            </p>
            <p className="text-slate-700">
              Sophia enters through travel, but the foundation is <strong>a unified AI layer across email, calendar, and messaging</strong>. After travel proves the core capability, it naturally extends to daily office work: meeting prep, commitment tracking, relationship management, weekly reports.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-primary/5 rounded-xl p-4">
                <div className="text-xs font-bold text-primary mb-1">SHORT TERM</div>
                <p className="text-sm text-slate-700">Go deep on travel. Let users feel "AI actually saves me time."</p>
              </div>
              <div className="bg-primary/5 rounded-xl p-4">
                <div className="text-xs font-bold text-primary mb-1">LONG TERM</div>
                <p className="text-sm text-slate-700">Become the executive's AI chief of staff, managing all work context.</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Try It */}
        <motion.section className="py-16 text-center" {...fadeUp}>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Try Sophia</h2>
          <p className="text-slate-600 mb-2">Use your own Google account, or our demo account:</p>
          <div className="inline-block bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-sm mb-6">
            <div className="flex gap-8">
              <div>
                <span className="text-slate-500">Email:</span>{' '}
                <span className="font-mono text-slate-900">aiat.actuaryhelp@gmail.com</span>
              </div>
              <div>
                <span className="text-slate-500">Password:</span>{' '}
                <span className="font-mono text-slate-900">AIAT@actuaryhelp.com</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
              Login <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/guide" className="inline-flex items-center gap-2 px-6 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors">
              Step-by-step guide
            </Link>
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        Sophia by Actuaryhelp &middot; Singapore &middot; Contact: sophie@actuaryhelp.com
      </footer>
    </div>
  )
}
