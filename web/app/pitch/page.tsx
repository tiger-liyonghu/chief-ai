'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, type ReactNode } from 'react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Scroll-triggered fade-in wrapper
// ---------------------------------------------------------------------------
function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Section 1 — Hero
// ---------------------------------------------------------------------------
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-6">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0f0f23] to-[#1a1a3e]" />

      {/* Subtle radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,rgba(99,102,241,0.12),transparent)]" />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-sm uppercase tracking-[0.3em] text-indigo-400 mb-6"
        >
          Introducing
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white leading-[1.05] tracking-tight"
        >
          Your AI
          <br />
          Chief of Staff
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-8 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed"
        >
          The personal AI that manages your email, calendar, and WhatsApp
          &mdash; so you never miss a follow-up, forget a promise, or walk into
          a meeting unprepared.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 1.0 }}
          className="mt-14 inline-flex flex-col items-center"
        >
          <span className="text-6xl sm:text-7xl font-bold text-white tabular-nums">
            7
          </span>
          <span className="mt-2 text-sm uppercase tracking-[0.25em] text-indigo-400">
            AI Agents working for you 24/7
          </span>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.8 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-5 h-8 rounded-full border-2 border-slate-600 flex items-start justify-center p-1.5"
          >
            <div className="w-1 h-1.5 rounded-full bg-slate-500" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 2 — Problem
// ---------------------------------------------------------------------------
const problems = [
  {
    icon: '\u{1F4E7}',
    stat: '47%',
    text: 'of emails that need a reply get forgotten',
  },
  {
    icon: '\u{1F91D}',
    stat: '3 / 10',
    text: 'promises made in meetings are never tracked',
  },
  {
    icon: '\u{2708}\u{FE0F}',
    stat: '4.5 hrs',
    text: 'per week on meeting prep that AI could do',
  },
]

function Problem() {
  return (
    <section className="relative py-32 px-6 bg-[#0f0f23]">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="text-4xl sm:text-5xl font-bold text-white text-center tracking-tight">
            The $2.8B Problem
          </h2>
        </Reveal>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          {problems.map((p, i) => (
            <Reveal key={i} delay={i * 0.15}>
              <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 text-center transition-colors hover:bg-white/[0.06]">
                <span className="text-4xl">{p.icon}</span>
                <p className="mt-6 text-4xl font-bold text-white">{p.stat}</p>
                <p className="mt-3 text-slate-400 leading-relaxed">{p.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 3 — How It Works
// ---------------------------------------------------------------------------
const steps = [
  {
    num: '01',
    title: 'Connect',
    desc: 'Link your Gmail, Outlook, WhatsApp in 30 seconds',
  },
  {
    num: '02',
    title: 'AI Scans',
    desc: '7 agents analyze your messages, extract tasks, track promises',
  },
  {
    num: '03',
    title: 'You Act',
    desc: 'Daily briefing, smart replies, meeting prep \u2014 all automated',
  },
]

function HowItWorks() {
  return (
    <section className="py-32 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="text-4xl sm:text-5xl font-bold text-[#0f0f23] text-center tracking-tight">
            One inbox. Seven agents.
            <br />
            Zero missed items.
          </h2>
        </Reveal>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-12">
          {steps.map((s, i) => (
            <Reveal key={i} delay={i * 0.15}>
              <div className="relative">
                <span className="text-7xl font-bold text-indigo-100">
                  {s.num}
                </span>
                <h3 className="mt-4 text-2xl font-semibold text-[#0f0f23]">
                  {s.title}
                </h3>
                <p className="mt-3 text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 4 — Agent Showcase
// ---------------------------------------------------------------------------
const agents = [
  {
    name: 'Radar',
    desc: 'Monitors all channels, surfaces what\u2019s urgent',
    icon: '\u{1F4E1}',
  },
  {
    name: 'Ghostwriter',
    desc: 'Drafts replies in your voice with full context',
    icon: '\u{1F58A}\u{FE0F}',
  },
  {
    name: 'Prep',
    desc: 'Auto-generates meeting briefings 30 min before',
    icon: '\u{1F4CB}',
  },
  {
    name: 'Closer',
    desc: 'Tracks every promise, nudges before it\u2019s too late',
    icon: '\u{1F3AF}',
  },
  {
    name: 'Weaver',
    desc: 'Keeps your relationship network warm',
    icon: '\u{1F578}\u{FE0F}',
  },
  {
    name: 'Travel Brain',
    desc: 'Your travel concierge \u2014 visa, culture, restaurants',
    icon: '\u{1F30D}',
  },
  {
    name: 'Debrief',
    desc: 'Weekly retrospective with actionable insights',
    icon: '\u{1F4CA}',
  },
]

function AgentShowcase() {
  return (
    <section className="py-32 px-6 bg-[#0f0f23]">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <h2 className="text-4xl sm:text-5xl font-bold text-white text-center tracking-tight">
            Meet Your Agents
          </h2>
        </Reveal>

        <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {agents.map((a, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] p-7 transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/[0.05]"
              >
                <span className="text-3xl">{a.icon}</span>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  {a.name}
                </h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  {a.desc}
                </p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 5 — Numbers
// ---------------------------------------------------------------------------
const numbers = [
  { value: '4', label: 'Channels', sub: 'Gmail, Outlook, WhatsApp, Telegram' },
  { value: '7', label: 'AI Agents', sub: '' },
  { value: '60+', label: 'API Endpoints', sub: '' },
  { value: '3', label: 'Languages', sub: 'EN, \u4E2D\u6587, BM' },
]

function Numbers() {
  return (
    <section className="py-32 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="text-4xl sm:text-5xl font-bold text-[#0f0f23] text-center tracking-tight">
            Built for Scale
          </h2>
        </Reveal>

        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {numbers.map((n, i) => (
            <Reveal key={i} delay={i * 0.12} className="text-center">
              <p className="text-5xl sm:text-6xl font-bold text-[#0f0f23]">
                {n.value}
              </p>
              <p className="mt-3 text-lg font-medium text-[#0f0f23]">
                {n.label}
              </p>
              {n.sub && (
                <p className="mt-1 text-sm text-slate-400">{n.sub}</p>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section 6 — CTA
// ---------------------------------------------------------------------------
function CTA() {
  return (
    <section className="relative py-32 px-6 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f0f23] via-[#1a1a3e] to-[#0f0f23]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(99,102,241,0.1),transparent)]" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <Reveal>
          <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
            Ready to never miss
            <br />a follow-up again?
          </h2>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-indigo-500 px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-indigo-400 min-w-[180px]"
            >
              Try the Demo
            </Link>
            <Link
              href="/pitch/deck"
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-3.5 text-base font-medium text-white transition-colors hover:border-white/40 hover:bg-white/[0.05] min-w-[180px]"
            >
              Read the Deck
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.35}>
          <p className="mt-16 text-sm text-slate-500">
            Pre-seed &middot; Singapore &middot; 2026
          </p>
        </Reveal>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function PitchPage() {
  return (
    <main className="overflow-x-hidden">
      <Hero />
      <Problem />
      <HowItWorks />
      <AgentShowcase />
      <Numbers />
      <CTA />
    </main>
  )
}
