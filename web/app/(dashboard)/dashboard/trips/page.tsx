'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import {
  Plane,
  Hotel,
  MapPin,
  Calendar,
  DollarSign,
  Users,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  Mail,
  AlertCircle,
  Globe,
  FileText,
  RefreshCw,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'

// Country code to flag emoji
function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return ''
  const codePoints = code
    .toUpperCase()
    .split('')
    .map(c => 0x1f1e6 + c.charCodeAt(0) - 65)
  return String.fromCodePoint(...codePoints)
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${monthNames[s.getMonth()]} ${s.getDate()}-${e.getDate()}, ${s.getFullYear()}`
  }
  if (s.getFullYear() === e.getFullYear()) {
    return `${monthNames[s.getMonth()]} ${s.getDate()} - ${monthNames[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`
  }
  return `${monthNames[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()} - ${monthNames[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'active':
      return { label: 'Active', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' }
    case 'completed':
      return { label: 'Completed', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
    default:
      return { label: 'Upcoming', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' }
  }
}

function getDaysBetween(start: string, end: string): string[] {
  const days: string[] = []
  const d = new Date(start)
  const e = new Date(end)
  while (d <= e) {
    days.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return days
}

interface Trip {
  id: string
  title: string
  destination_city: string | null
  destination_country: string | null
  start_date: string
  end_date: string
  status: string
  flight_info: any[]
  hotel_info: any[]
  expenses: any[]
  total_expenses: number
  expense_currency: string
  meetings_count: number
  meetings: any[]
  notes: string | null
}

export default function TripsPage() {
  const { t } = useI18n()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [detectResult, setDetectResult] = useState<string | null>(null)
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null)
  const [urgentTasks, setUrgentTasks] = useState<any[]>([])
  const [landingBriefings, setLandingBriefings] = useState<Record<string, any>>({})
  const [briefingLoading, setBriefingLoading] = useState<Record<string, boolean>>({})
  const [reportLoading, setReportLoading] = useState<Record<string, boolean>>({})
  const [tripReports, setTripReports] = useState<Record<string, any>>({})
  const [preFlightData, setPreFlightData] = useState<Record<string, { emails: any[]; tasks: any[] }>>({})
  const [preFlightLoading, setPreFlightLoading] = useState<Record<string, boolean>>({})
  const briefingFetched = useRef<Set<string>>(new Set())
  const preFlightFetched = useRef<Set<string>>(new Set())

  const fetchLandingBriefing = useCallback(async (tripId: string, force = false) => {
    if (!force && briefingFetched.current.has(tripId)) return
    briefingFetched.current.add(tripId)
    setBriefingLoading(prev => ({ ...prev, [tripId]: true }))
    try {
      const res = await fetch('/api/trips/landing-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId }),
      })
      if (res.ok) {
        const data = await res.json()
        setLandingBriefings(prev => ({ ...prev, [tripId]: data }))
      }
    } catch { /* ignore */ }
    finally {
      setBriefingLoading(prev => ({ ...prev, [tripId]: false }))
    }
  }, [])

  const fetchPreFlight = useCallback(async (tripId: string) => {
    if (preFlightFetched.current.has(tripId)) return
    preFlightFetched.current.add(tripId)
    setPreFlightLoading(prev => ({ ...prev, [tripId]: true }))
    try {
      const res = await fetch(`/api/trips/pre-flight?trip_id=${tripId}`)
      if (res.ok) {
        const data = await res.json()
        setPreFlightData(prev => ({ ...prev, [tripId]: { emails: data.emails, tasks: data.tasks } }))
      }
    } catch { /* ignore */ }
    finally {
      setPreFlightLoading(prev => ({ ...prev, [tripId]: false }))
    }
  }, [])

  const fetchTripReport = useCallback(async (tripId: string) => {
    setReportLoading(prev => ({ ...prev, [tripId]: true }))
    try {
      const res = await fetch('/api/trips/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId }),
      })
      if (res.ok) {
        const data = await res.json()
        setTripReports(prev => ({ ...prev, [tripId]: data }))
      }
    } catch { /* ignore */ }
    finally {
      setReportLoading(prev => ({ ...prev, [tripId]: false }))
    }
  }, [])

  const fetchTrips = useCallback(async () => {
    try {
      const res = await fetch('/api/trips')
      if (res.ok) {
        const data = await res.json()
        setTrips(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      if (res.ok) {
        const data = await res.json()
        setUrgentTasks(data.filter((t: any) => t.status !== 'done' && t.priority <= 2))
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchTrips()
    fetchTasks()
  }, [fetchTrips, fetchTasks])

  // Auto-fetch landing briefings for active trips
  useEffect(() => {
    const activeTrips = trips.filter(t => t.status === 'active')
    for (const trip of activeTrips) {
      fetchLandingBriefing(trip.id)
    }
  }, [trips, fetchLandingBriefing])

  // Auto-fetch pre-flight data for upcoming trips departing within 48 hours
  useEffect(() => {
    const now = new Date()
    const soonTrips = trips.filter(t => {
      if (t.status !== 'upcoming') return false
      const start = new Date(t.start_date)
      const hoursUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60)
      return hoursUntil > 0 && hoursUntil <= 48
    })
    for (const trip of soonTrips) {
      fetchPreFlight(trip.id)
    }
  }, [trips, fetchPreFlight])

  const handleDetect = async () => {
    setDetecting(true)
    setDetectResult(null)
    try {
      const res = await fetch('/api/trips/detect', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setDetectResult(
          data.trips_found > 0
            ? `Found ${data.bookings_detected} booking(s), created ${data.trips_found} trip(s) and ${data.expenses_found} expense(s).`
            : 'No travel bookings found in recent emails.'
        )
        fetchTrips()
      } else {
        const err = await res.json()
        setDetectResult(`Error: ${err.error}`)
      }
    } catch (e: any) {
      setDetectResult(`Error: ${e.message}`)
    } finally {
      setDetecting(false)
    }
  }

  const now = new Date()
  const activeTrips = trips.filter(t => t.status === 'active')
  const upcomingTrips = trips.filter(t => t.status === 'upcoming' || t.status === 'active')
  const pastTrips = trips.filter(t => t.status === 'completed')
  const totalTrips = trips.length

  // Check if a trip is departing within 48 hours
  const isDepartingSoon = (trip: Trip) => {
    if (trip.status !== 'upcoming') return false
    const start = new Date(trip.start_date)
    const hoursUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60)
    return hoursUntil > 0 && hoursUntil <= 48
  }

  // Get tasks that are due before an upcoming trip starts
  const getPreTripTasks = (trip: Trip) => {
    const tripStart = new Date(trip.start_date)
    return urgentTasks.filter(task => {
      if (!task.due_date) return task.priority === 1 // Show urgent tasks with no date
      const due = new Date(task.due_date)
      return due <= tripStart
    })
  }

  return (
    <div>
      <TopBar
        title={t('trips' as any) || 'Trips'}
        subtitle={`${upcomingTrips.length} upcoming, ${totalTrips} total`}
        onSyncComplete={fetchTrips}
      />

      <div className="p-4 sm:p-6 lg:p-8">
        {/* Detect Button */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleDetect}
            disabled={detecting}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
              detecting
                ? 'bg-gray-100 text-text-tertiary cursor-wait'
                : 'bg-primary text-white hover:bg-primary/90'
            )}
          >
            {detecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {detecting ? 'Scanning emails...' : 'Detect Trips'}
          </button>

          {detectResult && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                'text-sm',
                detectResult.startsWith('Error') ? 'text-red-600' : 'text-text-secondary'
              )}
            >
              {detectResult}
            </motion.span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
            <p className="text-sm text-text-tertiary mt-3">Loading trips...</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-16">
            <Plane className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
            <p className="text-text-secondary font-medium">No trips yet</p>
            <p className="text-sm text-text-tertiary mt-1">
              Click "Detect Trips" to scan your emails for travel bookings
            </p>
          </div>
        ) : (
          <>
            {/* Landing Briefing for Active Trips */}
            {activeTrips.map(trip => {
              const briefing = landingBriefings[trip.id]
              const isLoading = briefingLoading[trip.id]

              return (
                <motion.div
                  key={`briefing-${trip.id}`}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-5"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-emerald-900">
                        Landing Briefing — {trip.destination_city || trip.title}
                      </h3>
                      {briefing?.timezone_info && (
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Local time: {briefing.timezone_info.current_local_time} ({briefing.timezone_info.destination_offset})
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => fetchLandingBriefing(trip.id, true)}
                      disabled={isLoading}
                      className="text-emerald-600 hover:text-emerald-800 p-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                      title="Refresh briefing"
                    >
                      <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                    </button>
                  </div>

                  {isLoading && !briefing ? (
                    <div className="flex items-center gap-2 py-3">
                      <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                      <span className="text-sm text-emerald-700">Generating your landing briefing...</span>
                    </div>
                  ) : briefing ? (
                    <div>
                      <p className="text-sm text-emerald-900 leading-relaxed whitespace-pre-line">
                        {briefing.briefing}
                      </p>

                      {/* Quick stats */}
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-emerald-200 flex-wrap">
                        {briefing.next_meeting && (
                          <span className="text-xs text-emerald-700 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            Next: {briefing.next_meeting.title} at{' '}
                            {new Date(briefing.next_meeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {briefing.emails_since_departure > 0 && (
                          <span className="text-xs text-emerald-700 flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {briefing.emails_since_departure} email(s), {briefing.emails_needing_reply} need reply
                          </span>
                        )}
                        {briefing.pending_tasks_count > 0 && (
                          <span className="text-xs text-emerald-700 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {briefing.pending_tasks_count} pending task(s)
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              )
            })}

            {/* Departing Soon Banner with Reply Before You Fly */}
            {upcomingTrips.filter(isDepartingSoon).map(trip => {
              const hoursUntil = Math.round((new Date(trip.start_date).getTime() - now.getTime()) / (1000 * 60 * 60))
              const pf = preFlightData[trip.id]
              const pfLoading = preFlightLoading[trip.id]
              const pfEmails = pf?.emails || []
              const pfTasks = pf?.tasks || getPreTripTasks(trip)
              const totalItems = pfEmails.length + pfTasks.length

              return (
                <motion.div
                  key={`departing-${trip.id}`}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-5"
                >
                  {/* Departure header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                      <Plane className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-amber-900">
                        Departing Soon — {trip.destination_city || trip.title}
                      </h3>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Leaving in ~{hoursUntil} hour(s) ({formatDateRange(trip.start_date, trip.end_date)})
                      </p>
                    </div>
                  </div>

                  {/* Summary banner */}
                  {totalItems > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-amber-100/60 rounded-lg border border-amber-200 mb-3">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                      <p className="text-sm font-medium text-amber-900">
                        You depart in {hoursUntil} hours. {pfEmails.length > 0 ? `${pfEmails.length} email(s) need reply` : ''}{pfEmails.length > 0 && pfTasks.length > 0 ? ', ' : ''}{pfTasks.length > 0 ? `${pfTasks.length} task(s) due` : ''}.
                      </p>
                    </div>
                  )}

                  {pfLoading && !pf && (
                    <div className="flex items-center gap-2 py-3">
                      <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                      <span className="text-sm text-amber-700">Checking pre-flight items...</span>
                    </div>
                  )}

                  {/* Emails needing reply before departure */}
                  {pfEmails.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        Emails to Reply ({pfEmails.length})
                      </h4>
                      <div className="space-y-1.5">
                        {pfEmails.slice(0, 5).map((email: any) => (
                          <a
                            key={email.id}
                            href="/dashboard#needsReply"
                            onClick={(e) => {
                              e.preventDefault()
                              window.location.href = '/dashboard'
                              // Signal to switch to needsReply tab
                              sessionStorage.setItem('chief-inbox-tab', 'needsReply')
                              window.location.href = '/dashboard'
                            }}
                            className="flex items-center gap-2.5 p-2.5 bg-white/60 rounded-lg border border-amber-100 hover:bg-white/80 transition-colors group cursor-pointer"
                          >
                            <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold shrink-0">
                              {(email.from_name || email.from_address || '?')[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-amber-900 font-medium truncate">
                                {email.from_name || email.from_address}
                              </p>
                              <p className="text-xs text-amber-700 truncate">{email.subject}</p>
                            </div>
                            {email.reply_urgency >= 3 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium shrink-0">
                                Urgent
                              </span>
                            )}
                            {email.reply_urgency === 2 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 font-medium shrink-0">
                                Important
                              </span>
                            )}
                            <ArrowRight className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-600 transition-colors shrink-0" />
                          </a>
                        ))}
                        {pfEmails.length > 5 && (
                          <p className="text-xs text-amber-600 pl-10">
                            +{pfEmails.length - 5} more email(s) need reply
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tasks due before/during trip */}
                  {pfTasks.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Urgent Tasks ({pfTasks.length})
                      </h4>
                      <div className="space-y-1.5">
                        {pfTasks.slice(0, 5).map((task: any) => (
                          <div
                            key={task.id}
                            className="flex items-center gap-2 p-2.5 bg-white/60 rounded-lg border border-amber-100"
                          >
                            <ArrowRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="text-sm text-amber-900 truncate">{task.title}</span>
                            {task.priority === 1 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium shrink-0">
                                P1
                              </span>
                            )}
                            {task.due_date && (
                              <span className="text-xs text-amber-600 ml-auto shrink-0">
                                Due {new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        ))}
                        {pfTasks.length > 5 && (
                          <p className="text-xs text-amber-600 pl-7">
                            +{pfTasks.length - 5} more task(s) to handle before departure
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )
            })}

            {/* Upcoming Trips */}
            {upcomingTrips.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
                  Upcoming & Active
                </h2>
                <motion.div
                  initial="initial"
                  animate="animate"
                  variants={{ animate: { transition: { staggerChildren: 0.05 } } }}
                  className="space-y-3"
                >
                  {upcomingTrips.map(trip => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      isExpanded={expandedTrip === trip.id}
                      onToggle={() => setExpandedTrip(expandedTrip === trip.id ? null : trip.id)}
                      preTripTasks={preFlightData[trip.id]?.tasks || getPreTripTasks(trip)}
                      preTripEmails={preFlightData[trip.id]?.emails || []}
                      onGenerateReport={fetchTripReport}
                      reportLoading={reportLoading[trip.id]}
                      tripReport={tripReports[trip.id]}
                    />
                  ))}
                </motion.div>
              </section>
            )}

            {/* Past Trips */}
            {pastTrips.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
                  Past Trips
                </h2>
                <motion.div
                  initial="initial"
                  animate="animate"
                  variants={{ animate: { transition: { staggerChildren: 0.05 } } }}
                  className="space-y-3"
                >
                  {pastTrips.map(trip => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      isExpanded={expandedTrip === trip.id}
                      onToggle={() => setExpandedTrip(expandedTrip === trip.id ? null : trip.id)}
                      preTripTasks={[]}
                      onGenerateReport={fetchTripReport}
                      reportLoading={reportLoading[trip.id]}
                      tripReport={tripReports[trip.id]}
                    />
                  ))}
                </motion.div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function TripCard({
  trip,
  isExpanded,
  onToggle,
  preTripTasks,
  preTripEmails = [],
  onGenerateReport,
  reportLoading,
  tripReport,
}: {
  trip: Trip
  isExpanded: boolean
  onToggle: () => void
  preTripTasks: any[]
  preTripEmails?: any[]
  onGenerateReport: (tripId: string) => void
  reportLoading?: boolean
  tripReport?: any
}) {
  const statusConfig = getStatusConfig(trip.status)
  const flag = countryFlag(trip.destination_country)

  return (
    <motion.div
      variants={{ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } }}
      className="bg-white rounded-xl border border-border overflow-hidden hover:shadow-sm transition-all duration-200"
    >
      {/* Main card content */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 sm:p-5 flex items-start gap-4"
        aria-expanded={isExpanded}
      >
        {/* Destination icon */}
        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
          {flag ? (
            <span className="text-2xl" role="img" aria-label={trip.destination_country || ''}>
              {flag}
            </span>
          ) : (
            <MapPin className="w-6 h-6 text-blue-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-semibold text-text-primary truncate">
              {trip.destination_city || trip.title}
            </h3>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1', statusConfig.color)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', statusConfig.dot)} />
              {statusConfig.label}
            </span>
          </div>

          {/* Date + meta row */}
          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            <span className="text-xs text-text-tertiary flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatDateRange(trip.start_date, trip.end_date)}
            </span>

            {(trip.flight_info?.length ?? 0) > 0 && (
              <span className="text-xs text-text-tertiary flex items-center gap-1">
                <Plane className="w-3.5 h-3.5" />
                {trip.flight_info.length} flight(s)
              </span>
            )}

            {(trip.hotel_info?.length ?? 0) > 0 && (
              <span className="text-xs text-text-tertiary flex items-center gap-1">
                <Hotel className="w-3.5 h-3.5" />
                {trip.hotel_info.length} hotel(s)
              </span>
            )}

            {trip.meetings_count > 0 && (
              <span className="text-xs text-text-tertiary flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {trip.meetings_count} meeting(s)
              </span>
            )}

            {trip.total_expenses > 0 && (
              <span className="text-xs text-text-tertiary flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                {formatCurrency(trip.total_expenses, trip.expense_currency)}
              </span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <div className="shrink-0 mt-1">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-text-tertiary" />
          ) : (
            <ChevronDown className="w-5 h-5 text-text-tertiary" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-5 border-t border-border pt-4">
              {/* Day-by-day timeline */}
              <DayTimeline trip={trip} />

              {/* Pre-trip emails needing reply */}
              {preTripEmails.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
                    <Mail className="w-4 h-4 text-blue-500" />
                    Emails to Reply Before You Fly ({preTripEmails.length})
                  </h4>
                  <div className="space-y-2">
                    {preTripEmails.slice(0, 5).map((email: any) => (
                      <a
                        key={email.id}
                        href="/dashboard"
                        onClick={(e) => {
                          e.preventDefault()
                          sessionStorage.setItem('chief-inbox-tab', 'needsReply')
                          window.location.href = '/dashboard'
                        }}
                        className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100/60 transition-colors cursor-pointer"
                      >
                        <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
                          {(email.from_name || email.from_address || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary truncate font-medium">{email.from_name || email.from_address}</p>
                          <p className="text-xs text-text-tertiary truncate mt-0.5">{email.subject}</p>
                        </div>
                        {email.reply_urgency >= 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium shrink-0 mt-1">
                            Urgent
                          </span>
                        )}
                        <ArrowRight className="w-4 h-4 text-blue-400 shrink-0 mt-1" />
                      </a>
                    ))}
                    {preTripEmails.length > 5 && (
                      <p className="text-xs text-text-tertiary pl-10">
                        +{preTripEmails.length - 5} more email(s) need reply
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Pre-trip tasks */}
              {preTripTasks.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Reply Before You Fly — Tasks ({preTripTasks.length})
                  </h4>
                  <div className="space-y-2">
                    {preTripTasks.slice(0, 5).map((task: any) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100"
                      >
                        <Mail className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-text-primary truncate">{task.title}</p>
                          <p className="text-xs text-text-tertiary mt-0.5">
                            {task.source_email?.from_name || task.source_email?.from_address || 'Manual'}
                            {task.due_date && ` - Due ${new Date(task.due_date).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                    ))}
                    {preTripTasks.length > 5 && (
                      <p className="text-xs text-text-tertiary pl-7">
                        +{preTripTasks.length - 5} more tasks to handle before departure
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Expenses summary */}
              {trip.expenses && trip.expenses.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    Expenses
                  </h4>
                  <div className="space-y-1.5">
                    {trip.expenses.map((exp: any) => (
                      <div key={exp.id} className="flex items-center justify-between py-1.5 px-3 bg-surface-secondary rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-text-secondary capitalize">{exp.category}</span>
                          {exp.merchant_name && (
                            <span className="text-xs text-text-tertiary">- {exp.merchant_name}</span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-text-primary">
                          {formatCurrency(parseFloat(exp.amount), exp.currency)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-2 px-3 border-t border-border mt-2">
                      <span className="text-sm font-semibold text-text-primary">Total</span>
                      <span className="text-sm font-semibold text-text-primary">
                        {formatCurrency(trip.total_expenses, trip.expense_currency)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Generate Report button for completed trips */}
              {trip.status === 'completed' && (
                <div className="mt-5">
                  {!tripReport ? (
                    <button
                      onClick={() => onGenerateReport(trip.id)}
                      disabled={reportLoading}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                        reportLoading
                          ? 'bg-gray-100 text-text-tertiary cursor-wait'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      )}
                    >
                      {reportLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                      {reportLoading ? 'Generating report...' : 'Generate Trip Report'}
                    </button>
                  ) : (
                    <TripReportCard report={tripReport} onRegenerate={() => onGenerateReport(trip.id)} regenerating={reportLoading} />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function TripReportCard({
  report,
  onRegenerate,
  regenerating,
}: {
  report: any
  onRegenerate: () => void
  regenerating?: boolean
}) {
  const r = report.report
  const stats = report.stats

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          Trip Report
        </h4>
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="text-indigo-600 hover:text-indigo-800 p-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
          title="Regenerate report"
        >
          <RefreshCw className={cn('w-4 h-4', regenerating && 'animate-spin')} />
        </button>
      </div>

      {/* Executive Summary */}
      <p className="text-sm text-indigo-900 leading-relaxed mb-4">
        {r.executive_summary}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-4 flex-wrap mb-4 pb-3 border-b border-indigo-200">
        {stats.meetings_count > 0 && (
          <span className="text-xs text-indigo-700 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {stats.meetings_count} meeting(s)
          </span>
        )}
        {stats.tasks_created > 0 && (
          <span className="text-xs text-indigo-700 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {stats.tasks_created} task(s) created
          </span>
        )}
        {stats.follow_ups_count > 0 && (
          <span className="text-xs text-indigo-700 flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" />
            {stats.follow_ups_count} follow-up(s)
          </span>
        )}
        {stats.total_expenses > 0 && (
          <span className="text-xs text-indigo-700 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" />
            {stats.expense_currency} {stats.total_expenses.toFixed(2)}
          </span>
        )}
      </div>

      {/* Meetings attended */}
      {r.meetings_attended && r.meetings_attended.length > 0 && (
        <div className="mb-3">
          <h5 className="text-xs font-semibold text-indigo-800 uppercase tracking-wider mb-1.5">Meetings</h5>
          <div className="space-y-1">
            {r.meetings_attended.map((m: any, i: number) => (
              <div key={i} className="text-xs text-indigo-800 bg-white/50 rounded-lg px-3 py-2">
                <span className="font-medium">{m.title}</span>
                {m.date && <span className="text-indigo-600 ml-2">{m.date}</span>}
                {m.outcome && m.outcome !== 'No notes available' && (
                  <p className="text-indigo-600 mt-0.5">{m.outcome}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Items */}
      {r.action_items && r.action_items.length > 0 && (
        <div className="mb-3">
          <h5 className="text-xs font-semibold text-indigo-800 uppercase tracking-wider mb-1.5">Action Items</h5>
          <div className="space-y-1">
            {r.action_items.map((item: any, i: number) => (
              <div key={i} className="text-xs text-indigo-800 bg-white/50 rounded-lg px-3 py-2 flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                <span>{item.title}</span>
                {item.due_date && <span className="text-indigo-500 ml-auto shrink-0">{item.due_date}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Follow-ups Needed */}
      {r.follow_ups_needed && r.follow_ups_needed.length > 0 && (
        <div className="mb-3">
          <h5 className="text-xs font-semibold text-indigo-800 uppercase tracking-wider mb-1.5">Follow-ups Needed</h5>
          <div className="space-y-1">
            {r.follow_ups_needed.map((f: any, i: number) => (
              <div key={i} className="text-xs text-indigo-800 bg-white/50 rounded-lg px-3 py-2">
                <span className="font-medium">{f.contact}</span>: {f.subject}
                {f.due_date && <span className="text-indigo-500 ml-2">by {f.due_date}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Decisions */}
      {r.key_decisions && r.key_decisions.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-indigo-800 uppercase tracking-wider mb-1.5">Key Decisions</h5>
          <ul className="space-y-1">
            {r.key_decisions.map((d: string, i: number) => (
              <li key={i} className="text-xs text-indigo-800 bg-white/50 rounded-lg px-3 py-2">
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function DayTimeline({ trip }: { trip: Trip }) {
  const days = getDaysBetween(trip.start_date, trip.end_date)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <Clock className="w-4 h-4 text-blue-500" />
        Day-by-Day
      </h4>

      <div className="space-y-2">
        {days.map((day, idx) => {
          const date = new Date(day + 'T00:00:00')
          const dayLabel = `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}`
          const isFirst = idx === 0
          const isLast = idx === days.length - 1

          // Find flights on this day
          const dayFlights = (trip.flight_info || []).filter((f: any) => {
            const depDate = f?.departure_time?.split('T')[0]
            const arrDate = f?.arrival_time?.split('T')[0]
            return depDate === day || arrDate === day
          })

          // Find meetings on this day
          const dayMeetings = (trip.meetings || []).filter((m: any) => {
            const mDate = m.start_time?.split('T')[0]
            return mDate === day
          })

          // Find expenses on this day
          const dayExpenses = (trip.expenses || []).filter((e: any) => e.expense_date === day)

          const hasContent = dayFlights.length > 0 || dayMeetings.length > 0 || dayExpenses.length > 0 || isFirst || isLast

          return (
            <div key={day} className="flex gap-3">
              {/* Timeline indicator */}
              <div className="flex flex-col items-center shrink-0 w-6">
                <div className={cn(
                  'w-2.5 h-2.5 rounded-full mt-1.5',
                  isFirst || isLast ? 'bg-primary' : 'bg-border'
                )} />
                {idx < days.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>

              {/* Day content */}
              <div className="flex-1 pb-3 min-w-0">
                <p className="text-xs font-semibold text-text-secondary">{dayLabel}</p>

                {isFirst && dayFlights.length === 0 && (
                  <p className="text-xs text-text-tertiary mt-1">Departure day</p>
                )}
                {isLast && dayFlights.length === 0 && (
                  <p className="text-xs text-text-tertiary mt-1">Return day</p>
                )}

                {/* Flights */}
                {dayFlights.map((flight: any, fi: number) => (
                  <div key={fi} className="mt-1.5 flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg">
                    <Plane className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium">{flight.airline} {flight.flight_number}</span>
                    <span className="text-blue-500">
                      {flight.departure_airport} &rarr; {flight.arrival_airport}
                    </span>
                  </div>
                ))}

                {/* Meetings */}
                {dayMeetings.map((meeting: any) => {
                  const time = new Date(meeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={meeting.id} className="mt-1.5 flex items-center gap-2 text-xs text-purple-700 bg-purple-50 px-2.5 py-1.5 rounded-lg">
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-medium">{time}</span>
                      <span className="truncate">{meeting.title}</span>
                    </div>
                  )
                })}

                {/* Expenses */}
                {dayExpenses.map((exp: any) => (
                  <div key={exp.id} className="mt-1.5 flex items-center gap-2 text-xs text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg">
                    <DollarSign className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium capitalize">{exp.category}</span>
                    <span>{exp.merchant_name}</span>
                    <span className="ml-auto font-medium">{formatCurrency(parseFloat(exp.amount), exp.currency)}</span>
                  </div>
                ))}

                {!hasContent && (
                  <p className="text-xs text-text-tertiary mt-1">Free day</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
