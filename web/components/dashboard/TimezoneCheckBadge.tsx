'use client'

import { useState, useCallback } from 'react'
import { Clock, Send, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface TimezoneInfo {
  contact_email: string
  contact_timezone: string
  contact_local_time: string
  is_business_hours: boolean
  suggestion: string
  suggested_send_time_utc: string | null
}

/**
 * TimezoneCheckBadge — shows recipient's local time when composing a reply.
 * Fetches from /api/timezone-check?email=xxx
 */
export function TimezoneCheckBadge({ email }: { email: string }) {
  const [data, setData] = useState<TimezoneInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const checkTimezone = useCallback(async () => {
    if (!email || loading || data) return
    setLoading(true)
    try {
      const res = await fetch(`/api/timezone-check?email=${encodeURIComponent(email)}`)
      if (res.ok) {
        const info = await res.json()
        setData(info)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [email, loading, data])

  // Auto-fetch on mount
  if (!data && !loading && !error) {
    checkTimezone()
  }

  if (error || !data) return null

  const localTime = new Date(data.contact_local_time).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
          data.is_business_hours
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}
      >
        {data.is_business_hours ? (
          <Clock className="w-3 h-3" />
        ) : (
          <AlertTriangle className="w-3 h-3" />
        )}
        <span>
          {localTime} their time
          {!data.is_business_hours && ' (outside business hours)'}
        </span>
      </motion.div>
    </AnimatePresence>
  )
}
