'use client'

import { motion } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import {
  Loader2,
  Calendar,
  Users,
  MapPin,
  Video,
  Sparkles,
  MessageSquare,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface Attendee {
  email: string
  name?: string
  status?: string
}

interface Brief {
  id: string
  attendee_email: string | null
  attendee_name: string | null
  interaction_summary: string | null
  last_contact_date: string | null
  email_count: number
  talking_points: string[]
  related_documents: string[]
  generated_at: string
}

interface MeetingEvent {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  attendees: Attendee[]
  location: string | null
  meeting_link: string | null
  briefs: Brief[] | null
}

interface GeneratedBriefResponse {
  briefs: Brief[]
  open_items: string[]
  talking_points: string[]
  related_docs: string[]
  last_interaction: { date: string; summary: string } | null
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

function groupByDay(events: MeetingEvent[]): Record<string, MeetingEvent[]> {
  const groups: Record<string, MeetingEvent[]> = {}
  for (const event of events) {
    const dayKey = new Date(event.start_time).toDateString()
    if (!groups[dayKey]) groups[dayKey] = []
    groups[dayKey].push(event)
  }
  return groups
}

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}

export default function MeetingsPage() {
  const [events, setEvents] = useState<MeetingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [generatedData, setGeneratedData] = useState<Record<string, GeneratedBriefResponse>>({})
  const [error, setError] = useState<string | null>(null)

  const fetchMeetings = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/meetings')
      if (res.ok) {
        const data = await res.json()
        setEvents(data)
      } else {
        const err = await res.json()
        setError(err.error || 'Failed to load meetings')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMeetings() }, [fetchMeetings])

  const generateBrief = async (eventId: string) => {
    setGeneratingFor(eventId)
    setError(null)
    try {
      const res = await fetch('/api/meetings/generate-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Failed to generate brief')
        return
      }

      const data: GeneratedBriefResponse = await res.json()

      // Update local state with the new briefs
      setEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, briefs: data.briefs } : e
      ))
      setGeneratedData(prev => ({ ...prev, [eventId]: data }))
      setExpandedEvent(eventId)
    } catch (err: any) {
      setError(err.message || 'Failed to generate brief')
    } finally {
      setGeneratingFor(null)
    }
  }

  const dayGroups = groupByDay(events)
  const meetingCount = events.length

  return (
    <div>
      <TopBar
        title="Meeting Prep"
        subtitle={`${meetingCount} meetings in the next 7 days`}
        onSyncComplete={fetchMeetings}
      />

      <div className="p-4 sm:p-6 lg:p-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
            <p className="text-sm text-text-tertiary mt-3">Loading meetings...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
            <p className="text-text-secondary font-medium">No upcoming meetings</p>
            <p className="text-sm text-text-tertiary mt-1">
              Click &quot;Sync now&quot; to pull your Google Calendar events
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(dayGroups).map(([dayKey, dayEvents]) => (
              <div key={dayKey}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                    {formatDateLabel(dayEvents[0].start_time)}
                  </h2>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-text-tertiary">
                    {dayEvents.length} {dayEvents.length === 1 ? 'meeting' : 'meetings'}
                  </span>
                </div>

                {/* Event cards */}
                <motion.div
                  initial="initial"
                  animate="animate"
                  variants={{ animate: { transition: { staggerChildren: 0.05 } } }}
                  className="space-y-3"
                >
                  {dayEvents.map((event) => {
                    const isExpanded = expandedEvent === event.id
                    const hasBriefs = event.briefs && event.briefs.length > 0
                    const isGenerating = generatingFor === event.id
                    const extraData = generatedData[event.id]

                    return (
                      <motion.div
                        key={event.id}
                        variants={{
                          initial: { opacity: 0, y: 8 },
                          animate: { opacity: 1, y: 0 },
                        }}
                        className="bg-white rounded-xl border border-border overflow-hidden"
                      >
                        {/* Event header */}
                        <div className="p-4 sm:p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-primary">
                                  {formatTime(event.start_time)}
                                </span>
                                <span className="text-xs text-text-tertiary">-</span>
                                <span className="text-sm text-text-tertiary">
                                  {formatTime(event.end_time)}
                                </span>
                              </div>
                              <h3 className="text-base font-medium text-text-primary truncate">
                                {event.title}
                              </h3>
                              <div className="flex items-center gap-4 mt-2">
                                {event.attendees.length > 0 && (
                                  <span className="flex items-center gap-1 text-xs text-text-tertiary">
                                    <Users className="w-3.5 h-3.5" />
                                    {event.attendees.length} attendees
                                  </span>
                                )}
                                {event.location && (
                                  <span className="flex items-center gap-1 text-xs text-text-tertiary">
                                    <MapPin className="w-3.5 h-3.5" />
                                    <span className="truncate max-w-[150px]">{event.location}</span>
                                  </span>
                                )}
                                {event.meeting_link && (
                                  <a
                                    href={event.meeting_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                                  >
                                    <Video className="w-3.5 h-3.5" />
                                    Join meeting
                                  </a>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {hasBriefs ? (
                                <button
                                  onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary-light rounded-lg hover:bg-primary/15 transition-all duration-200"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  View Prep
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              ) : (
                                <button
                                  onClick={() => generateBrief(event.id)}
                                  disabled={isGenerating}
                                  className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
                                    isGenerating
                                      ? 'bg-surface-secondary text-text-tertiary cursor-not-allowed'
                                      : 'bg-primary text-white hover:bg-primary/90'
                                  )}
                                >
                                  {isGenerating ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      Generating...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-3.5 h-3.5" />
                                      Generate Prep
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded brief content */}
                        {isExpanded && hasBriefs && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-border"
                          >
                            <div className="p-4 sm:p-5 space-y-5">
                              {/* Attendee summaries */}
                              <div>
                                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5" />
                                  Attendees
                                </h4>
                                <div className="space-y-2">
                                  {event.briefs!.map((brief) => (
                                    <div
                                      key={brief.id}
                                      className="flex items-start gap-3 p-3 bg-surface-secondary rounded-lg"
                                    >
                                      <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center shrink-0">
                                        <span className="text-xs font-semibold text-primary">
                                          {(brief.attendee_name || brief.attendee_email || '?')[0].toUpperCase()}
                                        </span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-text-primary">
                                          {brief.attendee_name || brief.attendee_email || 'Unknown'}
                                        </p>
                                        {brief.attendee_email && brief.attendee_name && (
                                          <p className="text-xs text-text-tertiary">{brief.attendee_email}</p>
                                        )}
                                        {brief.interaction_summary && (
                                          <p className="text-xs text-text-secondary mt-1">
                                            {brief.interaction_summary}
                                          </p>
                                        )}
                                        <div className="flex items-center gap-3 mt-1.5">
                                          {brief.last_contact_date && (
                                            <span className="flex items-center gap-1 text-xs text-text-tertiary">
                                              <Clock className="w-3 h-3" />
                                              Last contact: {relativeDate(brief.last_contact_date)}
                                            </span>
                                          )}
                                          {brief.email_count > 0 && (
                                            <span className="text-xs text-text-tertiary">
                                              {brief.email_count} emails
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Open items */}
                              {extraData?.open_items && extraData.open_items.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Open Items
                                  </h4>
                                  <ul className="space-y-1.5">
                                    {extraData.open_items.map((item, i) => (
                                      <li
                                        key={i}
                                        className="flex items-start gap-2 text-sm text-text-secondary"
                                      >
                                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 shrink-0" />
                                        {item}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Talking points */}
                              {event.briefs![0]?.talking_points?.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    Suggested Talking Points
                                  </h4>
                                  <ul className="space-y-1.5">
                                    {event.briefs![0].talking_points.map((point, i) => (
                                      <li
                                        key={i}
                                        className="flex items-start gap-2 text-sm text-text-secondary"
                                      >
                                        <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 shrink-0" />
                                        {point}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Related documents */}
                              {event.briefs![0]?.related_documents?.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5" />
                                    Related Documents
                                  </h4>
                                  <ul className="space-y-1.5">
                                    {event.briefs![0].related_documents.map((doc, i) => (
                                      <li
                                        key={i}
                                        className="text-sm text-text-secondary flex items-center gap-2"
                                      >
                                        <FileText className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                                        {doc}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Regenerate button */}
                              <div className="pt-2 border-t border-border">
                                <button
                                  onClick={() => generateBrief(event.id)}
                                  disabled={isGenerating}
                                  className="text-xs text-text-tertiary hover:text-primary transition-colors duration-200 flex items-center gap-1"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  Regenerate brief
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    )
                  })}
                </motion.div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
