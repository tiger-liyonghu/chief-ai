'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  User,
  Mail,
  MessageCircle,
  AlertCircle,
  CheckSquare,
  ChevronDown,
  Loader2,
  Clock,
  Flag,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecentEmail {
  from_name: string
  subject: string
  snippet: string
  received_at: string
}

interface RecentWhatsapp {
  from_name: string
  body: string
  received_at: string
}

interface PendingFollowUp {
  subject: string
  type: string
  due_date: string
}

interface Attendee {
  email: string
  name: string
  rsvp_status: string
  recent_emails: RecentEmail[]
  recent_whatsapp: RecentWhatsapp[]
  pending_follow_ups: PendingFollowUp[]
}

interface OpenTask {
  title: string
  priority: string
  due_date: string
}

interface MeetingContext {
  event: {
    id: string
    title: string
    start_time: string
    end_time: string
    location?: string
    meeting_link?: string
  }
  attendees: Attendee[]
  open_tasks: OpenTask[]
  briefing: string
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-surface-secondary', className)} />
  )
}

function ContextSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {/* Briefing skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
      {/* Attendees skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        {[1, 2].map(i => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-48" />
            </div>
          </div>
        ))}
      </div>
      {/* Tasks skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BriefingSection({ briefing }: { briefing: string }) {
  return (
    <div className="relative rounded-xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-purple-500/5 to-amber-500/5" />
      <div className="relative p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">AI Briefing</span>
        </div>
        <p className="text-sm text-text-primary leading-relaxed">{briefing}</p>
      </div>
    </div>
  )
}

function AttendeeItem({ attendee }: { attendee: Attendee }) {
  const [expanded, setExpanded] = useState(false)
  const initials = (attendee.name || attendee.email)
    .split(/[\s@]/)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() || '')
    .join('')

  const hasFollowUps = attendee.pending_follow_ups.length > 0
  const totalInteractions = attendee.recent_emails.length + attendee.recent_whatsapp.length

  const rsvpColor = {
    accepted: 'bg-emerald-100 text-emerald-700',
    declined: 'bg-red-100 text-red-600',
    tentative: 'bg-amber-100 text-amber-700',
    needsAction: 'bg-gray-100 text-text-tertiary',
  }[attendee.rsvp_status] || 'bg-gray-100 text-text-tertiary'

  const rsvpLabel = {
    accepted: 'Accepted',
    declined: 'Declined',
    tentative: 'Tentative',
    needsAction: 'Pending',
  }[attendee.rsvp_status] || attendee.rsvp_status

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-surface-secondary/50 transition-colors text-left"
      >
        {/* Avatar placeholder */}
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
          hasFollowUps ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'
        )}>
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary truncate">
              {attendee.name || attendee.email}
            </span>
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', rsvpColor)}>
              {rsvpLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {totalInteractions > 0 && (
              <span className="text-xs text-text-tertiary">
                {totalInteractions} recent interaction{totalInteractions !== 1 ? 's' : ''}
              </span>
            )}
            {hasFollowUps && (
              <span className="text-xs font-medium text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {attendee.pending_follow_ups.length} pending
              </span>
            )}
          </div>
        </div>

        <ChevronDown className={cn(
          'w-4 h-4 text-text-tertiary transition-transform duration-200',
          expanded && 'rotate-180'
        )} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2.5 border-t border-border/50 pt-2.5">
              {/* Recent Emails */}
              {attendee.recent_emails.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Mail className="w-3 h-3 text-text-tertiary" />
                    <span className="text-xs font-medium text-text-secondary">Recent Emails</span>
                  </div>
                  <div className="space-y-1">
                    {attendee.recent_emails.slice(0, 3).map((email, i) => (
                      <div key={i} className="pl-4 text-xs">
                        <span className="font-medium text-text-primary">{email.subject}</span>
                        <p className="text-text-tertiary line-clamp-1 mt-0.5">{email.snippet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent WhatsApp */}
              {attendee.recent_whatsapp.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <MessageCircle className="w-3 h-3 text-text-tertiary" />
                    <span className="text-xs font-medium text-text-secondary">Recent WhatsApp</span>
                  </div>
                  <div className="space-y-1">
                    {attendee.recent_whatsapp.slice(0, 3).map((msg, i) => (
                      <div key={i} className="pl-4 text-xs">
                        <p className="text-text-tertiary line-clamp-1">{msg.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Follow-ups */}
              {attendee.pending_follow_ups.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertCircle className="w-3 h-3 text-red-500" />
                    <span className="text-xs font-medium text-red-600">Pending Follow-ups</span>
                  </div>
                  <div className="space-y-1">
                    {attendee.pending_follow_ups.map((fu, i) => {
                      const isOverdue = new Date(fu.due_date) < new Date()
                      return (
                        <div key={i} className={cn(
                          'pl-4 text-xs flex items-center gap-2',
                          isOverdue ? 'text-red-600' : 'text-text-secondary'
                        )}>
                          <span className={cn(
                            'w-1.5 h-1.5 rounded-full shrink-0',
                            isOverdue ? 'bg-red-500' : 'bg-amber-400'
                          )} />
                          <span className="font-medium">{fu.subject}</span>
                          <span className="text-text-tertiary">
                            {fu.type} &middot; {new Date(fu.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* No activity */}
              {totalInteractions === 0 && !hasFollowUps && (
                <p className="text-xs text-text-tertiary pl-4">No recent interactions</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TaskItem({ task }: { task: OpenTask }) {
  const isOverdue = new Date(task.due_date) < new Date()
  const priorityConfig = {
    high: { color: 'text-red-500 bg-red-50', icon: Flag },
    medium: { color: 'text-amber-600 bg-amber-50', icon: Flag },
    low: { color: 'text-text-tertiary bg-surface-secondary', icon: Flag },
  }[task.priority] || { color: 'text-text-tertiary bg-surface-secondary', icon: Flag }

  return (
    <div className="flex items-start gap-2.5 text-sm">
      <CheckSquare className="w-4 h-4 text-text-tertiary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className={cn('text-text-primary', isOverdue && 'text-red-600')}>
          {task.title}
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', priorityConfig.color)}>
            {task.priority}
          </span>
          <span className={cn(
            'text-xs flex items-center gap-1',
            isOverdue ? 'text-red-500' : 'text-text-tertiary'
          )}>
            <Clock className="w-3 h-3" />
            {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function MeetingContextCard({ eventId, isOpen }: { eventId: string; isOpen: boolean }) {
  const [data, setData] = useState<MeetingContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchContext = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/meeting-context/${eventId}`)
      if (!res.ok) {
        throw new Error('Failed to load meeting context')
      }
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    if (isOpen && !data && !loading) {
      fetchContext()
    }
  }, [isOpen, data, loading, fetchContext])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="overflow-hidden"
        >
          <div className="border-t border-border/50 bg-white rounded-b-xl">
            {loading && <ContextSkeleton />}

            {error && (
              <div className="p-4 text-center">
                <AlertCircle className="w-5 h-5 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-text-secondary">{error}</p>
                <button
                  onClick={fetchContext}
                  className="mt-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Try again
                </button>
              </div>
            )}

            {data && !loading && (
              <div className="p-4 space-y-4">
                {/* AI Briefing */}
                {data.briefing && <BriefingSection briefing={data.briefing} />}

                {/* Attendees */}
                {data.attendees.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <User className="w-4 h-4 text-text-tertiary" />
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                        Attendees ({data.attendees.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {data.attendees.map((attendee, i) => (
                        <AttendeeItem key={attendee.email || i} attendee={attendee} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Open Tasks */}
                {data.open_tasks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <CheckSquare className="w-4 h-4 text-text-tertiary" />
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                        Related Tasks ({data.open_tasks.length})
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {data.open_tasks.map((task, i) => (
                        <TaskItem key={i} task={task} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
