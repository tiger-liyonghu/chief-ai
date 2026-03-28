'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Eye,
  Brain,
  PenTool,
  Target,
  Heart,
  Plane,
  BookOpen,
  Lock,
} from 'lucide-react'

/* ─── Types ─── */

interface AgentDef {
  id: string
  name: string
  icon: React.ElementType
  active: boolean
  description: string
  /** Fetched at runtime for active agents */
  metric?: string
}

/* ─── Static definitions ─── */

const AGENTS_TEMPLATE: Omit<AgentDef, 'metric'>[] = [
  { id: 'radar',       name: 'Radar',        icon: Eye,      active: true,  description: 'Scanning signals' },
  { id: 'prep',        name: 'Prep',         icon: Brain,    active: true,  description: 'Meeting briefings' },
  { id: 'ghostwriter', name: 'Ghostwriter',  icon: PenTool,  active: true,  description: 'Ready' },
  { id: 'closer',      name: 'Closer',       icon: Target,   active: false, description: 'Coming soon' },
  { id: 'weaver',      name: 'Weaver',       icon: Heart,    active: false, description: 'Coming soon' },
  { id: 'travel',      name: 'Travel Brain', icon: Plane,    active: false, description: 'Coming soon' },
  { id: 'debrief',     name: 'Debrief',      icon: BookOpen, active: false, description: 'Coming soon' },
]

/* ─── Animation variants ─── */

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
}

const card = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

/* ─── Component ─── */

export function AgentStatusPanel() {
  const [agents, setAgents] = useState<AgentDef[]>(
    AGENTS_TEMPLATE.map((a) => ({ ...a })),
  )

  useEffect(() => {
    let cancelled = false

    async function fetchMetrics() {
      try {
        const [alertsRes, meetingsRes] = await Promise.allSettled([
          fetch('/api/alerts').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/meetings').then((r) => (r.ok ? r.json() : null)),
        ])

        if (cancelled) return

        const alertsData = alertsRes.status === 'fulfilled' ? alertsRes.value : null
        const meetingsData = meetingsRes.status === 'fulfilled' ? meetingsRes.value : null

        const signalCount =
          alertsData?.alerts?.length ?? alertsData?.length ?? 0
        const briefingCount =
          meetingsData?.meetings?.length ?? meetingsData?.length ?? 0

        setAgents((prev) =>
          prev.map((a) => {
            if (a.id === 'radar')
              return { ...a, metric: `${signalCount} signal${signalCount !== 1 ? 's' : ''}` }
            if (a.id === 'prep')
              return {
                ...a,
                metric: `${briefingCount} briefing${briefingCount !== 1 ? 's' : ''} generated`,
              }
            return a
          }),
        )
      } catch {
        // Silently degrade — cards still render with static descriptions
      }
    }

    fetchMetrics()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        AI Agents
      </h2>

      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {agents.map((agent) => {
          const Icon = agent.icon
          return (
            <motion.div
              key={agent.id}
              variants={card}
              whileHover={{ y: -2, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
              className={`
                relative rounded-2xl border bg-white p-4 transition-colors
                ${agent.active
                  ? 'border-border hover:border-primary/30'
                  : 'border-border/60 opacity-60'}
              `}
            >
              {/* Status dot */}
              <div className="flex items-center gap-2 mb-2">
                {agent.active ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                ) : (
                  <Lock className="h-3 w-3 text-text-tertiary" />
                )}
                <span className="text-xs font-medium text-text-secondary">
                  {agent.active ? 'Active' : 'Locked'}
                </span>
              </div>

              {/* Icon + Name */}
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className={`
                    flex h-8 w-8 items-center justify-center rounded-lg
                    ${agent.active
                      ? 'bg-primary/10 text-primary'
                      : 'bg-surface-secondary text-text-tertiary'}
                  `}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-semibold text-text-primary">
                  {agent.name}
                </span>
              </div>

              {/* Description / Metric */}
              <p className="text-xs text-text-secondary leading-relaxed pl-10">
                {agent.metric ?? agent.description}
              </p>
            </motion.div>
          )
        })}
      </motion.div>
    </section>
  )
}
