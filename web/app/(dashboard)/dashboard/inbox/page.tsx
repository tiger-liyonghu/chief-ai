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
  CheckCircle,
  Sparkles,
  Copy,
  Check,
  Send,
} from 'lucide-react'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { cn, fixDoubleUtf8 } from '@/lib/utils'

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
  source_account_email?: string
  gmail_message_id?: string
  thread_id?: string
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
  const [draftText, setDraftText] = useState<string>('')
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftVisible, setDraftVisible] = useState(false)
  const [copied, setCopied] = useState(false)

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
    const isOutbound = msg.direction === 'outbound'
    unified.push({
      id: `wa-${msg.id}`,
      channel: 'whatsapp',
      sender: isOutbound
        ? `To: ${msg.to_number}`
        : (msg.from_name || msg.from_number),
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
    setDraftVisible(false)
    setDraftText('')

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

  const handleDraft = async (item: UnifiedMessage) => {
    if (item.channel !== 'email') return
    const email = item.raw as EmailItem
    setDraftText('')
    setDraftLoading(true)
    setDraftVisible(true)
    setCopied(false)

    try {
      const res = await fetch('/api/ai/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread: expandedBody || email.snippet || '',
          from: email.from_address,
          subject: email.subject,
          tone: 'friendly',
        }),
      })

      if (!res.ok) throw new Error()

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error()

      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setDraftText(accumulated)
      }
    } catch {
      setDraftText('Failed to generate draft. Please try again.')
    } finally {
      setDraftLoading(false)
    }
  }

  const handleCopyDraft = () => {
    navigator.clipboard.writeText(draftText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
        <div className="flex items-center gap-2 mb-6 flex-wrap">
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
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={2} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-lg font-medium text-text-primary mb-1">All caught up!</p>
            <p className="text-sm text-text-tertiary max-w-xs">Your assistant will notify you when something needs your attention.</p>
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
                        {/* Sender email + source account */}
                        {item.channel === 'email' && (
                          <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
                            <span>{(item.raw as EmailItem).from_address}</span>
                            {(item.raw as EmailItem).source_account_email && (
                              <>
                                <span>→</span>
                                <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">
                                  {(item.raw as EmailItem).source_account_email}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                        {item.subject && (
                          <p className="text-sm text-text-secondary truncate">{fixDoubleUtf8(item.subject)}</p>
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
                              <>
                                <div className="text-sm text-text-secondary leading-relaxed max-h-[400px] overflow-y-auto">
                                  <pre className="whitespace-pre-wrap font-sans break-words">
                                    {expandedBody}
                                  </pre>
                                </div>

                                {/* AI Draft button — email only */}
                                {item.channel === 'email' && (
                                  <div className="mt-4 pt-3 border-t border-border">
                                    {!draftVisible ? (
                                      <button
                                        onClick={() => handleDraft(item)}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                                      >
                                        <Sparkles className="w-4 h-4" />
                                        {t('aiDraft')}
                                      </button>
                                    ) : (
                                      <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2 text-sm font-medium text-primary">
                                            <Sparkles className="w-4 h-4" />
                                            {t('aiDraft')}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={handleCopyDraft}
                                              disabled={draftLoading}
                                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-white rounded-lg transition-colors border border-border"
                                            >
                                              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                              {copied ? 'Copied' : 'Copy'}
                                            </button>
                                            <button
                                              onClick={() => handleDraft(item)}
                                              disabled={draftLoading}
                                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors border border-primary/20"
                                            >
                                              <Sparkles className="w-3.5 h-3.5" />
                                              Regenerate
                                            </button>
                                          </div>
                                        </div>
                                        <div className="bg-white border border-border rounded-xl p-4 text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                                          {draftText}
                                          {draftLoading && <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom rounded-sm" />}
                                        </div>
                                        {/* Send button */}
                                        {draftText && !draftLoading && (
                                          <div className="mt-3 flex items-center gap-2">
                                            <button
                                              onClick={async () => {
                                                const email = item.raw as EmailItem
                                                try {
                                                  const res = await fetch('/api/send-reply', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                      to: email.from_address,
                                                      subject: `Re: ${email.subject || ''}`,
                                                      body: draftText,
                                                      in_reply_to: email.gmail_message_id,
                                                      thread_id: email.thread_id,
                                                    }),
                                                  })
                                                  if (res.ok) {
                                                    setDraftText('')
                                                    setDraftVisible(false)
                                                    alert('Sent!')
                                                    fetchData()
                                                  } else {
                                                    alert('Failed to send. Please try again.')
                                                  }
                                                } catch {
                                                  alert('Failed to send.')
                                                }
                                              }}
                                              className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                                            >
                                              <Send className="w-4 h-4" />
                                              Send Reply
                                            </button>
                                            <span className="text-xs text-text-tertiary">
                                              to {(item.raw as EmailItem).from_address}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
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
