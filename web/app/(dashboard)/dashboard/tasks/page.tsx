'use client'

import { motion } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import {
  CheckSquare,
  Clock,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  Bell,
  Calendar,
  Users,
  MapPin,
  Video,
  Sparkles,
  MessageSquare,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Plus,
  X,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'

type MainTab = 'tasks' | 'followUps' | 'meetings'
const taskFilters = ['All', 'Urgent', 'This Week', 'Later', 'Done'] as const
type TaskFilter = typeof taskFilters[number]
const followUpTabs = ['Active', 'Resolved'] as const

/* ─── Helpers ─── */
function daysOverdue(dueDateStr: string | null): number {
  if (!dueDateStr) return 0
  const diff = Date.now() - new Date(dueDateStr).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

function groupByDay(events: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {}
  for (const event of events) {
    const dayKey = new Date(event.start_time).toDateString()
    if (!groups[dayKey]) groups[dayKey] = []
    groups[dayKey].push(event)
  }
  return groups
}

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown'
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}

/* ─── Tasks Tab Content ─── */
type AddTaskPriority = 'Urgent' | 'This Week' | 'Later'

function TasksTab() {
  const { t } = useI18n()
  const priorityConfig: Record<number, { label: string; color: string }> = {
    1: { label: t('urgentLabel'), color: 'bg-red-100 text-red-700' },
    2: { label: t('thisWeekLabel'), color: 'bg-amber-100 text-amber-700' },
    3: { label: t('laterLabel'), color: 'bg-blue-100 text-blue-700' },
  }
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('All')
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addTitle, setAddTitle] = useState('')
  const [addPriority, setAddPriority] = useState<AddTaskPriority>('This Week')
  const [addDueDate, setAddDueDate] = useState('')
  const [addNote, setAddNote] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const filteredTasks = tasks.filter(t => {
    if (activeFilter === 'All') return t.status !== 'done'
    if (activeFilter === 'Urgent') return t.priority === 1 && t.status !== 'done'
    if (activeFilter === 'This Week') return t.priority === 2 && t.status !== 'done'
    if (activeFilter === 'Later') return t.priority === 3 && t.status !== 'done'
    if (activeFilter === 'Done') return t.status === 'done'
    return true
  })

  const toggleDone = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'pending' : 'done'
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
  }

  const handleAddTask = async () => {
    if (!addTitle.trim() || addSaving) return
    setAddSaving(true)

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: addTitle.trim(),
          priority: addPriority,
          due_date: addDueDate || undefined,
          due_reason: addNote || undefined,
        }),
      })

      if (res.ok) {
        const newTask = await res.json()
        setTasks(prev => [newTask, ...prev])
        setAddTitle('')
        setAddPriority('This Week')
        setAddDueDate('')
        setAddNote('')
        setShowAddForm(false)
      }
    } catch {
      // Silently fail
    } finally {
      setAddSaving(false)
    }
  }

  return (
    <div>
      {/* Filters + Add Task */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {taskFilters.map((f) => {
          const filterLabels: Record<TaskFilter, string> = {
            'All': t('all'),
            'Urgent': t('urgent'),
            'This Week': t('thisWeek'),
            'Later': t('later'),
            'Done': t('done'),
          }
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                activeFilter === f
                  ? 'bg-primary text-white'
                  : 'bg-white border border-border text-text-secondary hover:bg-surface-secondary'
              )}
            >
              {filterLabels[f]}
            </button>
          )
        })}
        <div className="flex-1" />
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
            showAddForm
              ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              : 'bg-primary text-white hover:bg-primary/90 shadow-sm'
          )}
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? t('cancel' as any) || 'Cancel' : t('addTask' as any) || 'Add Task'}
        </button>
      </div>

      {/* Add Task Form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-6 bg-white rounded-xl border border-border p-5"
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                {t('taskTitle' as any) || 'Task title'} *
              </label>
              <input
                type="text"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder={t('taskTitlePlaceholder' as any) || 'What needs to be done?'}
                className="w-full px-4 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && addTitle.trim()) handleAddTask() }}
              />
            </div>

            <div className="flex items-start gap-4 flex-wrap">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                  {t('priority' as any) || 'Priority'}
                </label>
                <div className="flex items-center gap-1.5">
                  {(['Urgent', 'This Week', 'Later'] as AddTaskPriority[]).map((p) => {
                    const pConfig: Record<AddTaskPriority, { label: string; color: string; activeColor: string }> = {
                      'Urgent': { label: t('urgent') || 'Urgent', color: 'border-border text-text-secondary hover:border-red-200', activeColor: 'bg-red-100 text-red-700 border-red-200' },
                      'This Week': { label: t('thisWeek') || 'This Week', color: 'border-border text-text-secondary hover:border-amber-200', activeColor: 'bg-amber-100 text-amber-700 border-amber-200' },
                      'Later': { label: t('later') || 'Later', color: 'border-border text-text-secondary hover:border-blue-200', activeColor: 'bg-blue-100 text-blue-700 border-blue-200' },
                    }
                    const cfg = pConfig[p]
                    return (
                      <button
                        key={p}
                        onClick={() => setAddPriority(p)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200',
                          addPriority === p ? cfg.activeColor : cfg.color
                        )}
                      >
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                  {t('dueDate' as any) || 'Due date'}
                </label>
                <input
                  type="date"
                  value={addDueDate}
                  onChange={(e) => setAddDueDate(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                {t('noteOptional' as any) || 'Note (optional)'}
              </label>
              <input
                type="text"
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                placeholder={t('notePlaceholder' as any) || 'Why is this important?'}
                className="w-full px-4 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleAddTask}
                disabled={!addTitle.trim() || addSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {addSaving ? (t('saving' as any) || 'Saving...') : (t('addTask' as any) || 'Add Task')}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
          <p className="text-sm text-text-tertiary mt-3">{t('loadingTasks')}</p>
        </div>
      ) : (
        <>
          <motion.div
            initial="initial"
            animate="animate"
            variants={{ animate: { transition: { staggerChildren: 0.03 } } }}
            className="space-y-2"
          >
            {filteredTasks.map((task) => {
              const p = priorityConfig[task.priority] || priorityConfig[3]
              const from = task.source_email?.from_name || task.source_email?.from_address || t('manual')
              return (
                <motion.div
                  key={task.id}
                  variants={{ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } }}
                  className={cn(
                    'flex items-start gap-4 p-4 bg-white rounded-xl border border-border hover:shadow-sm transition-all duration-200',
                    task.status === 'done' && 'opacity-50'
                  )}
                >
                  <button
                    onClick={() => toggleDone(task.id, task.status)}
                    className={cn(
                      'w-5 h-5 rounded-md border-2 mt-0.5 transition-all duration-200 shrink-0',
                      task.status === 'done'
                        ? 'bg-primary border-primary'
                        : 'border-border hover:border-primary'
                    )}
                  >
                    {task.status === 'done' && (
                      <svg className="w-full h-full text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium', task.status === 'done' ? 'line-through text-text-tertiary' : 'text-text-primary')}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      {task.due_reason && (
                        <span className="text-xs text-text-tertiary">{task.due_reason}</span>
                      )}
                      <span className="text-xs text-text-tertiary">{t('from')} {from}</span>
                    </div>
                  </div>

                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${p.color}`}>
                    {p.label}
                  </span>
                </motion.div>
              )
            })}
          </motion.div>

          {filteredTasks.length === 0 && (
            <div className="text-center py-16">
              <CheckSquare className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
              <p className="text-text-secondary font-medium">{t('noTasksHere')}</p>
              <p className="text-sm text-text-tertiary mt-1">{t('syncToGetTasks')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ─── Follow-ups Tab Content ─── */
function FollowUpsTab() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<typeof followUpTabs[number]>('Active')
  const [followUps, setFollowUps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFollowUps = useCallback(async () => {
    try {
      const res = await fetch('/api/follow-ups')
      if (res.ok) {
        const data = await res.json()
        setFollowUps(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchFollowUps() }, [fetchFollowUps])

  const filtered = followUps.filter(fu =>
    activeTab === 'Active' ? fu.status === 'active' : fu.status === 'resolved'
  )

  const overdue = followUps.filter(fu => fu.status === 'active' && daysOverdue(fu.due_date) > 0)

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex items-center gap-2 mb-6">
        {followUpTabs.map((tab) => {
          const tabLabels: Record<typeof followUpTabs[number], string> = {
            'Active': t('active'),
            'Resolved': t('resolved'),
          }
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                activeTab === tab
                  ? 'bg-primary text-white'
                  : 'bg-white border border-border text-text-secondary hover:bg-surface-secondary'
              )}
            >
              {tabLabels[tab]}
            </button>
          )
        })}
      </div>

      {/* Overdue Banner */}
      {activeTab === 'Active' && overdue.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3"
        >
          <Bell className="w-5 h-5 text-danger" />
          <p className="text-sm text-red-800">
            {t('followUpsOverdue', { n: overdue.length })}
          </p>
        </motion.div>
      )}

      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
          <p className="text-sm text-text-tertiary mt-3">{t('loadingFollowUps')}</p>
        </div>
      ) : (
        <>
          <motion.div
            initial="initial"
            animate="animate"
            variants={{ animate: { transition: { staggerChildren: 0.04 } } }}
            className="space-y-2"
          >
            {filtered.map((fu) => {
              const overdueDays = daysOverdue(fu.due_date)
              return (
                <motion.div
                  key={fu.id}
                  variants={{ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } }}
                  className={cn(
                    'flex items-center gap-4 p-4 bg-white rounded-xl border transition-all duration-200',
                    overdueDays > 0 ? 'border-red-200' : 'border-border'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    fu.type === 'i_promised' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                  )}>
                    {fu.type === 'i_promised' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">{fu.contact_name}</p>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        fu.type === 'i_promised' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      )}>
                        {fu.type === 'i_promised' ? t('youPromised') : t('waitingOnThem')}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5 truncate">{fu.subject}</p>
                    {fu.due_date && <p className="text-xs text-text-tertiary mt-0.5">{t('due')} {fu.due_date}</p>}
                  </div>

                  {overdueDays > 0 && (
                    <span className="text-xs font-medium text-danger bg-red-50 px-2.5 py-1 rounded-full">
                      {t('dOverdue', { n: overdueDays })}
                    </span>
                  )}
                </motion.div>
              )
            })}
          </motion.div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <Clock className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
              <p className="text-text-secondary font-medium">
                {activeTab === 'Active' ? t('noActiveFollowUpsTitle') : t('noResolvedFollowUps')}
              </p>
              <p className="text-sm text-text-tertiary mt-1">
                {t('followUpsAutoDetected')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ─── Meetings Tab Content ─── */
function MeetingsTab() {
  const { t } = useI18n()
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [generatedData, setGeneratedData] = useState<Record<string, any>>({})
  const [error, setError] = useState<string | null>(null)

  const fetchMeetings = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/meetings')
      if (res.ok) {
        const data = await res.json()
        setEvents(data)
      } else {
        const err = await res.json()
        setError(err.error || 'Failed to load meetings')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMeetings() }, [fetchMeetings])

  const generateBrief = async (eventId: string) => {
    setGeneratingFor(eventId)
    setError(null)
    try {
      const res = await fetch('/api/meetings/generate-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Failed to generate brief')
        return
      }

      const data = await res.json()
      setEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, briefs: data.briefs } : e
      ))
      setGeneratedData(prev => ({ ...prev, [eventId]: data }))
      setExpandedEvent(eventId)
    } catch (err: any) {
      setError(err.message || 'Failed to generate brief')
    } finally {
      setGeneratingFor(null)
    }
  }

  const dayGroups = groupByDay(events)

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
          <p className="text-sm text-text-tertiary mt-3">Loading meetings...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
          <p className="text-text-secondary font-medium">No upcoming meetings</p>
          <p className="text-sm text-text-tertiary mt-1">
            Click &quot;Sync now&quot; to pull your Google Calendar events
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(dayGroups).map(([dayKey, dayEvents]) => (
            <div key={dayKey}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                  {formatDateLabel(dayEvents[0].start_time)}
                </h2>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-text-tertiary">
                  {dayEvents.length} {dayEvents.length === 1 ? 'meeting' : 'meetings'}
                </span>
              </div>

              <motion.div
                initial="initial"
                animate="animate"
                variants={{ animate: { transition: { staggerChildren: 0.05 } } }}
                className="space-y-3"
              >
                {dayEvents.map((event) => {
                  const isExpanded = expandedEvent === event.id
                  const hasBriefs = event.briefs && event.briefs.length > 0
                  const isGenerating = generatingFor === event.id
                  const extraData = generatedData[event.id]
                  const attendees = typeof event.attendees === 'string' ? JSON.parse(event.attendees) : (event.attendees || [])

                  return (
                    <motion.div
                      key={event.id}
                      variants={{ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } }}
                      className="bg-white rounded-xl border border-border overflow-hidden"
                    >
                      <div className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-primary">
                                {formatTime(event.start_time)}
                              </span>
                              <span className="text-xs text-text-tertiary">-</span>
                              <span className="text-sm text-text-tertiary">
                                {formatTime(event.end_time)}
                              </span>
                            </div>
                            <h3 className="text-base font-medium text-text-primary truncate">
                              {event.title}
                            </h3>
                            <div className="flex items-center gap-4 mt-2 flex-wrap">
                              {attendees.length > 0 && (
                                <span className="flex items-center gap-1 text-xs text-text-tertiary">
                                  <Users className="w-3.5 h-3.5" />
                                  {attendees.length} {t('attendees')}
                                </span>
                              )}
                              {event.location && (
                                <span className="flex items-center gap-1 text-xs text-text-tertiary">
                                  <MapPin className="w-3.5 h-3.5" />
                                  <span className="truncate max-w-[150px]">{event.location}</span>
                                </span>
                              )}
                              {event.meeting_link && (
                                <a
                                  href={event.meeting_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  {t('joinMeeting')}
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {hasBriefs ? (
                              <button
                                onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary-light rounded-lg hover:bg-primary/15 transition-all duration-200"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                View Prep
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            ) : (
                              <button
                                onClick={() => generateBrief(event.id)}
                                disabled={isGenerating}
                                className={cn(
                                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
                                  isGenerating
                                    ? 'bg-surface-secondary text-text-tertiary cursor-not-allowed'
                                    : 'bg-primary text-white hover:bg-primary/90'
                                )}
                              >
                                {isGenerating ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Generate Prep
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded brief content */}
                      {isExpanded && hasBriefs && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-border"
                        >
                          <div className="p-4 sm:p-5 space-y-5">
                            <div>
                              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" />
                                Attendees
                              </h4>
                              <div className="space-y-2">
                                {event.briefs.map((brief: any) => (
                                  <div
                                    key={brief.id}
                                    className="flex items-start gap-3 p-3 bg-surface-secondary rounded-lg"
                                  >
                                    <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center shrink-0">
                                      <span className="text-xs font-semibold text-primary">
                                        {(brief.attendee_name || brief.attendee_email || '?')[0].toUpperCase()}
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-text-primary">
                                        {brief.attendee_name || brief.attendee_email || 'Unknown'}
                                      </p>
                                      {brief.attendee_email && brief.attendee_name && (
                                        <p className="text-xs text-text-tertiary">{brief.attendee_email}</p>
                                      )}
                                      {brief.interaction_summary && (
                                        <p className="text-xs text-text-secondary mt-1">
                                          {brief.interaction_summary}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-3 mt-1.5">
                                        {brief.last_contact_date && (
                                          <span className="flex items-center gap-1 text-xs text-text-tertiary">
                                            <Clock className="w-3 h-3" />
                                            Last contact: {relativeDate(brief.last_contact_date)}
                                          </span>
                                        )}
                                        {brief.email_count > 0 && (
                                          <span className="text-xs text-text-tertiary">
                                            {brief.email_count} emails
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {extraData?.open_items && extraData.open_items.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  Open Items
                                </h4>
                                <ul className="space-y-1.5">
                                  {extraData.open_items.map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 shrink-0" />
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {event.briefs[0]?.talking_points?.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  Suggested Talking Points
                                </h4>
                                <ul className="space-y-1.5">
                                  {event.briefs[0].talking_points.map((point: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                                      <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 shrink-0" />
                                      {point}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {event.briefs[0]?.related_documents?.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5" />
                                  Related Documents
                                </h4>
                                <ul className="space-y-1.5">
                                  {event.briefs[0].related_documents.map((doc: string, i: number) => (
                                    <li key={i} className="text-sm text-text-secondary flex items-center gap-2">
                                      <FileText className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                                      {doc}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="pt-2 border-t border-border">
                              <button
                                onClick={() => generateBrief(event.id)}
                                disabled={isGenerating}
                                className="text-xs text-text-tertiary hover:text-primary transition-colors duration-200 flex items-center gap-1"
                              >
                                <Sparkles className="w-3 h-3" />
                                Regenerate brief
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  )
                })}
              </motion.div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Main Tasks Page ─── */
export default function TasksPage() {
  const { t } = useI18n()
  const [mainTab, setMainTab] = useState<MainTab>('tasks')

  const mainTabs: { key: MainTab; label: string; icon: any }[] = [
    { key: 'tasks', label: t('tasks'), icon: CheckSquare },
    { key: 'followUps', label: t('followUps'), icon: Clock },
    { key: 'meetings', label: t('meetings'), icon: Calendar },
  ]

  return (
    <div>
      <TopBar title={t('tasks')} subtitle="" />

      <div className="p-4 sm:p-6 lg:p-8">
        {/* Main Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-border pb-4">
          {mainTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setMainTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  mainTab === tab.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-white border border-border text-text-secondary hover:bg-surface-secondary'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        {mainTab === 'tasks' && <TasksTab />}
        {mainTab === 'followUps' && <FollowUpsTab />}
        {mainTab === 'meetings' && <MeetingsTab />}
      </div>
    </div>
  )
}
