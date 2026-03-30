'use client'

import { motion } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import {
  Heart,
  Shield,
  Star,
  GraduationCap,
  Gift,
  Plus,
  Calendar,
  Repeat,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

/* ─── Types ─── */

interface FamilyEvent {
  id: string
  event_type: 'hard_constraint' | 'important_date' | 'school_cycle' | 'family_commitment'
  title: string
  description: string | null
  start_date: string
  end_date: string | null
  start_time: string | null
  end_time: string | null
  recurrence: string
  recurrence_day: number | null
  family_member: string | null
  source: string
  is_active: boolean
  remind_days_before: number
}

/* ─── Helpers ─── */

const typeConfig = {
  hard_constraint: { icon: Shield, color: 'text-red-600 bg-red-50 border-red-200', label: 'hardConstraints' },
  important_date: { icon: Star, color: 'text-amber-600 bg-amber-50 border-amber-200', label: 'importantDates' },
  school_cycle: { icon: GraduationCap, color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'schoolCycles' },
  family_commitment: { icon: Gift, color: 'text-pink-600 bg-pink-50 border-pink-200', label: 'familyCommitmentsCalendar' },
} as const

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/* ─── Event Card ─── */

function EventCard({ event, t, onDelete }: { event: FamilyEvent; t: ReturnType<typeof useI18n>['t']; onDelete: () => void }) {
  const config = typeConfig[event.event_type]
  const Icon = config.icon

  return (
    <div className={cn('border rounded-xl p-4 transition-all hover:shadow-sm', config.color)}>
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-white/60">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{event.title}</span>
            {event.family_member && (
              <span className="text-xs px-1.5 py-0.5 bg-white/60 rounded-full">{event.family_member}</span>
            )}
          </div>
          {event.description && (
            <p className="text-xs opacity-75 mb-2">{event.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs opacity-60">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {event.start_date}
              {event.end_date && event.end_date !== event.start_date && ` → ${event.end_date}`}
            </span>
            {event.start_time && (
              <span>{event.start_time}{event.end_time ? ` - ${event.end_time}` : ''}</span>
            )}
            {event.recurrence !== 'none' && (
              <span className="flex items-center gap-1">
                <Repeat className="w-3 h-3" />
                {event.recurrence === 'weekly' ? `${t('everyWeek')} (${dayNames[event.recurrence_day || 0]})` :
                 event.recurrence === 'monthly' ? t('everyMonth') :
                 event.recurrence === 'yearly' ? t('everyYear') : event.recurrence}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg hover:bg-white/60 opacity-40 hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

/* ─── Add Event Form ─── */

function AddEventForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n()
  const [eventType, setEventType] = useState<FamilyEvent['event_type']>('important_date')
  const [title, setTitle] = useState('')
  const [familyMember, setFamilyMember] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [recurrence, setRecurrence] = useState('none')
  const [recurrenceDay, setRecurrenceDay] = useState(0)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !startDate) return
    setSaving(true)
    await fetch('/api/family-calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: eventType,
        title: title.trim(),
        family_member: familyMember.trim() || undefined,
        start_date: startDate,
        end_date: endDate || undefined,
        start_time: startTime || undefined,
        recurrence,
        recurrence_day: recurrence === 'weekly' ? recurrenceDay : undefined,
      }),
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4">{t('addFamilyEvent')}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type selector */}
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(typeConfig) as FamilyEvent['event_type'][]).map((tp) => {
              const cfg = typeConfig[tp]
              const TypeIcon = cfg.icon
              return (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setEventType(tp)}
                  className={cn('flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-colors', {
                    [cfg.color]: eventType === tp,
                    'bg-slate-50 border-slate-200 text-slate-500': eventType !== tp,
                  })}
                >
                  <TypeIcon className="w-3.5 h-3.5" />
                  {t(cfg.label)}
                </button>
              )
            })}
          </div>

          <input
            type="text"
            placeholder={t('addFamilyEvent')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            autoFocus
          />

          <input
            type="text"
            placeholder="Emily, 老婆, 全家..."
            value={familyMember}
            onChange={(e) => setFamilyMember(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          {eventType === 'hard_constraint' && (
            <>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Time" />
              <div className="flex gap-2 items-center">
                <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="none">No repeat</option>
                  <option value="weekly">{t('everyWeek')}</option>
                  <option value="monthly">{t('everyMonth')}</option>
                </select>
                {recurrence === 'weekly' && (
                  <select value={recurrenceDay} onChange={(e) => setRecurrenceDay(Number(e.target.value))}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                    {dayNames.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                )}
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving || !title.trim() || !startDate} className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {saving ? '...' : t('addFamilyEvent')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

/* ─── Main Page ─── */

export default function FamilyCalendarPage() {
  const { t } = useI18n()
  const [events, setEvents] = useState<FamilyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)

  const fetchData = useCallback(async () => {
    const url = filter === 'all' ? '/api/family-calendar' : `/api/family-calendar?type=${filter}`
    const res = await fetch(url)
    if (res.ok) setEvents(await res.json())
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: string) => {
    await fetch(`/api/family-calendar?id=${id}`, { method: 'DELETE' })
    fetchData()
  }

  // Group by type
  const grouped = {
    hard_constraint: events.filter(e => e.event_type === 'hard_constraint'),
    important_date: events.filter(e => e.event_type === 'important_date'),
    school_cycle: events.filter(e => e.event_type === 'school_cycle'),
    family_commitment: events.filter(e => e.event_type === 'family_commitment'),
  }

  return (
    <div className="min-h-screen bg-surface-primary">
      <TopBar title={t('familyCalendar')} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-50 rounded-xl">
              <Heart className="w-6 h-6 text-pink-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{t('familyCalendar')}</h1>
              <p className="text-sm text-slate-500">{events.length} events</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl text-sm font-medium hover:bg-pink-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('addFamilyEvent')}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && events.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Heart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('noFamilyEvents')}</p>
          </div>
        )}

        {/* Grouped sections */}
        {!loading && Object.entries(grouped).map(([type, items]) => {
          if (items.length === 0) return null
          const config = typeConfig[type as FamilyEvent['event_type']]
          const Icon = config.icon
          return (
            <div key={type} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Icon className="w-4 h-4" />
                <h2 className="text-sm font-semibold">{t(config.label)} ({items.length})</h2>
              </div>
              {items.map((event) => (
                <motion.div key={event.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <EventCard event={event} t={t} onDelete={() => handleDelete(event.id)} />
                </motion.div>
              ))}
            </div>
          )
        })}
      </div>

      {showAddForm && <AddEventForm onClose={() => setShowAddForm(false)} onSaved={fetchData} />}
    </div>
  )
}
