'use client'

import { motion } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import {
  Mail,
  Clock,
  Calendar,
  AlertCircle,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Reply,
  Zap,
  BellOff,
  Briefcase,
  Eye,
  Send as SendIcon,
  Inbox,
  Radio,
} from 'lucide-react'
import { SkeletonBriefing } from '@/components/ui/Skeleton'
import Link from 'next/link'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { OnboardingProgress } from '@/components/dashboard/OnboardingProgress'
import { cn } from '@/lib/utils'
import { requestNotificationPermission, sendOverdueEmailNotification } from '@/lib/notifications'

/* ─── Types ─── */

interface DashboardData {
  tasks: any[]
  pendingReplies: any[]
  followUps: any[]
  todayEvents: any[]
}

/* ─── Animations ─── */

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
}

/* ─── Helpers ─── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function getGapMinutes(endTime: string, nextStartTime: string): number {
  return Math.floor((new Date(nextStartTime).getTime() - new Date(endTime).getTime()) / 60000)
}

/* ─── WelcomeCard (preserved for first-time users) ─── */

function WelcomeCard({ t, onSync }: { t: (key: any, params?: Record<string, string | number>) => string; onSync: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col sm:flex-row items-center gap-4 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl px-6 py-4 mb-8"
    >
      <div className="flex items-center gap-3 flex-1">
        <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
          <Mail className="w-4.5 h-4.5 text-white" />
        </div>
        <p className="text-sm sm:text-base font-medium text-white">
          Connect your Gmail to get started
        </p>
      </div>
      <Link
        href="/api/auth/login"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-indigo-700 rounded-xl text-sm font-semibold hover:bg-white/90 transition-colors shadow-lg shadow-indigo-900/20 shrink-0"
      >
        <Mail className="w-4 h-4" />
        Connect Gmail
      </Link>
    </motion.div>
  )
}

/* ─── Section Components ─── */

function UrgentItem({ text, onReply, onDoNow, onSnooze, t }: {
  text: string
  onReply?: () => void
  onDoNow?: () => void
  onSnooze?: () => void
  t: (key: any, params?: Record<string, string | number>) => string
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="border-l-4 border-red-400 bg-white rounded-2xl p-5 shadow-sm"
    >
      <p className="text-[15px] text-text-primary leading-relaxed mb-3">{text}</p>
      <div className="flex items-center gap-2">
        {onReply && (
          <button
            onClick={onReply}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
          >
            <Reply className="w-3.5 h-3.5" />
            {t('replyAction' as any)}
          </button>
        )}
        {onDoNow && (
          <button
            onClick={onDoNow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            {t('doNowAction' as any)}
          </button>
        )}
        {onSnooze && (
          <button
            onClick={onSnooze}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-secondary text-text-tertiary rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
          >
            <BellOff className="w-3.5 h-3.5" />
            {t('snoozeAction' as any)}
          </button>
        )}
      </div>
    </motion.div>
  )
}

function TimelineEvent({ event, t }: { event: any; t: any }) {
  const startTime = formatTime(event.start_time)
  const attendees = typeof event.attendees === 'string' ? JSON.parse(event.attendees) : (event.attendees || [])

  return (
    <motion.div variants={fadeUp} className="flex gap-4 items-start">
      <div className="w-20 shrink-0 text-right">
        <span className="text-sm font-semibold text-text-primary">{startTime}</span>
      </div>
      <div className="relative flex flex-col items-center">
        <div className="w-3 h-3 rounded-full bg-primary border-2 border-white shadow-sm shrink-0 mt-1.5" />
        <div className="w-0.5 flex-1 bg-border" />
      </div>
      <div className="flex-1 pb-8">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-border">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-medium text-text-primary">{event.title}</p>
            <Link
              href="/dashboard/calendar"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <Briefcase className="w-3.5 h-3.5" />
              {t('prepAction' as any)}
            </Link>
          </div>
          {event.location && (
            <p className="text-xs text-text-tertiary mt-1">{event.location}</p>
          )}
          {attendees.length > 0 && (
            <p className="text-xs text-text-tertiary mt-1">{attendees.length} {t('attendees')}</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function TimelineGap({ minutes, t }: { minutes: number; t: any }) {
  if (minutes < 30) return null
  return (
    <motion.div variants={fadeUp} className="flex gap-4 items-start">
      <div className="w-20 shrink-0" />
      <div className="relative flex flex-col items-center">
        <div className="w-2 h-2 rounded-full bg-border shrink-0 mt-2" />
        <div className="w-0.5 flex-1 bg-border" />
      </div>
      <div className="flex-1 pb-6">
        <p className="text-xs text-text-tertiary italic py-2">
          {t('freeGap' as any, { n: minutes })}
        </p>
      </div>
    </motion.div>
  )
}

/* ─── Main Page ─── */

export default function DashboardPage() {
  const { t, setLocale } = useI18n()
  const [data, setData] = useState<DashboardData>({ tasks: [], pendingReplies: [], followUps: [], todayEvents: [] })
  const [allEmails, setAllEmails] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [briefing, setBriefing] = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [assistantName, setAssistantName] = useState('Chief')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [detectedTimezone, setDetectedTimezone] = useState('')
  const [detectedLanguage, setDetectedLanguage] = useState('en')
  const [radarSignals, setRadarSignals] = useState(0)
  const [onboardingJustFinished, setOnboardingJustFinished] = useState(false)

  // Auto-onboarding detection
  useEffect(() => {
    const alreadyOnboarded = localStorage.getItem('chief-onboarded')
    if (alreadyOnboarded) return

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const navLang = navigator.language
    const lang = navLang.startsWith('zh') ? 'zh'
      : navLang.startsWith('ms') ? 'ms'
      : 'en'

    setDetectedTimezone(tz)
    setDetectedLanguage(lang)

    if (['en', 'zh', 'ms'].includes(lang)) {
      setLocale(lang as any)
    }

    const needsOnboarding = document.cookie.includes('chief-needs-onboarding=true')
    if (needsOnboarding || !alreadyOnboarded) {
      setShowOnboarding(true)
    }
  }, [setLocale])

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false)
    localStorage.setItem('chief-onboarded', 'true')
    document.cookie = 'chief-needs-onboarding=; path=/; max-age=0'
    setOnboardingJustFinished(true)
  }, [])

  const today = new Date()
  const greeting = today.getHours() < 12 ? t('goodMorning') : today.getHours() < 18 ? t('goodAfternoon') : t('goodEvening')
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const todayStr = today.toISOString().slice(0, 10)

  const fetchAll = useCallback(async () => {
    try {
      const [tasksRes, emailsRes, followUpsRes, calendarRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/emails'),
        fetch('/api/follow-ups'),
        fetch('/api/calendar'),
      ])

      const [tasks, emails, followUps, calendar] = await Promise.all([
        tasksRes.ok ? tasksRes.json() : [],
        emailsRes.ok ? emailsRes.json() : [],
        followUpsRes.ok ? followUpsRes.json() : [],
        calendarRes.ok ? calendarRes.json() : [],
      ])

      setAllEmails(emails || [])

      setData({
        tasks: (tasks || []).filter((t: any) => t.status !== 'done'),
        pendingReplies: (emails || []).slice(0, 3),
        followUps: (followUps || []).filter((f: any) => f.status === 'active'),
        todayEvents: (calendar || []).filter((e: any) => e.start_time?.slice(0, 10) === todayStr).sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
      })
    } finally {
      setLoading(false)
    }
  }, [todayStr])

  const fetchBriefing = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = localStorage.getItem('chief_briefing')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          const age = Date.now() - new Date(parsed.generated_at).getTime()
          if (age < 60 * 60 * 1000) {
            setBriefing(parsed.briefing)
            return
          }
        } catch { /* ignore */ }
      }
    }

    setBriefingLoading(true)
    try {
      const url = forceRefresh ? '/api/briefing?refresh=1' : '/api/briefing'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setBriefing(data.briefing)
        localStorage.setItem('chief_briefing', JSON.stringify({
          briefing: data.briefing,
          generated_at: data.generated_at,
        }))
      }
    } catch { /* silently fail */ }
    finally { setBriefingLoading(false) }
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.assistant_name) setAssistantName(data.assistant_name)
      }
    } catch { /* use default */ }
  }, [])

  const fetchRadar = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/radar')
      if (res.ok) {
        const data = await res.json()
        setRadarSignals(data.signals_count || data.length || 0)
      }
    } catch { /* silently fail */ }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { fetchBriefing() }, [fetchBriefing])
  useEffect(() => { fetchSettings() }, [fetchSettings])
  useEffect(() => { fetchRadar() }, [fetchRadar])

  // Request notification permission
  useEffect(() => {
    const timer = setTimeout(() => requestNotificationPermission(), 3000)
    return () => clearTimeout(timer)
  }, [])

  // Send browser notification for overdue emails
  const overdueNotifiedRef = useRef(false)
  useEffect(() => {
    if (overdueNotifiedRef.current) return
    if (allEmails.length > 0) {
      const overdueCount = allEmails.filter((e: any) => {
        if (!e.received_at) return false
        return Date.now() - new Date(e.received_at).getTime() > 24 * 60 * 60 * 1000
      }).length
      if (overdueCount > 0) {
        overdueNotifiedRef.current = true
        sendOverdueEmailNotification(overdueCount)
      }
    }
  }, [allEmails])

  // Listen for background sync
  useEffect(() => {
    const onSyncComplete = () => { fetchAll() }
    window.addEventListener('chief-sync-complete', onSyncComplete)
    return () => window.removeEventListener('chief-sync-complete', onSyncComplete)
  }, [fetchAll])

  // Refetch after onboarding
  useEffect(() => {
    if (onboardingJustFinished) {
      setOnboardingJustFinished(false)
      fetchAll()
    }
  }, [onboardingJustFinished, fetchAll])

  /* ─── Derive urgent items (overdue emails + overdue follow-ups, max 3) ─── */
  const urgentItems: { text: string; type: 'email' | 'followup'; id: string }[] = []

  // Overdue emails (> 24h unanswered)
  for (const email of allEmails) {
    if (urgentItems.length >= 3) break
    if (!email.received_at) continue
    const days = daysAgo(email.received_at)
    if (days >= 1) {
      const sender = email.from_name || email.from_address || 'Someone'
      const role = email.sender_role ? ` (${email.sender_role})` : ''
      urgentItems.push({
        text: `${sender}${role} emailed you ${days === 1 ? 'yesterday' : `${days} days ago`} — ${t('stillUnanswered' as any)}`,
        type: 'email',
        id: email.id,
      })
    }
  }

  // Overdue follow-ups
  for (const fu of data.followUps) {
    if (urgentItems.length >= 3) break
    if (!fu.due_date) continue
    const overdueDays = daysAgo(fu.due_date)
    if (overdueDays > 0) {
      const direction = fu.direction === 'you_promised' ? t('youPromisedBrief' as any) : t('waitingOn' as any)
      urgentItems.push({
        text: `${direction}: ${fu.subject} — ${fu.contact_name || 'someone'} (${overdueDays}d overdue)`,
        type: 'followup',
        id: fu.id,
      })
    }
  }

  // Overdue tasks
  for (const task of data.tasks) {
    if (urgentItems.length >= 3) break
    if (task.priority === 1 && task.due_date) {
      const overdueDays = daysAgo(task.due_date)
      if (overdueDays > 0) {
        urgentItems.push({
          text: `${task.title} — due ${overdueDays === 1 ? 'yesterday' : `${overdueDays} days ago`}`,
          type: 'followup',
          id: task.id,
        })
      }
    }
  }

  const hasData = data.tasks.length > 0 || data.pendingReplies.length > 0 || data.todayEvents.length > 0 || data.followUps.length > 0 || briefing
  const isQuietDay = !loading && hasData && urgentItems.length === 0 && data.todayEvents.length === 0 && allEmails.length === 0

  return (
    <div>
      {/* Onboarding overlay */}
      {showOnboarding && (
        <OnboardingProgress
          timezone={detectedTimezone}
          language={detectedLanguage}
          onComplete={handleOnboardingComplete}
        />
      )}

      <TopBar
        title={`${greeting}`}
        subtitle={dateStr}
        onSyncComplete={fetchAll}
        autoSync
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {loading ? (
          <SkeletonBriefing />
        ) : !hasData ? (
          <WelcomeCard t={t} onSync={() => {
            fetch('/api/sync', { method: 'POST' }).then(() => {
              localStorage.setItem('chief-last-sync', Date.now().toString())
              fetchAll()
            }).catch(() => {})
          }} />
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-12"
          >
            {/* ─── 1. Greeting ─── */}
            <motion.div variants={fadeUp}>
              <p className="text-2xl sm:text-3xl font-semibold text-text-primary leading-snug">
                {assistantName}: {greeting}, Tiger. {t('heresYourDay' as any)}
              </p>
            </motion.div>

            {/* ─── 2. Urgent Matters ─── */}
            {urgentItems.length > 0 && (
              <motion.section variants={fadeUp}>
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <h2 className="text-lg font-semibold text-red-700">{t('urgentMatters' as any)}</h2>
                </div>
                <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
                  {urgentItems.map((item) => (
                    <UrgentItem
                      key={item.id}
                      text={item.text}
                      t={t}
                      onReply={item.type === 'email' ? () => {
                        window.location.assign('/dashboard/inbox')
                      } : undefined}
                      onDoNow={() => {
                        if (item.type === 'email') {
                          window.location.assign('/dashboard/inbox')
                        } else {
                          window.location.assign('/dashboard/tasks')
                        }
                      }}
                      onSnooze={() => {
                        // TODO: implement snooze API
                      }}
                    />
                  ))}
                </motion.div>
              </motion.section>
            )}

            {/* ─── 3. Today's Timeline ─── */}
            {data.todayEvents.length > 0 && (
              <motion.section variants={fadeUp}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-text-primary">{t('todayTimeline' as any)}</h2>
                  </div>
                  <Link href="/dashboard/calendar" className="text-sm text-primary hover:underline">{t('viewAll')}</Link>
                </div>
                <motion.div variants={staggerContainer} initial="initial" animate="animate">
                  {data.todayEvents.map((event, i) => (
                    <div key={event.id}>
                      <TimelineEvent event={event} t={t} />
                      {i < data.todayEvents.length - 1 && event.end_time && data.todayEvents[i + 1]?.start_time && (
                        <TimelineGap
                          minutes={getGapMinutes(event.end_time, data.todayEvents[i + 1].start_time)}
                          t={t}
                        />
                      )}
                    </div>
                  ))}
                  {/* End dot */}
                  <div className="flex gap-4 items-start">
                    <div className="w-20 shrink-0" />
                    <div className="relative flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-border shrink-0" />
                    </div>
                    <div className="flex-1" />
                  </div>
                </motion.div>
              </motion.section>
            )}

            {/* ─── 4. Follow-up Reminders ─── */}
            {data.followUps.length > 0 && (
              <motion.section variants={fadeUp}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <h2 className="text-lg font-semibold text-text-primary">{t('followUpReminders' as any)}</h2>
                  </div>
                  <Link href="/dashboard/tasks" className="text-sm text-primary hover:underline">{t('viewAll')}</Link>
                </div>
                <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
                  {data.followUps.slice(0, 5).map((fu) => {
                    const isOverdue = fu.due_date && daysAgo(fu.due_date) > 0
                    const direction = fu.direction === 'you_promised'
                      ? t('youPromisedBrief' as any)
                      : `${t('waitingOn' as any)}:`

                    return (
                      <motion.div
                        key={fu.id}
                        variants={fadeUp}
                        className="bg-white rounded-2xl p-5 shadow-sm border border-border"
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            'w-2 h-2 rounded-full mt-2 shrink-0',
                            isOverdue ? 'bg-red-500' : 'bg-amber-400'
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] text-text-primary leading-relaxed">
                              <span className="font-medium">{direction}</span>{' '}
                              {fu.contact_name || 'someone'} ({fu.subject})
                              {fu.due_date && (
                                <span className={cn(
                                  'text-xs ml-2',
                                  isOverdue ? 'text-red-500 font-medium' : 'text-text-tertiary'
                                )}>
                                  {isOverdue
                                    ? `${daysAgo(fu.due_date)}d overdue`
                                    : t('daysWaiting' as any, { n: Math.abs(daysAgo(fu.due_date)) || 'today' as any })
                                  }
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              </motion.section>
            )}

            {/* ─── 5. Inbox Summary ─── */}
            <motion.section variants={fadeUp}>
              <div className="flex items-center gap-2 mb-4">
                <Inbox className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-text-primary">{t('inboxSummary' as any)}</h2>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-border">
                {allEmails.length > 0 ? (
                  <div className="flex items-center justify-between">
                    <p className="text-[15px] text-text-primary leading-relaxed">
                      {t('newEmailsToday' as any, { n: allEmails.length, urgent: data.pendingReplies.length })}
                    </p>
                    <Link
                      href="/dashboard/inbox"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors shrink-0"
                    >
                      {t('viewInbox' as any)}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-[15px] text-text-tertiary">{t('noEmailsNeedReply')}</p>
                )}
              </div>
            </motion.section>

            {/* ─── 6. Assistant Status ─── */}
            <motion.section variants={fadeUp}>
              <div className="bg-surface-secondary rounded-2xl px-6 py-4 flex items-center gap-3 text-sm text-text-tertiary">
                <Radio className="w-4 h-4 text-green-500 shrink-0" />
                <p>
                  {t('watchingChannels' as any, { channels: 3 })}
                  {' · '}
                  {radarSignals > 0 ? t('signalsDetected' as any, { signals: radarSignals }) : t('allCaughtUp' as any)}
                </p>
              </div>
            </motion.section>

            {/* ─── Quiet Day Message ─── */}
            {isQuietDay && (
              <motion.section variants={fadeUp}>
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-border text-center">
                  <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="text-lg text-text-primary font-medium">
                    {t('quietDay' as any)}
                  </p>
                </div>
              </motion.section>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
