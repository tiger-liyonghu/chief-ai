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
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

/* ─── Types ─── */

interface AgentDef {
  id: string
  nameKey: string
  descKey: string
  icon: React.ElementType
  active: boolean
  /** Fetched at runtime for active agents */
  metric?: string
}

/* ─── Static definitions ─── */

const AGENTS_TEMPLATE: Omit<AgentDef, 'metric'>[] = [
  { id: 'radar',       nameKey: 'agentRadar',       icon: Eye,      active: true,  descKey: 'agentRadarDesc' },
  { id: 'prep',        nameKey: 'agentPrep',        icon: Brain,    active: true,  descKey: 'agentPrepDesc' },
  { id: 'ghostwriter', nameKey: 'agentGhostwriter', icon: PenTool,  active: true,  descKey: 'agentGhostwriterDesc' },
  { id: 'closer',      nameKey: 'agentCloser',      icon: Target,   active: true,  descKey: 'agentCloserDesc' },
  { id: 'weaver',      nameKey: 'agentWeaver',      icon: Heart,    active: true,  descKey: 'agentWeaverDesc' },
  { id: 'travel',      nameKey: 'agentTravelBrain', icon: Plane,    active: true,  descKey: 'agentTravelBrainDesc' },
  { id: 'debrief',     nameKey: 'agentDebrief',     icon: BookOpen, active: true,  descKey: 'agentDebriefDesc' },
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
  const { t } = useI18n()
  const [agents, setAgents] = useState<AgentDef[]>(
    AGENTS_TEMPLATE.map((a) => ({ ...a })),
  )

  useEffect(() => {
    let cancelled = false

    async function fetchMetrics() {
      try {
        const [alertsRes, meetingsRes, closerRes, weaverRes, travelRes] = await Promise.allSettled([
          fetch('/api/alerts').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/meetings').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/agents/closer').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/agents/weaver').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/agents/travel-brain').then((r) => (r.ok ? r.json() : null)),
        ])

        if (cancelled) return

        const alertsData = alertsRes.status === 'fulfilled' ? alertsRes.value : null
        const meetingsData = meetingsRes.status === 'fulfilled' ? meetingsRes.value : null
        const closerData = closerRes.status === 'fulfilled' ? closerRes.value : null
        const weaverData = weaverRes.status === 'fulfilled' ? weaverRes.value : null
        const travelData = travelRes.status === 'fulfilled' ? travelRes.value : null

        const signalCount =
          alertsData?.alerts?.length ?? alertsData?.length ?? 0
        const briefingCount =
          meetingsData?.meetings?.length ?? meetingsData?.length ?? 0
        const overdueFollowUps =
          closerData?.overdue_count ?? closerData?.count ?? 0
        const contactsToNurture =
          weaverData?.contacts_count ?? weaverData?.count ?? 0
        const activeTrips =
          travelData?.active_trips ?? travelData?.count ?? 0

        setAgents((prev) =>
          prev.map((a) => {
            if (a.id === 'radar')
              return { ...a, metric: t('agentSignals' as any, { n: signalCount }) }
            if (a.id === 'prep')
              return { ...a, metric: t('agentBriefingsGenerated' as any, { n: briefingCount }) }
            if (a.id === 'closer' && overdueFollowUps > 0)
              return { ...a, metric: t('agentOverdueFollowUps' as any, { n: overdueFollowUps }) }
            if (a.id === 'weaver' && contactsToNurture > 0)
              return { ...a, metric: t('agentContactsToNurture' as any, { n: contactsToNurture }) }
            if (a.id === 'travel' && activeTrips > 0)
              return { ...a, metric: t('agentActiveTrips' as any, { n: activeTrips }) }
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
  }, [t])

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        {t('aiAgents' as any)}
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
              className="relative rounded-2xl border bg-white p-4 transition-colors border-border hover:border-primary/30"
            >
              {/* Status dot */}
              <div className="flex items-center gap-2 mb-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-medium text-text-secondary">
                  {t('agentActive' as any)}
                </span>
              </div>

              {/* Icon + Name */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-semibold text-text-primary">
                  {t(agent.nameKey as any)}
                </span>
              </div>

              {/* Description / Metric */}
              <p className="text-xs text-text-secondary leading-relaxed pl-10">
                {agent.metric ?? t(agent.descKey as any)}
              </p>
            </motion.div>
          )
        })}
      </motion.div>
    </section>
  )
}
