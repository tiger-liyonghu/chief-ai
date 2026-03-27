'use client'

import { motion } from 'framer-motion'
import { Car, Train, Footprints, Copy, MapPin, Clock, Navigation, AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useCallback } from 'react'

interface TransportCardProps {
  from_event: { title: string; end_time: string; location: string }
  to_event: { title: string; start_time: string; location: string }
  gap_minutes: number
  estimated_travel_minutes: number
  transport_mode: 'walk' | 'mrt' | 'taxi'
  estimated_cost: string
  suggested_departure: string
  google_maps_url: string
  route_summary?: string
  status: 'plenty_of_time' | 'tight' | 'warning'
}

const statusConfig = {
  plenty_of_time: {
    bg: 'bg-emerald-50 border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Plenty of time',
  },
  tight: {
    bg: 'bg-amber-50 border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
    label: 'Tight schedule',
  },
  warning: {
    bg: 'bg-red-50 border-red-200',
    badge: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
    label: 'Might be late',
  },
}

const modeConfig = {
  walk: { icon: Footprints, label: 'Walk', color: 'text-emerald-600' },
  mrt: { icon: Train, label: 'MRT', color: 'text-blue-600' },
  taxi: { icon: Car, label: 'Taxi / Grab', color: 'text-purple-600' },
}

export function TransportCard(props: TransportCardProps) {
  const {
    from_event, to_event, gap_minutes, estimated_travel_minutes,
    transport_mode, estimated_cost, suggested_departure,
    google_maps_url, route_summary, status,
  } = props

  const [copied, setCopied] = useState(false)
  const [reminderSet, setReminderSet] = useState(false)

  const sConfig = statusConfig[status]
  const mConfig = modeConfig[transport_mode]
  const ModeIcon = mConfig.icon

  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(to_event.location)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [to_event.location])

  const handleSetReminder = useCallback(() => {
    const key = `transport_reminder_${to_event.start_time}`
    const reminder = {
      event_title: to_event.title,
      event_time: to_event.start_time,
      depart_by: suggested_departure,
      location: to_event.location,
      created_at: new Date().toISOString(),
    }
    localStorage.setItem(key, JSON.stringify(reminder))
    setReminderSet(true)
    setTimeout(() => setReminderSet(false), 3000)
  }, [to_event, suggested_departure])

  const fromTime = new Date(from_event.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const toTime = new Date(to_event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-xl border p-4 sm:p-5', sConfig.bg)}
    >
      {/* Header: status + travel time */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', sConfig.dot)} />
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', sConfig.badge)}>
            {sConfig.label}
          </span>
          {status === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
        </div>
        <span className="text-xs text-text-tertiary">{gap_minutes} min gap</span>
      </div>

      {/* Route: from -> to */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex flex-col items-center gap-1 pt-1">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-text-tertiary" />
          <div className="w-0.5 h-8 bg-text-tertiary/30 rounded-full" />
          <MapPin className="w-3.5 h-3.5 text-text-tertiary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-3">
            <p className="text-xs text-text-tertiary">{fromTime} - {from_event.title}</p>
            <p className="text-sm font-medium text-text-primary truncate">{from_event.location}</p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary">{toTime} - {to_event.title}</p>
            <p className="text-sm font-medium text-text-primary truncate">{to_event.location}</p>
          </div>
        </div>
      </div>

      {/* Transport info row */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <ModeIcon className={cn('w-4 h-4', mConfig.color)} />
          <span className="text-sm font-medium text-text-primary">{mConfig.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-text-tertiary" />
          <span className="text-sm text-text-secondary">~{estimated_travel_minutes} min</span>
        </div>
        {transport_mode !== 'walk' && (
          <span className="text-sm text-text-secondary">{estimated_cost}</span>
        )}
        <div className="flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5 text-text-tertiary" />
          <span className="text-sm text-text-secondary">Leave by {suggested_departure}</span>
        </div>
      </div>

      {route_summary && (
        <p className="text-xs text-text-tertiary mb-3">{route_summary}</p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleCopyAddress}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-border hover:bg-surface-secondary transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy Address'}
        </button>
        <a
          href={google_maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-border hover:bg-surface-secondary transition-colors"
        >
          <MapPin className="w-3.5 h-3.5" />
          Open Maps
        </a>
        <button
          onClick={handleSetReminder}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
            reminderSet
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              : 'bg-white border border-border hover:bg-surface-secondary'
          )}
        >
          {reminderSet ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
          {reminderSet ? 'Reminder set' : 'Set Reminder'}
        </button>
      </div>
    </motion.div>
  )
}
