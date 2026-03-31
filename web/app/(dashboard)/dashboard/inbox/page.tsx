'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import { useI18n } from '@/lib/i18n/context'
import {
  Mail,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle,
  Sparkles,
  Copy,
  Check,
  Send,
  Search,
  X,
  Paperclip,
  ExternalLink,
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
  labels?: string[]
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

interface ThreadMessage {
  id: string
  from_name: string | null
  from_address: string
  subject: string
  snippet: string
  received_at: string
  body_text?: string
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

type ChannelFilter = 'needs_reply' | 'all' | 'whatsapp'

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Check if email likely has attachments */
function hasAttachmentSignal(item: EmailItem): boolean {
  if (item.labels?.includes('ATTACHMENT')) return true
  const text = `${item.snippet || ''} ${item.subject || ''}`.toLowerCase()
  return /\b(attached|attachment|attachments|attaching|附件|see attached|please find attached)\b/.test(text)
}

/** Extract meeting links from text */
const MEETING_LINK_RE =
  /https?:\/\/(?:teams\.live\.com\/meet\/|teams\.microsoft\.com\/l\/meetup-join\/|[^\s]*zoom\.us\/j\/|meet\.google\.com\/)[^\s)<>"]*/gi

function extractMeetingLinks(text: string): string[] {
  return Array.from(text.matchAll(MEETING_LINK_RE)).map((m) => m[0])
}

function getMeetingPlatform(url: string): string {
  if (url.includes('zoom.us')) return 'Zoom'
  if (url.includes('teams.live.com') || url.includes('teams.microsoft.com')) return 'Teams'
  if (url.includes('meet.google.com')) return 'Google Meet'
  return 'Meeting'
}

/** Make URLs in plain text clickable, returns HTML string */
function linkifyText(text: string): string {
  const urlRe = /(https?:\/\/[^\s)<>"]+)/g
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replace(urlRe, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary/80 break-all">$1</a>')
}

/** Render email body: if it contains HTML tags, render as HTML; otherwise linkify plain text */
function renderEmailBody(body: string): { __html: string } {
  const hasHtmlTags = /<\/?(?:div|p|br|table|tr|td|span|a|b|i|strong|em|ul|ol|li|h[1-6]|img|hr)\b/i.test(body)
  if (hasHtmlTags) {
    // Basic sanitization: strip script/style tags and event handlers
    const sanitized = body
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+on\w+\s*=\s*\S+/gi, '')
    return { __html: sanitized }
  }
  // Plain text: linkify URLs and preserve whitespace with <pre>
  return { __html: `<pre class="whitespace-pre-wrap font-sans break-words">${linkifyText(body)}</pre>` }
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

  // Feature 1: Thread view state
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadCollapsed, setThreadCollapsed] = useState(false)

  // Feature 2: Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearch, setActiveSearch] = useState('')

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
  const unified: UnifiedMessage[] = useMemo(() => {
    const result: UnifiedMessage[] = []

    for (const email of emails) {
      result.push({
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
      result.push({
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
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return result
  }, [emails, waMessages])

  // Apply filter + search
  const filtered = useMemo(() => {
    let result = unified

    // Channel / needs_reply filter
    if (filter === 'needs_reply') {
      result = result.filter(
        (m) => m.channel === 'email' && (m.raw as EmailItem).is_reply_needed
      )
    } else if (filter === 'whatsapp') {
      result = result.filter((m) => m.channel === filter)
    }
    // 'all' shows everything

    // Client-side search
    if (activeSearch) {
      const q = activeSearch.toLowerCase()
      result = result.filter(
        (m) =>
          m.sender.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.preview.toLowerCase().includes(q)
      )
    }

    return result
  }, [unified, filter, activeSearch])

  const handleExpand = async (item: UnifiedMessage) => {
    if (expandedId === item.id) {
      setExpandedId(null)
      setExpandedBody(null)
      setThreadMessages([])
      return
    }

    setExpandedId(item.id)
    setExpandedBody(null)
    setDraftVisible(false)
    setDraftText('')
    setThreadMessages([])
    setThreadCollapsed(false)

    if (item.channel === 'email') {
      const email = item.raw as EmailItem
      setBodyLoading(true)

      // Fetch email body and thread in parallel
      const [bodyResult, threadResult] = await Promise.allSettled([
        fetch(`/api/emails/${email.id}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/emails/${email.id}/thread`).then((r) => (r.ok ? r.json() : [])),
      ])

      if (bodyResult.status === 'fulfilled' && bodyResult.value) {
        setExpandedBody(bodyResult.value.body || email.snippet || '')
      } else {
        setExpandedBody(email.snippet || '')
      }

      if (threadResult.status === 'fulfilled' && Array.isArray(threadResult.value)) {
        // Sort thread chronologically (oldest first)
        const sorted = [...threadResult.value].sort(
          (a: ThreadMessage, b: ThreadMessage) =>
            new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
        )
        setThreadMessages(sorted)
      }

      setBodyLoading(false)
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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setActiveSearch(searchQuery.trim())
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setActiveSearch('')
  }

  // Feature 5: Smart categorization tabs
  const needsReplyCount = useMemo(
    () => unified.filter((m) => m.channel === 'email' && (m.raw as EmailItem).is_reply_needed).length,
    [unified]
  )

  const filterTabs: { key: ChannelFilter; label: string; icon?: React.ReactNode; count: number }[] = [
    {
      key: 'needs_reply',
      label: t('needsReply'),
      count: needsReplyCount,
    },
    {
      key: 'all',
      label: t('allChannels' as any),
      icon: <Mail className="w-3.5 h-3.5" />,
      count: unified.length,
    },
    {
      key: 'whatsapp',
      label: t('whatsappChannel' as any),
      icon: <MessageCircle className="w-3.5 h-3.5" />,
      count: unified.filter((m) => m.channel === 'whatsapp').length,
    },
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
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2',
                filter === tab.key
                  ? tab.key === 'needs_reply'
                    ? 'bg-red-600 text-white'
                    : 'bg-primary text-white'
                  : 'bg-white border border-border text-text-secondary hover:bg-surface-secondary'
              )}
            >
              {tab.key === 'needs_reply' && (
                <span className="w-2 h-2 rounded-full bg-current opacity-80" />
              )}
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full font-medium',
                    filter === tab.key ? 'bg-white/20 text-white' : 'bg-surface-secondary text-text-tertiary'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Feature 2: Search bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search emails by sender, subject, or content... (Enter to search)"
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-border rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            {(searchQuery || activeSearch) && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {activeSearch && (
            <p className="mt-2 text-sm text-text-secondary">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &ldquo;{activeSearch}&rdquo;
            </p>
          )}
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
            <p className="text-lg font-medium text-text-primary mb-1">
              {activeSearch ? `No results for "${activeSearch}"` : 'All caught up!'}
            </p>
            <p className="text-sm text-text-tertiary max-w-xs">
              {activeSearch
                ? 'Try a different search term.'
                : 'Your assistant will notify you when something needs your attention.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((item) => {
                const isExpanded = expandedId === item.id
                const isEmail = item.channel === 'email'
                const emailRaw = isEmail ? (item.raw as EmailItem) : null
                const showAttachment = emailRaw ? hasAttachmentSignal(emailRaw) : false

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
                          {emailRaw?.is_reply_needed && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">
                              {t('needsReply')}
                            </span>
                          )}
                        </div>
                        {/* Sender email + source account */}
                        {isEmail && emailRaw && (
                          <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
                            <span>{emailRaw.from_address}</span>
                            {emailRaw.source_account_email && (
                              <>
                                <span>&rarr;</span>
                                <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">
                                  {emailRaw.source_account_email}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                        {item.subject && (
                          <p className="text-sm text-text-secondary truncate flex items-center gap-1.5">
                            {fixDoubleUtf8(item.subject)}
                            {/* Feature 3: Attachment indicator */}
                            {showAttachment && (
                              <Paperclip className="w-3.5 h-3.5 text-text-tertiary shrink-0 inline-block" />
                            )}
                          </p>
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
                                {/* Feature 1: Thread view */}
                                {isEmail && threadMessages.length > 1 && (
                                  <div className="mb-4">
                                    <button
                                      onClick={() => setThreadCollapsed(!threadCollapsed)}
                                      className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 mb-2 transition-colors"
                                    >
                                      {threadCollapsed ? (
                                        <ChevronRight className="w-3.5 h-3.5" />
                                      ) : (
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      )}
                                      {threadMessages.length} messages in thread
                                    </button>

                                    {!threadCollapsed && (
                                      <div className="space-y-2 border-l-2 border-primary/20 pl-3">
                                        {threadMessages.map((tm) => {
                                          const isCurrent = emailRaw && tm.id === emailRaw.id
                                          return (
                                            <div
                                              key={tm.id}
                                              className={cn(
                                                'rounded-lg p-3 text-sm',
                                                isCurrent
                                                  ? 'bg-primary/5 border border-primary/20'
                                                  : 'bg-white border border-border'
                                              )}
                                            >
                                              <div className="flex items-center justify-between mb-1">
                                                <span className="font-medium text-text-primary text-xs">
                                                  {tm.from_name || tm.from_address}
                                                  {isCurrent && (
                                                    <span className="ml-2 text-[10px] font-semibold text-primary">(current)</span>
                                                  )}
                                                </span>
                                                <span className="text-[11px] text-text-tertiary">
                                                  {formatDate(tm.received_at)}
                                                </span>
                                              </div>
                                              <p className="text-xs text-text-secondary line-clamp-2">
                                                {tm.snippet || tm.body_text?.slice(0, 150) || ''}
                                              </p>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {threadLoading && (
                                  <div className="flex items-center gap-2 mb-3">
                                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                                    <span className="text-xs text-text-tertiary">Loading thread...</span>
                                  </div>
                                )}

                                {/* Email body - Feature 6: HTML rendering with linkified URLs */}
                                <div className="text-sm text-text-secondary leading-relaxed max-h-[400px] overflow-y-auto">
                                  {expandedBody ? (
                                    <div
                                      className="email-body-content [&_a]:text-primary [&_a]:underline [&_a]:hover:text-primary/80"
                                      dangerouslySetInnerHTML={renderEmailBody(expandedBody)}
                                    />
                                  ) : (
                                    <p className="text-text-tertiary italic">No content</p>
                                  )}
                                </div>

                                {/* Feature 4: Meeting link extraction */}
                                {expandedBody && (() => {
                                  const links = extractMeetingLinks(expandedBody)
                                  if (links.length === 0) return null
                                  return (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {links.map((link, i) => (
                                        <a
                                          key={i}
                                          href={link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-medium hover:bg-blue-100 transition-colors"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                          Join {getMeetingPlatform(link)}
                                        </a>
                                      ))}
                                    </div>
                                  )
                                })()}

                                {/* AI Draft button -- email only */}
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
