'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import { Calendar, Users, MapPin, Video, ChevronLeft, ChevronRight, Loader2, Plus, X, Pencil, Trash2, Sparkles, ExternalLink, Brain } from 'lucide-react'
import { MeetingContextCard } from '@/components/dashboard/MeetingContextCard'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = 'day' | 'week' | 'month'

interface CalendarEvent {
  id: string
  title: string
  description?: string
  start_time: string
  end_time: string
  attendees: any
  location?: string
  meeting_link?: string
}

interface EventFormData {
  title: string
  description: string
  start_date: string
  start_time: string
  end_time: string
  location: string
  attendees: string
  create_meet_link: boolean
}

const EMPTY_FORM: EventFormData = {
  title: '',
  description: '',
  start_date: '',
  start_time: '09:00',
  end_time: '10:00',
  location: '',
  attendees: '',
  create_meet_link: false,
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8) // 8 AM – 7 PM
const COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500', 'bg-cyan-500']
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const VIEW_TAB_KEYS: { key: ViewMode; labelKey: string }[] = [
  { key: 'day', labelKey: 'day' },
  { key: 'week', labelKey: 'week' },
  { key: 'month', labelKey: 'month' },
]

// ─── Date helpers ────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Returns the Monday of the week containing `d` (ISO weeks). */
function startOfWeek(d: Date) {
  const r = new Date(d)
  const day = r.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday = 1
  r.setDate(r.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function formatHour(hour: number) {
  if (hour === 0) return '12 AM'
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}

// ─── Event Modal ─────────────────────────────────────────────────────────────

function EventModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  editEventId,
  submitting,
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (form: EventFormData) => Promise<void>
  initialData: EventFormData
  editEventId: string | null
  submitting: boolean
}) {
  const { t } = useI18n()
  const [form, setForm] = useState<EventFormData>(initialData)

  useEffect(() => {
    setForm(initialData)
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(form)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                {editEventId ? t('editEvent' as any) : t('newEvent' as any)}
              </h2>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-secondary transition-colors">
                <X className="w-5 h-5 text-text-tertiary" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Title</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Meeting title"
                  className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Date</label>
                <input
                  type="date"
                  required
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>

              {/* Start & End Time */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Start time</label>
                  <input
                    type="time"
                    required
                    value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">End time</label>
                  <input
                    type="time"
                    required
                    value={form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Office, Zoom, etc."
                  className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>

              {/* Attendees */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Attendees</label>
                <input
                  type="text"
                  value={form.attendees}
                  onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))}
                  placeholder="email1@example.com, email2@example.com"
                  className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
                <p className="text-xs text-text-tertiary mt-1">Comma-separated email addresses. Invitations will be sent automatically.</p>
              </div>

              {/* Google Meet checkbox */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.create_meet_link}
                  onChange={e => setForm(f => ({ ...f, create_meet_link: e.target.checked }))}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
                />
                <span className="text-sm text-text-secondary">Create Google Meet link</span>
              </label>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Meeting agenda, notes..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-primary text-white font-medium text-sm rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editEventId ? 'Save Changes' : 'Create Event'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Delete Confirm Dialog ──────────────────────────────────────────────────

function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  eventTitle,
  deleting,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  eventTitle: string
  deleting: boolean
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-text-primary mb-2">Delete Event</h3>
            <p className="text-sm text-text-secondary mb-5">
              Are you sure you want to delete <span className="font-medium">"{eventTitle}"</span>? This will also remove it from Google Calendar and notify attendees.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2 text-sm font-medium text-text-secondary border border-border rounded-xl hover:bg-surface-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={deleting}
                className="flex-1 py-2 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function EventCard({
  event,
  colorIndex,
  compact = false,
  expanded = false,
  onToggle,
  onEdit,
  onDelete,
  contextOpen = false,
  onToggleContext,
}: {
  event: CalendarEvent
  colorIndex: number
  compact?: boolean
  expanded?: boolean
  onToggle?: () => void
  onEdit?: () => void
  onDelete?: () => void
  contextOpen?: boolean
  onToggleContext?: () => void
}) {
  const start = new Date(event.start_time)
  const end = new Date(event.end_time)
  const startStr = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const endStr = end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const attendees = typeof event.attendees === 'string' ? JSON.parse(event.attendees) : (event.attendees || [])
  const color = COLORS[colorIndex % COLORS.length]

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] leading-tight truncate">
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', color)} />
        <span className="truncate text-text-primary">{event.title}</span>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white rounded-xl border border-border hover:shadow-md transition-all duration-200 cursor-pointer mb-2"
      onClick={onToggle}
    >
      <div className="flex items-stretch gap-3 p-3">
        <div className={cn('w-1 rounded-full shrink-0', color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-text-primary truncate">{event.title}</p>
            <span className="text-xs text-text-tertiary whitespace-nowrap">{startStr} - {endStr}</span>
          </div>
          <div className="flex items-center gap-4 mt-1.5">
            {attendees.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-text-tertiary">
                <Users className="w-3.5 h-3.5" />
                {attendees.length} attendees
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-1 text-xs text-text-tertiary">
                <MapPin className="w-3.5 h-3.5" />
                {event.location}
              </div>
            )}
            {event.meeting_link && (
              <a
                href={event.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary"
                onClick={e => e.stopPropagation()}
              >
                <Video className="w-3.5 h-3.5" />
                Join meeting
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Expanded detail section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 border-t border-border/50">
              {event.description && (
                <p className="text-xs text-text-secondary mb-3 whitespace-pre-wrap">{event.description}</p>
              )}

              {attendees.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-text-secondary mb-1">Attendees</p>
                  <div className="flex flex-wrap gap-1.5">
                    {attendees.map((a: any, i: number) => (
                      <span key={i} className="text-xs bg-surface-secondary text-text-secondary px-2 py-0.5 rounded-full">
                        {a.name || a.email}
                        {a.status && a.status !== 'needsAction' && (
                          <span className={cn(
                            'ml-1',
                            a.status === 'accepted' && 'text-emerald-600',
                            a.status === 'declined' && 'text-red-500',
                            a.status === 'tentative' && 'text-amber-600',
                          )}>
                            ({a.status})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                {onEdit && (
                  <button
                    onClick={e => { e.stopPropagation(); onEdit() }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={e => { e.stopPropagation(); onDelete() }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )}
                {onToggleContext && (
                  <button
                    onClick={e => { e.stopPropagation(); onToggleContext() }}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                      contextOpen
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'text-text-secondary border border-border hover:bg-surface-secondary'
                    )}
                  >
                    <Brain className="w-3.5 h-3.5" />
                    Context
                  </button>
                )}
                {event.meeting_link && (
                  <a
                    href={event.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors ml-auto"
                  >
                    <Video className="w-3.5 h-3.5" />
                    Join Meeting
                  </a>
                )}
              </div>

              {/* Meeting Context Card */}
              <MeetingContextCard eventId={event.id} isOpen={contextOpen} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="text-center py-16">
      <Calendar className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
      <p className="text-text-secondary font-medium">{message}</p>
      {hint && <p className="text-sm text-text-tertiary mt-1">{hint}</p>}
    </div>
  )
}

// ─── Gap Suggestion Button ──────────────────────────────────────────────────

function GapSuggestionButton({ gapMinutes, gapStart, beforeTitle, afterTitle }: {
  gapMinutes: number
  gapStart: string
  beforeTitle: string
  afterTitle: string
}) {
  const [open, setOpen] = useState(false)
  const [recs, setRecs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRecs = useCallback(async () => {
    if (recs.length > 0) { setOpen(!open); return }
    setOpen(true)
    setLoading(true)
    try {
      const params = new URLSearchParams({
        area: 'Raffles Place',
        gap_minutes: String(gapMinutes),
        meal_type: (() => {
          const h = parseInt(gapStart.split(':')[0], 10)
          if (h < 10) return 'breakfast'
          if (h < 11) return 'morning_break'
          if (h < 14) return 'lunch'
          if (h < 17) return 'afternoon_break'
          if (h < 21) return 'dinner'
          return 'late_night'
        })(),
        lang: 'en',
      })
      const res = await fetch(`/api/recommendations?${params}`)
      if (res.ok) {
        const data = await res.json()
        setRecs(data.recommendations || [])
      }
    } catch {} finally { setLoading(false) }
  }, [gapMinutes, gapStart, recs.length, open])

  return (
    <div className="my-1">
      <button
        onClick={fetchRecs}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium transition-colors"
      >
        <Sparkles className="w-3 h-3" />
        {gapMinutes} min free
        {open ? <ChevronLeft className="w-3 h-3 rotate-90" /> : <ChevronRight className="w-3 h-3 -rotate-90" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {loading ? (
                <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-text-tertiary">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                </div>
              ) : recs.length > 0 ? recs.slice(0, 3).map((rec: any) => (
                <a
                  key={rec.place?.id || rec.place?.name}
                  href={rec.place?.googleMapsUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-border hover:border-primary/30 hover:shadow-sm text-xs transition-all"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-text-primary block truncate max-w-[140px]">{rec.place?.name}</span>
                    <span className="text-text-tertiary">{rec.place?.priceRange} &middot; {rec.walk_minutes}min walk</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-text-tertiary shrink-0" />
                </a>
              )) : (
                <span className="text-xs text-text-tertiary px-2 py-1">No suggestions</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Day View ────────────────────────────────────────────────────────────────

function DayView({
  events,
  date,
  expandedId,
  onToggleExpand,
  onEdit,
  onDelete,
  contextOpenId,
  onToggleContext,
}: {
  events: CalendarEvent[]
  date: Date
  expandedId: string | null
  onToggleExpand: (id: string) => void
  onEdit: (event: CalendarEvent) => void
  onDelete: (event: CalendarEvent) => void
  contextOpenId: string | null
  onToggleContext: (id: string) => void
}) {
  const dayKey = toDateKey(date)
  const dayEvents = events
    .filter(e => e.start_time?.slice(0, 10) === dayKey)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  // Precompute gaps between consecutive events (>30 min)
  const gapMap = useMemo(() => {
    const gaps = new Map<number, { minutes: number; startTime: string; before: string; after: string }>()
    for (let i = 0; i < dayEvents.length - 1; i++) {
      const endA = new Date(dayEvents[i].end_time)
      const startB = new Date(dayEvents[i + 1].start_time)
      const gapMinutes = Math.round((startB.getTime() - endA.getTime()) / 60000)
      if (gapMinutes >= 30) {
        const endHour = endA.getHours()
        gaps.set(endHour, {
          minutes: gapMinutes,
          startTime: `${String(endA.getHours()).padStart(2, '0')}:${String(endA.getMinutes()).padStart(2, '0')}`,
          before: dayEvents[i].title,
          after: dayEvents[i + 1].title,
        })
      }
    }
    return gaps
  }, [dayEvents])

  if (dayEvents.length === 0) {
    return <EmptyState message="No events this day" hint='Click "+ New Event" to create one, or "Sync now" to pull from Google Calendar' />
  }

  return (
    <div className="grid grid-cols-[72px_1fr] gap-0">
      {HOURS.map((hour) => {
        const eventsAtHour = dayEvents.filter(e => new Date(e.start_time).getHours() === hour)
        const gap = gapMap.get(hour)

        return (
          <div key={hour} className="contents">
            <div className="text-xs text-text-tertiary text-right pr-4 pt-2 font-medium">
              {formatHour(hour)}
            </div>
            <div className="border-t border-border min-h-[60px] py-2">
              {eventsAtHour.map((event, idx) => (
                <EventCard
                  key={event.id}
                  event={event}
                  colorIndex={idx}
                  expanded={expandedId === event.id}
                  onToggle={() => onToggleExpand(event.id)}
                  onEdit={() => onEdit(event)}
                  onDelete={() => onDelete(event)}
                  contextOpen={contextOpenId === event.id}
                  onToggleContext={() => onToggleContext(event.id)}
                />
              ))}
              {gap && (
                <GapSuggestionButton
                  gapMinutes={gap.minutes}
                  gapStart={gap.startTime}
                  beforeTitle={gap.before}
                  afterTitle={gap.after}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Week View ───────────────────────────────────────────────────────────────

function WeekView({ events, weekStart, onDayClick }: { events: CalendarEvent[]; weekStart: Date; onDayClick: (d: Date) => void }) {
  const today = new Date()
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // Build a map: dateKey -> events sorted by start_time
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const d of weekDays) {
      const key = toDateKey(d)
      map[key] = events
        .filter(e => e.start_time?.slice(0, 10) === key)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
    }
    return map
  }, [events, weekDays])

  return (
    <div className="overflow-x-auto">
      {/* Column headers */}
      <div className="grid grid-cols-[72px_repeat(7,1fr)] border-b border-border">
        <div /> {/* gutter */}
        {weekDays.map((d, i) => {
          const isToday = isSameDay(d, today)
          return (
            <button
              key={i}
              onClick={() => onDayClick(d)}
              className={cn(
                'text-center py-3 transition-colors hover:bg-surface-secondary',
                isToday && 'bg-primary/5'
              )}
            >
              <div className="text-xs text-text-tertiary font-medium">{DAY_NAMES[i]}</div>
              <div className={cn(
                'text-lg font-semibold mt-0.5',
                isToday ? 'text-primary' : 'text-text-primary'
              )}>
                {d.getDate()}
              </div>
            </button>
          )
        })}
      </div>

      {/* Hour rows */}
      {HOURS.map((hour) => (
        <div key={hour} className="grid grid-cols-[72px_repeat(7,1fr)] border-b border-border/50">
          <div className="text-xs text-text-tertiary text-right pr-4 pt-2 font-medium">
            {formatHour(hour)}
          </div>
          {weekDays.map((d, di) => {
            const key = toDateKey(d)
            const hourEvents = (eventsByDay[key] || []).filter(e => new Date(e.start_time).getHours() === hour)
            const isToday = isSameDay(d, today)
            return (
              <div
                key={di}
                className={cn(
                  'min-h-[52px] border-l border-border/50 px-1 py-1',
                  isToday && 'bg-primary/[0.02]'
                )}
              >
                {hourEvents.map((event, idx) => {
                  const start = new Date(event.start_time)
                  const end = new Date(event.end_time)
                  const timeStr = `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
                  const color = COLORS[idx % COLORS.length]
                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        'rounded-md px-2 py-1 mb-0.5 cursor-pointer border border-border hover:shadow-sm transition-shadow',
                        'bg-white'
                      )}
                      onClick={() => onDayClick(d)}
                    >
                      <div className="flex items-center gap-1">
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', color)} />
                        <span className="text-[11px] font-medium text-text-primary truncate">{event.title}</span>
                      </div>
                      <div className="text-[10px] text-text-tertiary ml-2.5 truncate">{timeStr}</div>
                    </motion.div>
                  )
                })}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── Month View ──────────────────────────────────────────────────────────────

function MonthView({ events, month, onDayClick }: { events: CalendarEvent[]; month: Date; onDayClick: (d: Date) => void }) {
  const today = new Date()
  const firstDay = startOfMonth(month)
  const totalDays = daysInMonth(month)

  // Monday-based: 0=Mon..6=Sun
  const firstDayOfWeek = (firstDay.getDay() + 6) % 7

  // Count events per day
  const eventCounts = useMemo(() => {
    const counts: Record<string, CalendarEvent[]> = {}
    for (const e of events) {
      const key = e.start_time?.slice(0, 10)
      if (key) {
        if (!counts[key]) counts[key] = []
        counts[key].push(e)
      }
    }
    return counts
  }, [events])

  // Build calendar grid (6 rows max)
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null) // leading blanks
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d))
  while (cells.length % 7 !== 0) cells.push(null) // trailing blanks

  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return (
    <div>
      {/* Header row */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_NAMES.map(name => (
          <div key={name} className="text-xs font-medium text-text-tertiary text-center py-2">
            {name}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-border/50">
          {week.map((day, di) => {
            if (!day) {
              return <div key={di} className="min-h-[96px] border-l border-border/50 first:border-l-0 bg-surface-secondary/30" />
            }

            const key = toDateKey(day)
            const dayEvts = eventCounts[key] || []
            const isToday = isSameDay(day, today)
            const isCurrentMonth = day.getMonth() === month.getMonth()

            return (
              <button
                key={di}
                onClick={() => onDayClick(day)}
                className={cn(
                  'min-h-[96px] border-l border-border/50 first:border-l-0 p-1.5 text-left transition-colors hover:bg-surface-secondary',
                  !isCurrentMonth && 'opacity-40'
                )}
              >
                <div className={cn(
                  'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-1',
                  isToday ? 'bg-primary text-white' : 'text-text-primary'
                )}>
                  {day.getDate()}
                </div>
                {/* Show up to 3 event previews */}
                <div className="space-y-0.5">
                  {dayEvts.slice(0, 3).map((evt, idx) => (
                    <EventCard key={evt.id} event={evt} colorIndex={idx} compact />
                  ))}
                  {dayEvts.length > 3 && (
                    <div className="text-[10px] text-text-tertiary pl-1.5">+{dayEvts.length - 3} more</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { t } = useI18n()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('day')
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editEventId, setEditEventId] = useState<string | null>(null)
  const [modalFormData, setModalFormData] = useState<EventFormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  // Expanded event in day view
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  // Context card open state
  const [contextOpenId, setContextOpenId] = useState<string | null>(null)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar')
      if (res.ok) {
        const data = await res.json()
        setEvents(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // ── Navigation ──

  const goToday = useCallback(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    setCurrentDate(d)
  }, [])

  const goPrev = useCallback(() => {
    setCurrentDate(prev => {
      if (view === 'day') return addDays(prev, -1)
      if (view === 'week') return addDays(prev, -7)
      // month
      return new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    })
  }, [view])

  const goNext = useCallback(() => {
    setCurrentDate(prev => {
      if (view === 'day') return addDays(prev, 1)
      if (view === 'week') return addDays(prev, 7)
      return new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    })
  }, [view])

  const handleDayClick = useCallback((d: Date) => {
    setCurrentDate(d)
    setView('day')
  }, [])

  // ── Event CRUD ──

  const openNewEventModal = useCallback(() => {
    const dateKey = toDateKey(currentDate)
    setEditEventId(null)
    setModalFormData({
      ...EMPTY_FORM,
      start_date: dateKey,
    })
    setShowModal(true)
  }, [currentDate])

  const openEditModal = useCallback((event: CalendarEvent) => {
    const start = new Date(event.start_time)
    const end = new Date(event.end_time)
    const attendees = typeof event.attendees === 'string' ? JSON.parse(event.attendees) : (event.attendees || [])

    setEditEventId(event.id)
    setModalFormData({
      title: event.title,
      description: event.description || '',
      start_date: toDateKey(start),
      start_time: start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      end_time: end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      location: event.location || '',
      attendees: attendees.map((a: any) => a.email).filter(Boolean).join(', '),
      create_meet_link: !!event.meeting_link,
    })
    setShowModal(true)
  }, [])

  const handleModalSubmit = useCallback(async (form: EventFormData) => {
    setSubmitting(true)
    try {
      const startISO = `${form.start_date}T${form.start_time}:00`
      const endISO = `${form.start_date}T${form.end_time}:00`
      const attendeeEmails = form.attendees
        ? form.attendees.split(',').map(e => e.trim()).filter(Boolean)
        : []

      if (editEventId) {
        // Update
        const res = await fetch('/api/calendar/events', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: editEventId,
            title: form.title,
            description: form.description || undefined,
            start_time: startISO,
            end_time: endISO,
            location: form.location || undefined,
            attendee_emails: attendeeEmails.length > 0 ? attendeeEmails : undefined,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to update event')
        }
      } else {
        // Create
        const res = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title,
            description: form.description || undefined,
            start_time: startISO,
            end_time: endISO,
            location: form.location || undefined,
            attendee_emails: attendeeEmails.length > 0 ? attendeeEmails : undefined,
            create_meet_link: form.create_meet_link,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to create event')
        }
      }

      setShowModal(false)
      setExpandedEventId(null)
      await fetchEvents()
    } catch (err) {
      console.error('Event submit error:', err)
      alert(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }, [editEventId, fetchEvents])

  const handleDeleteEvent = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: deleteTarget.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to delete event')
      }
      setDeleteTarget(null)
      setExpandedEventId(null)
      await fetchEvents()
    } catch (err) {
      console.error('Delete event error:', err)
      alert(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, fetchEvents])

  // ── Derived values ──

  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate])

  const subtitle = useMemo(() => {
    if (view === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    }
    if (view === 'week') {
      const end = addDays(weekStart, 6)
      const sameMonth = weekStart.getMonth() === end.getMonth()
      if (sameMonth) {
        return `${weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.getDate()}, ${end.getFullYear()}`
      }
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [view, currentDate, weekStart])

  const isToday = isSameDay(currentDate, new Date())

  // ── Count for day view header ──
  const dayEventCount = useMemo(() => {
    const key = toDateKey(currentDate)
    return events.filter(e => e.start_time?.slice(0, 10) === key).length
  }, [events, currentDate])

  return (
    <div>
      <TopBar title="Calendar" subtitle={subtitle} onSyncComplete={fetchEvents} />

      <div className="p-4 sm:p-6 lg:p-8">
        {/* Toolbar: View tabs + navigation */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          {/* Left: navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              className="p-2 hover:bg-surface-secondary rounded-lg transition-colors"
              aria-label={t('previous' as any)}
            >
              <ChevronLeft className="w-5 h-5 text-text-secondary" />
            </button>
            <button
              onClick={goNext}
              className="p-2 hover:bg-surface-secondary rounded-lg transition-colors"
              aria-label={t('next' as any)}
            >
              <ChevronRight className="w-5 h-5 text-text-secondary" />
            </button>
            <button
              onClick={goToday}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                isToday
                  ? 'text-text-tertiary cursor-default'
                  : 'text-primary hover:bg-primary/10'
              )}
              disabled={isToday}
            >
              Today
            </button>

            {view === 'day' && (
              <span className="text-sm text-text-tertiary ml-2">{dayEventCount} event{dayEventCount !== 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Right: new event + view tabs */}
          <div className="flex items-center gap-3">
            <button
              onClick={openNewEventModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('newEvent' as any)}
            </button>

            <div className="flex items-center bg-surface-secondary rounded-lg p-0.5">
              {VIEW_TAB_KEYS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setView(tab.key)}
                  className={cn(
                    'px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
                    view === tab.key
                      ? 'bg-white text-text-primary shadow-sm'
                      : 'text-text-tertiary hover:text-text-secondary'
                  )}
                >
                  {t(tab.labelKey as any)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
            <p className="text-sm text-text-tertiary mt-3">Loading calendar...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${view}-${toDateKey(currentDate)}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {view === 'day' && (
                <DayView
                  events={events}
                  date={currentDate}
                  expandedId={expandedEventId}
                  onToggleExpand={(id) => {
                    setExpandedEventId(prev => {
                      const next = prev === id ? null : id
                      if (next !== id) setContextOpenId(null)
                      return next
                    })
                  }}
                  onEdit={openEditModal}
                  onDelete={(event) => setDeleteTarget(event)}
                  contextOpenId={contextOpenId}
                  onToggleContext={(id) => setContextOpenId(prev => prev === id ? null : id)}
                />
              )}
              {view === 'week' && <WeekView events={events} weekStart={weekStart} onDayClick={handleDayClick} />}
              {view === 'month' && <MonthView events={events} month={currentDate} onDayClick={handleDayClick} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Create/Edit Event Modal */}
      <EventModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleModalSubmit}
        initialData={modalFormData}
        editEventId={editEventId}
        submitting={submitting}
      />

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteEvent}
        eventTitle={deleteTarget?.title || ''}
        deleting={deleting}
      />
    </div>
  )
}
