'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import { useI18n } from '@/lib/i18n/context'
import {
  Mail,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Types ─── */

interface EmailItem {
  id: string
  from_name: string | null
  from_address: string
  subject: string
  snippet: string
  received_at: string
  is_reply_needed: boolean
  body_text?: string
}

interface WhatsAppMessage {
  id: string
  from_name: string | null
  from_number: string
  to_number: string
  body: string
  received_at: string
  direction: 'inbound' | 'outbound'
  message_type: string
}

interface UnifiedMessage {
  id: string
  channel: 'email' | 'whatsapp'
  sender: string
  subject: string
  preview: string
  timestamp: string
  raw: EmailItem | WhatsAppMessage
}

type ChannelFilter = 'all' | 'email' | 'whatsapp'

/* ─── Helpers ─── */

function timeAgo(dateStr: string, t: (key: any, params?: Record<string, string | number>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return t('mAgo', { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('hAgo', { n: hours })
  const days = Math.floor(hours / 24)
  return t('dAgo', { n: days })
}

/* ─── Fade animation ─── */

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
}

/* ─── Component ─── */

export default function InboxPage() {
  const { t } = useI18n()
  const [emails, setEmails] = useState<EmailItem[]>([])
  const [waMessages, setWaMessages] = useState<WhatsAppMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ChannelFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedBody, setExpandedBody] = useState<string | null>(null)
  const [bodyLoading, setBodyLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [emailsRes, waRes] = await Promise.allSettled([
        fetch('/api/emails').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/whatsapp/messages?limit=50').then((r) => (r.ok ? r.json() : [])),
      ])

      setEmails(emailsRes.status === 'fulfilled' ? emailsRes.value : [])
      setWaMessages(waRes.status === 'fulfilled' ? waRes.value : [])
    } catch {
      // Silently degrade
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Build unified timeline
  const unified: UnifiedMessage[] = []

  for (const email of emails) {
    unified.push({
      id: `email-${email.id}`,
      channel: 'email',
      sender: email.from_name || email.from_address,
      subject: email.subject,
      preview: email.snippet || '',
      timestamp: email.received_at,
      raw: email,
    })
  }

  for (const msg of waMessages) {
    if (msg.direction !== 'inbound') continue
    unified.push({
      id: `wa-${msg.id}`,
      channel: 'whatsapp',
      sender: msg.from_name || msg.from_number,
      subject: '',
      preview: msg.body || `[${msg.message_type}]`,
      timestamp: msg.received_at,
      raw: msg,
    })
  }

  // Sort by time descending
  unified.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Apply filter
  const filtered = filter === 'all' ? unified : unified.filter((m) => m.channel === filter)

  const handleExpand = async (item: UnifiedMessage) => {
    if (expandedId === item.id) {
      setExpandedId(null)
      setExpandedBody(null)
      return
    }

    setExpandedId(item.id)
    setExpandedBody(null)

    if (item.channel === 'email') {
      const email = item.raw as EmailItem
      setBodyLoading(true)
      try {
        const res = await fetch(`/api/emails/${email.id}`)
        if (res.ok) {
          const data = await res.json()
          setExpandedBody(data.body || email.snippet || '')
        } else {
          setExpandedBody(email.snippet || '')
        }
      } catch {
        setExpandedBody(email.snippet || '')
      } finally {
        setBodyLoading(false)
      }
    } else {
      const msg = item.raw as WhatsAppMessage
      setExpandedBody(msg.body || '')
    }
  }

  const filterTabs: { key: ChannelFilter; labelKey: string }[] = [
    { key: 'all', labelKey: 'allChannels' },
    { key: 'email', labelKey: 'emailChannel' },
    { key: 'whatsapp', labelKey: 'whatsappChannel' },
  ]

  return (
    <div>
      <TopBar
        title={t('unifiedInbox' as any) || 'Inbox'}
        subtitle={`${filtered.length} messages`}
        onSyncComplete={fetchData}
      />

      <div className="p-4 sm:p-6 lg:p-8">
        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-6">
          {filterTabs.map((tab) => {
            const count =
              tab.key === 'all'
                ? unified.length
                : unified.filter((m) => m.channel === tab.key).length
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2',
                  filter === tab.key
                    ? 'bg-primary text-white'
                    : 'bg-white border border-border text-text-secondary hover:bg-surface-secondary'
                )}
              >
                {tab.key === 'email' && <Mail className="w-3.5 h-3.5" />}
                {tab.key === 'whatsapp' && <MessageCircle className="w-3.5 h-3.5" />}
                {t(tab.labelKey as any)}
                {count > 0 && (
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full font-medium',
                      filter === tab.key ? 'bg-white/20 text-white' : 'bg-surface-secondary text-text-tertiary'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Message list */}
        {loading ? (
          <div className="text-center py-24">
            <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
            <p className="text-sm text-text-tertiary mt-4">{t('loading')}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <Inbox className="w-14 h-14 text-text-tertiary mx-auto mb-4" />
            <p className="text-text-secondary font-medium">{t('noMessages' as any)}</p>
            <p className="text-sm text-text-tertiary mt-1">{t('noMessagesHint' as any)}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((item) => {
                const isExpanded = expandedId === item.id
                return (
                  <motion.div
                    key={item.id}
                    layout
                    variants={fadeUp}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="bg-white rounded-xl border border-border overflow-hidden hover:shadow-sm transition-shadow"
                  >
                    <button
                      onClick={() => handleExpand(item)}
                      className="w-full text-left p-4 flex items-start gap-3"
                    >
                      {/* Channel icon */}
                      <div
                        className={cn(
                          'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 mt-0.5',
                          item.channel === 'email'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-green-100 text-green-600'
                        )}
                      >
                        {item.channel === 'email' ? (
                          <Mail className="w-4 h-4" />
                        ) : (
                          <MessageCircle className="w-4 h-4" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary truncate">
                            {item.sender}
                          </span>
                          {item.channel === 'email' && (item.raw as EmailItem).is_reply_needed && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">
                              {t('needsReply')}
                            </span>
                          )}
                        </div>
                        {item.subject && (
                          <p className="text-sm text-text-secondary truncate">{item.subject}</p>
                        )}
                        <p className="text-xs text-text-tertiary truncate mt-0.5">{item.preview}</p>
                      </div>

                      {/* Time + expand indicator */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-text-tertiary whitespace-nowrap">
                          {timeAgo(item.timestamp, t)}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-text-tertiary" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-text-tertiary" />
                        )}
                      </div>
                    </button>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-border bg-surface-secondary/50 overflow-hidden"
                        >
                          <div className="p-4">
                            {bodyLoading ? (
                              <div className="flex items-center gap-2 py-4">
                                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                <span className="text-sm text-text-tertiary">{t('loading')}</span>
                              </div>
                            ) : (
                              <div className="text-sm text-text-secondary leading-relaxed max-h-[400px] overflow-y-auto">
                                <pre className="whitespace-pre-wrap font-sans break-words">
                                  {expandedBody}
                                </pre>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
