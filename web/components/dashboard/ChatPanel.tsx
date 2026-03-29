'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, X, Send, Loader2, Sparkles,
  CheckCircle2, Mail, Search, Calendar, Forward, AlertTriangle,
  ExternalLink, XCircle, Mic,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionResult {
  type: string
  status: string
  detail?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: ActionResult[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip [ACTION:TYPE]{...}[/ACTION] blocks from display text */
function stripActionBlocks(text: string): string {
  let cleaned = text.replace(/\[ACTION:\w+\][\s\S]*?\[\/ACTION\]/g, '')
  // Strip DSML tags and everything after them (DeepSeek function call markup)
  const dsmlIdx = cleaned.indexOf('<\uFF5CDSML')
  if (dsmlIdx !== -1) cleaned = cleaned.slice(0, dsmlIdx)
  const dsmlIdx2 = cleaned.indexOf('<|DSML')
  if (dsmlIdx2 !== -1) cleaned = cleaned.slice(0, dsmlIdx2)
  return cleaned.trim()
}

/** Render simple markdown (bold, italic, numbered lists) to JSX */
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        // Process inline formatting: **bold** and *italic*
        const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
        const rendered = parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j}>{part.slice(2, -2)}</strong>
          }
          if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={j}>{part.slice(1, -1)}</em>
          }
          return part
        })
        return (
          <span key={i}>
            {i > 0 && <br />}
            {rendered}
          </span>
        )
      })}
    </>
  )
}

/** Parse SSE lines from a raw chunk. Handles partial lines across chunks. */
function parseSSELines(
  buffer: string,
  chunk: string,
): { events: string[]; remaining: string } {
  const raw = buffer + chunk
  const parts = raw.split('\n')
  // Last element may be an incomplete line
  const remaining = parts.pop() ?? ''
  const events: string[] = []

  for (const line of parts) {
    const trimmed = line.trim()
    if (trimmed.startsWith('data: ')) {
      events.push(trimmed.slice(6))
    }
  }
  return { events, remaining }
}

// ---------------------------------------------------------------------------
// ActionCard
// ---------------------------------------------------------------------------

function ActionCard({ action }: { action: ActionResult }) {
  const isError = action.status === 'error' || action.status === 'not_found'
  const needsConfirmation = action.status === 'needs_confirmation'

  // Parse detail fields for richer display
  const detail = action.detail || ''

  const cardVariants = {
    hidden: { opacity: 0, y: 8, scale: 0.96 },
    visible: { opacity: 1, y: 0, scale: 1 },
  }

  // Determine card style based on status
  const cardBg = isError
    ? 'bg-red-50 border-red-200'
    : needsConfirmation
      ? 'bg-amber-50 border-amber-200'
      : 'bg-emerald-50 border-emerald-200'

  const renderContent = () => {
    switch (action.type) {
      case 'CREATE_TASK': {
        // detail is the task title. Try to extract priority/due from context
        return (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-emerald-800">Task Created</span>
            </div>
            <p className="text-xs text-emerald-700 leading-snug pl-5">{detail}</p>
          </>
        )
      }

      case 'COMPLETE_TASK': {
        if (isError) {
          return (
            <>
              <div className="flex items-center gap-1.5 mb-1">
                <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="text-xs font-semibold text-red-700">Task Not Found</span>
              </div>
              <p className="text-xs text-red-600 leading-snug pl-5">&ldquo;{detail}&rdquo;</p>
            </>
          )
        }
        return (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-emerald-800">Task Completed</span>
            </div>
            <p className="text-xs text-emerald-700 leading-snug pl-5">&ldquo;{detail}&rdquo;</p>
          </>
        )
      }

      case 'DRAFT_REPLY': {
        // detail format: "To: x, Subject: y"
        const toMatch = detail.match(/To:\s*(.+?),/)
        const subjectMatch = detail.match(/Subject:\s*(.+)/)
        return (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <Mail className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-emerald-800">Email Draft Ready</span>
            </div>
            {toMatch && (
              <p className="text-xs text-emerald-700 leading-snug pl-5">To: {toMatch[1]}</p>
            )}
            {subjectMatch && (
              <p className="text-xs text-emerald-700 leading-snug pl-5">{subjectMatch[1]}</p>
            )}
            <a
              href="/dashboard/inbox"
              className="mt-1.5 ml-5 text-[11px] font-medium text-emerald-700 hover:text-emerald-900 flex items-center gap-1 transition-colors"
            >
              Review in Inbox <ExternalLink className="w-3 h-3" />
            </a>
          </>
        )
      }

      case 'FORWARD_EMAIL': {
        if (isError) {
          return (
            <>
              <div className="flex items-center gap-1.5 mb-1">
                <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="text-xs font-semibold text-red-700">Forward Failed</span>
              </div>
              <p className="text-xs text-red-600 leading-snug pl-5">{detail}</p>
            </>
          )
        }
        if (needsConfirmation) {
          return (
            <>
              <div className="flex items-center gap-1.5 mb-1">
                <Forward className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-xs font-semibold text-amber-800">Forward Ready</span>
              </div>
              <p className="text-xs text-amber-700 leading-snug pl-5">{detail}</p>
              <div className="flex items-center gap-2 mt-1.5 pl-5">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span className="text-[11px] text-amber-600">Needs your confirmation</span>
              </div>
            </>
          )
        }
        return (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-emerald-800">Email Forwarded</span>
            </div>
            <p className="text-xs text-emerald-700 leading-snug pl-5">{detail}</p>
          </>
        )
      }

      case 'SEARCH': {
        // detail format: "Found N results"
        return (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <Search className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-emerald-800">{detail}</span>
            </div>
            <button className="ml-5 text-[11px] font-medium text-emerald-700 hover:text-emerald-900 flex items-center gap-1 transition-colors">
              Open Search <ExternalLink className="w-3 h-3" />
            </button>
          </>
        )
      }

      case 'CREATE_EVENT': {
        if (isError) {
          return (
            <>
              <div className="flex items-center gap-1.5 mb-1">
                <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="text-xs font-semibold text-red-700">Event Creation Failed</span>
              </div>
              <p className="text-xs text-red-600 leading-snug pl-5">{detail}</p>
            </>
          )
        }
        // detail format: "Title (Meet: url)" or just "Title"
        const meetMatch = detail.match(/\(Meet:\s*(.+?)\)/)
        const title = detail.replace(/\s*\(Meet:.*?\)/, '')
        return (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-emerald-800">Event Created</span>
            </div>
            <p className="text-xs text-emerald-700 leading-snug pl-5">&ldquo;{title}&rdquo;</p>
            {meetMatch && (
              <p className="text-xs text-emerald-600 leading-snug pl-5 flex items-center gap-1 mt-0.5">
                <ExternalLink className="w-3 h-3" /> Meet link created
              </p>
            )}
          </>
        )
      }

      default: {
        return (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span className="text-xs font-semibold text-gray-700">
                {action.type.replace(/_/g, ' ')}
              </span>
            </div>
            {detail && (
              <p className="text-xs text-gray-600 leading-snug pl-5">{detail}</p>
            )}
          </>
        )
      }
    }
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={cn(
        'border rounded-xl px-3 py-2 mt-1.5 max-w-[85%]',
        cardBg,
      )}
    >
      {renderContent()}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// ChatPanel
// ---------------------------------------------------------------------------

export function ChatPanel() {
  const { t, locale } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [assistantName, setAssistantName] = useState('Chief')
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const recognitionRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Check for speech recognition support
  const hasSpeechRecognition = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)

  // Fetch assistant name
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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Listen for global open-chat event (from TopBar / bottom tab)
  useEffect(() => {
    const handler = () => setIsOpen(true)
    window.addEventListener('chief-open-chat', handler)
    return () => window.removeEventListener('chief-open-chat', handler)
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      setInterimText('')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = locale === 'zh' ? 'zh-CN' : locale === 'ms' ? 'ms-MY' : 'en-US'

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }
      if (final) {
        setInput((prev) => prev + final)
        setInterimText('')
      } else {
        setInterimText(interim)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimText('')
      recognitionRef.current = null
    }

    recognition.onerror = () => {
      setIsListening(false)
      setInterimText('')
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening, locale])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }

    const assistantId = `assistant-${Date.now()}`
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setIsStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!res.ok) {
        setMessages(prev =>
          prev.map(m => m.id === assistantId
            ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
            : m
          )
        )
        return
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let sseBuffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const { events, remaining } = parseSSELines(sseBuffer, chunk)
          sseBuffer = remaining

          for (const event of events) {
            // End of stream
            if (event === '[DONE]') continue

            try {
              const data = JSON.parse(event)

              if (data.error) {
                setMessages(prev =>
                  prev.map(m => m.id === assistantId
                    ? { ...m, content: m.content || `Error: ${data.error}` }
                    : m
                  )
                )
                continue
              }

              // Text content chunk
              if (data.content) {
                setMessages(prev =>
                  prev.map(m => m.id === assistantId
                    ? { ...m, content: m.content + data.content }
                    : m
                  )
                )
              }

              // Action results from the server
              if (data.actions && Array.isArray(data.actions)) {
                setMessages(prev =>
                  prev.map(m => m.id === assistantId
                    ? { ...m, actions: data.actions }
                    : m
                  )
                )
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch {
      setMessages(prev =>
        prev.map(m => m.id === assistantId
          ? { ...m, content: 'Connection error. Please try again.' }
          : m
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-24 lg:bottom-8 right-6 lg:right-8 z-50 w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
            aria-label="Open chat"
          >
            <MessageCircle className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-24 lg:bottom-8 right-4 lg:right-8 z-50 w-[min(400px,calc(100vw-2rem))] h-[min(500px,calc(100vh-8rem))] bg-white rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-white shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-sm text-text-primary">{assistantName}</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-surface-secondary flex items-center justify-center transition-colors duration-150"
                aria-label="Close chat"
              >
                <X className="w-4 h-4 text-text-tertiary" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-12 h-12 bg-primary-light rounded-xl flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-text-primary mb-1">{assistantName}</p>
                  <p className="text-xs text-text-tertiary mb-4">Ask me anything about your tasks, emails, or schedule.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      t('chatSuggestion1'),
                      t('chatSuggestion2'),
                      t('chatSuggestion3'),
                      t('chatSuggestion4'),
                    ].map((suggestion) => (
                      <motion.button
                        key={suggestion}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setInput(suggestion)}
                        className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-full hover:bg-primary/20 transition-colors duration-150"
                      >
                        {suggestion}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => {
                const displayText = msg.role === 'assistant'
                  ? stripActionBlocks(msg.content)
                  : msg.content
                const actions = msg.actions

                return (
                  <div key={msg.id}>
                    {/* Message bubble */}
                    <div
                      className={cn(
                        'flex',
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed',
                          msg.role === 'user'
                            ? 'bg-primary text-white rounded-br-md'
                            : 'bg-surface-secondary text-text-primary rounded-bl-md'
                        )}
                      >
                        {displayText ? (
                          msg.role === 'assistant'
                            ? <SimpleMarkdown text={displayText} />
                            : displayText
                        ) : (
                          msg.role === 'assistant' && !actions?.length ? (
                            <div className="flex items-center gap-1.5">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span className="text-xs opacity-70">Thinking...</span>
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>

                    {/* Action cards rendered below the bubble */}
                    {actions && actions.length > 0 && (
                      <div className="flex flex-col items-start mt-1 space-y-1.5">
                        <AnimatePresence>
                          {actions.map((action, idx) => (
                            <ActionCard key={`${msg.id}-action-${idx}`} action={action} />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border bg-white shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('typeMessage')}
                    disabled={isStreaming}
                    className="w-full px-3.5 py-2.5 bg-surface-secondary rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 disabled:opacity-50"
                  />
                  {interimText && (
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-text-tertiary/50 pointer-events-none">
                      {input}{interimText}
                    </span>
                  )}
                </div>
                {hasSpeechRecognition && (
                  <button
                    onClick={toggleListening}
                    disabled={isStreaming}
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0',
                      isListening
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-surface-secondary text-text-tertiary hover:bg-surface-secondary/80'
                    )}
                    aria-label={isListening ? 'Stop recording' : 'Start voice input'}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary-hover transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  aria-label={t('send')}
                >
                  {isStreaming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
