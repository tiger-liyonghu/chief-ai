'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Navigation, Clock, Copy, MapPin, Car, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect, useCallback, useRef } from 'react'
import { sendDepartureNotification } from '@/lib/notifications'

interface DepartureReminderProps {
  next_event_title: string
  next_event_time: string
  next_event_location: string
  minutes_until_depart: number
  depart_by: string
  address: string
  onDismiss: () => void
}

export function DepartureReminder({
  next_event_title,
  next_event_time,
  next_event_location,
  minutes_until_depart: initialMinutes,
  depart_by,
  address,
  onDismiss,
}: DepartureReminderProps) {
  const [minutesLeft, setMinutesLeft] = useState(initialMinutes)
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(true)
  const notifiedRef = useRef(false)

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setMinutesLeft(prev => Math.max(0, prev - 1))
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Sync with prop changes
  useEffect(() => {
    setMinutesLeft(initialMinutes)
  }, [initialMinutes])

  // Send browser notification when departure is within 15 minutes
  useEffect(() => {
    if (minutesLeft <= 15 && !notifiedRef.current) {
      notifiedRef.current = true
      sendDepartureNotification(next_event_title, minutesLeft, depart_by)
    }
  }, [minutesLeft, next_event_title, depart_by])

  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [address])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    setTimeout(onDismiss, 300)
  }, [onDismiss])

  const urgency = minutesLeft <= 5 ? 'critical' : minutesLeft <= 15 ? 'urgent' : 'normal'
  const bgColor = {
    critical: 'from-red-500 to-red-600',
    urgent: 'from-amber-500 to-orange-500',
    normal: 'from-blue-500 to-indigo-500',
  }[urgency]

  const grabUrl = `https://grab.onelink.me/2695613898?pid=inapp&c=grabapp`
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-4"
        >
          <div className={cn(
            'bg-gradient-to-r rounded-2xl p-4 sm:p-5 text-white shadow-2xl max-w-3xl mx-auto',
            bgColor,
          )}>
            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              aria-label="Dismiss reminder"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Navigation className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pr-6">
                {/* Main message */}
                <p className="font-semibold text-sm sm:text-base">
                  {minutesLeft <= 0
                    ? 'You should leave now!'
                    : `Leave in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}`
                  }
                </p>
                <p className="text-white/90 text-xs sm:text-sm mt-0.5">
                  {next_event_time} - {next_event_title} at {next_event_location}
                </p>

                {/* Countdown + depart by */}
                <div className="flex items-center gap-3 mt-2 text-white/80 text-xs sm:text-sm">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Depart by {depart_by}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <a
                    href={grabUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white text-gray-900 hover:bg-gray-100 transition-colors"
                  >
                    <Car className="w-3.5 h-3.5" />
                    Call Grab
                  </a>
                  <button
                    onClick={handleCopyAddress}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy Address'}
                  </button>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Open Maps
                  </a>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
