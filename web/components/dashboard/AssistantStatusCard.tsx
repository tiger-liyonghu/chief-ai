'use client'

import { motion } from 'framer-motion'
import { Eye } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { useEffect, useState } from 'react'

interface AssistantStatusCardProps {
  signals: number
  meetingsPrepped: number
  followUpsTracked: number
}

export function AssistantStatusCard({
  signals,
  meetingsPrepped,
  followUpsTracked,
}: AssistantStatusCardProps) {
  const { t } = useI18n()
  const [assistantName, setAssistantName] = useState('Chief')

  useEffect(() => {
    async function fetchName() {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          if (data.assistant_name) setAssistantName(data.assistant_name)
        }
      } catch {
        // use default
      }
    }
    fetchName()
  }, [])

  const statusParts = [
    signals > 0 ? t('assistantSignals' as any, { n: signals }) || `${signals} signal${signals !== 1 ? 's' : ''} detected` : null,
    meetingsPrepped > 0 ? t('assistantMeetings' as any, { n: meetingsPrepped }) || `${meetingsPrepped} meeting${meetingsPrepped !== 1 ? 's' : ''} prepped` : null,
    followUpsTracked > 0 ? t('assistantFollowUps' as any, { n: followUpsTracked }) || `${followUpsTracked} follow-up${followUpsTracked !== 1 ? 's' : ''} tracked` : null,
  ].filter(Boolean)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-8 bg-white rounded-2xl border border-border p-5"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
          <Eye className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">
            {assistantName} {t('assistantWatching' as any) || 'is watching over your inbox'}
          </p>
          {statusParts.length > 0 && (
            <p className="text-xs text-text-tertiary mt-0.5">
              {statusParts.join(' \u00b7 ')}
            </p>
          )}
          {statusParts.length === 0 && (
            <p className="text-xs text-text-tertiary mt-0.5">
              {t('assistantAllClear' as any) || 'All clear. Nothing needs your attention right now.'}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
