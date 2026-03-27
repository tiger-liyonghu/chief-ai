'use client'

import { motion } from 'framer-motion'
import { Bell, Clock, MapPin, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useCallback } from 'react'

interface AlarmSuggestionProps {
  first_meeting_time: string
  first_meeting_title: string
  first_meeting_location: string
  suggested_alarm: string
  commute_estimate: string
}

export function AlarmSuggestion({
  first_meeting_time,
  first_meeting_title,
  first_meeting_location,
  suggested_alarm,
  commute_estimate,
}: AlarmSuggestionProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyAlarm = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`Set alarm for ${suggested_alarm} - ${first_meeting_title} at ${first_meeting_location}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [suggested_alarm, first_meeting_title, first_meeting_location])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-sky-500 to-blue-500 rounded-2xl p-5 sm:p-6 text-white mb-6"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base mb-1">Tomorrow&apos;s First Meeting</h3>
          <p className="text-white/90 text-sm leading-relaxed">
            <span className="font-medium">{first_meeting_title}</span> at{' '}
            <span className="font-medium">{first_meeting_time}</span>
          </p>
          <div className="flex items-center gap-4 mt-2 text-white/80 text-sm flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {first_meeting_location}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              ~{commute_estimate} commute
            </span>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm font-semibold">
              Suggested alarm: {suggested_alarm}
            </div>
            <button
              onClick={handleCopyAlarm}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                copied
                  ? 'bg-white/30 text-white'
                  : 'bg-white/15 hover:bg-white/25 text-white/90'
              )}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
