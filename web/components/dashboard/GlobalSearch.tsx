'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Mail, CheckSquare, RotateCw, CalendarDays, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/lib/i18n/context'

interface SearchResults {
  emails: any[]
  tasks: any[]
  follow_ups: any[]
  events: any[]
  total: number
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-500',
}

const followUpTypeColors: Record<string, string> = {
  you_promised: 'bg-blue-100 text-blue-700',
  waiting_on_them: 'bg-purple-100 text-purple-700',
}

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  // Build a flat list of all result items for keyboard navigation
  const flatItems = results
    ? [
        ...results.emails.map((e) => ({ type: 'email' as const, data: e })),
        ...results.tasks.map((t) => ({ type: 'task' as const, data: t })),
        ...results.follow_ups.map((f) => ({ type: 'follow_up' as const, data: f })),
        ...results.events.map((ev) => ({ type: 'event' as const, data: ev })),
      ]
    : []

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults(null)
      setActiveIndex(-1)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        })
        if (res.ok) {
          const data = await res.json()
          setResults(data)
          setActiveIndex(-1)
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error('Search failed:', err)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(null)
      setActiveIndex(-1)
      // Small delay to let the animation start
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const navigateTo = useCallback(
    (item: (typeof flatItems)[number]) => {
      onClose()
      switch (item.type) {
        case 'email':
          router.push('/dashboard/replies')
          break
        case 'task':
          router.push('/dashboard/tasks')
          break
        case 'follow_up':
          router.push('/dashboard/follow-ups')
          break
        case 'event':
          router.push('/dashboard/calendar')
          break
      }
    },
    [onClose, router]
  )

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1))
      } else if (e.key === 'Enter' && activeIndex >= 0 && flatItems[activeIndex]) {
        e.preventDefault()
        navigateTo(flatItems[activeIndex])
      }
    },
    [flatItems, activeIndex, navigateTo, onClose]
  )

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${activeIndex}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  // Global Cmd+K / Ctrl+K is handled by parent; this just renders the modal

  const renderSectionHeader = (icon: React.ReactNode, label: string, count: number) => {
    if (count === 0) return null
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
        {icon}
        <span>{label}</span>
        <span className="text-text-tertiary/60">{count}</span>
      </div>
    )
  }

  let itemIndex = -1

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-border overflow-hidden"
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-5 h-5 text-text-tertiary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="flex-1 text-base text-text-primary placeholder:text-text-tertiary outline-none bg-transparent"
                autoComplete="off"
                spellCheck={false}
              />
              {loading && <Loader2 className="w-4 h-4 text-text-tertiary animate-spin shrink-0" />}
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-surface-secondary transition-colors shrink-0"
                aria-label="Close search"
              >
                <X className="w-4 h-4 text-text-tertiary" />
              </button>
            </div>

            {/* Results area */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
              {/* No query yet */}
              {!query && (
                <div className="px-4 py-8 text-center text-sm text-text-tertiary">
                  {t('searchPlaceholder')}
                </div>
              )}

              {/* Query entered but still loading first results */}
              {query && query.length >= 2 && loading && !results && (
                <div className="px-4 py-8 flex items-center justify-center gap-2 text-sm text-text-tertiary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('loading')}</span>
                </div>
              )}

              {/* Too short */}
              {query && query.length < 2 && (
                <div className="px-4 py-8 text-center text-sm text-text-tertiary">
                  {t('searchPlaceholder')}
                </div>
              )}

              {/* Results */}
              {results && (
                <>
                  {results.total === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-text-tertiary">
                      {t('noResults', { q: query })}
                    </div>
                  )}

                  {results.total > 0 && (
                    <>
                      {/* Total count */}
                      <div className="px-4 pt-3 pb-1 text-xs text-text-tertiary">
                        {t('searchResults', { n: results.total })}
                      </div>

                      {/* Emails */}
                      {renderSectionHeader(
                        <Mail className="w-3.5 h-3.5" />,
                        t('emails'),
                        results.emails.length
                      )}
                      {results.emails.map((email) => {
                        itemIndex++
                        const idx = itemIndex
                        return (
                          <button
                            key={`email-${email.id}`}
                            data-index={idx}
                            onClick={() => navigateTo({ type: 'email', data: email })}
                            className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors cursor-pointer ${
                              activeIndex === idx
                                ? 'bg-primary-light'
                                : 'hover:bg-surface-secondary'
                            }`}
                          >
                            <Mail className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-text-primary truncate">
                                  {email.from_name || email.from_address}
                                </span>
                                <span className="text-xs text-text-tertiary shrink-0">
                                  {timeAgo(email.received_at)}
                                </span>
                              </div>
                              <p className="text-sm text-text-secondary truncate">{email.subject}</p>
                              {email.snippet && (
                                <p className="text-xs text-text-tertiary truncate mt-0.5">
                                  {email.snippet}
                                </p>
                              )}
                            </div>
                          </button>
                        )
                      })}

                      {/* Tasks */}
                      {renderSectionHeader(
                        <CheckSquare className="w-3.5 h-3.5" />,
                        t('tasks'),
                        results.tasks.length
                      )}
                      {results.tasks.map((task) => {
                        itemIndex++
                        const idx = itemIndex
                        return (
                          <button
                            key={`task-${task.id}`}
                            data-index={idx}
                            onClick={() => navigateTo({ type: 'task', data: task })}
                            className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors cursor-pointer ${
                              activeIndex === idx
                                ? 'bg-primary-light'
                                : 'hover:bg-surface-secondary'
                            }`}
                          >
                            <CheckSquare className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-text-primary truncate">
                                  {task.title}
                                </span>
                                {task.priority && (
                                  <span
                                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                                      priorityColors[task.priority] || 'bg-gray-100 text-gray-500'
                                    }`}
                                  >
                                    {task.priority}
                                  </span>
                                )}
                              </div>
                              {task.status && (
                                <p className="text-xs text-text-tertiary mt-0.5">{task.status}</p>
                              )}
                            </div>
                          </button>
                        )
                      })}

                      {/* Follow-ups */}
                      {renderSectionHeader(
                        <RotateCw className="w-3.5 h-3.5" />,
                        t('followUps'),
                        results.follow_ups.length
                      )}
                      {results.follow_ups.map((fu) => {
                        itemIndex++
                        const idx = itemIndex
                        return (
                          <button
                            key={`fu-${fu.id}`}
                            data-index={idx}
                            onClick={() => navigateTo({ type: 'follow_up', data: fu })}
                            className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors cursor-pointer ${
                              activeIndex === idx
                                ? 'bg-primary-light'
                                : 'hover:bg-surface-secondary'
                            }`}
                          >
                            <RotateCw className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-text-primary truncate">
                                  {fu.contact_name || fu.contact_email}
                                </span>
                                {fu.type && (
                                  <span
                                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                                      followUpTypeColors[fu.type] || 'bg-gray-100 text-gray-500'
                                    }`}
                                  >
                                    {fu.type === 'you_promised' ? t('youPromised') : t('waitingOnThem')}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-text-secondary truncate">{fu.subject}</p>
                              {fu.due_date && (
                                <p className="text-xs text-text-tertiary mt-0.5">
                                  {t('due')} {new Date(fu.due_date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </button>
                        )
                      })}

                      {/* Events */}
                      {renderSectionHeader(
                        <CalendarDays className="w-3.5 h-3.5" />,
                        t('calendar'),
                        results.events.length
                      )}
                      {results.events.map((ev) => {
                        itemIndex++
                        const idx = itemIndex
                        return (
                          <button
                            key={`ev-${ev.id}`}
                            data-index={idx}
                            onClick={() => navigateTo({ type: 'event', data: ev })}
                            className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors cursor-pointer ${
                              activeIndex === idx
                                ? 'bg-primary-light'
                                : 'hover:bg-surface-secondary'
                            }`}
                          >
                            <CalendarDays className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-text-primary truncate">
                                  {ev.title}
                                </span>
                                <span className="text-xs text-text-tertiary shrink-0">
                                  {formatDateTime(ev.start_time)}
                                </span>
                              </div>
                              {ev.location && (
                                <p className="text-xs text-text-tertiary truncate mt-0.5">
                                  {ev.location}
                                </p>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer with keyboard hints */}
            <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-t border-border text-[11px] text-text-tertiary">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-surface-secondary rounded text-[10px] font-mono">
                  &uarr;&darr;
                </kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-surface-secondary rounded text-[10px] font-mono">
                  &crarr;
                </kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-surface-secondary rounded text-[10px] font-mono">
                  esc
                </kbd>
                close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
