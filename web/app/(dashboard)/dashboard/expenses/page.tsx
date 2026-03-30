'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import {
  Plane, Hotel, Car, UtensilsCrossed, Circle,
  Download, Plus, Loader2, X, Receipt, Sparkles, ChevronUp,
} from 'lucide-react'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'

/* ---------- types ---------- */
interface Expense {
  id: string
  trip_id: string | null
  category: 'flight' | 'hotel' | 'transport' | 'meal' | 'other'
  merchant_name: string
  amount: number
  currency: string
  amount_base: number
  base_currency: string
  expense_date: string
  notes: string | null
  status: 'pending' | 'approved' | 'exported'
  trip?: { id: string; destination: string } | null
}

interface Trip {
  id: string
  destination: string
}

/* ---------- constants ---------- */
const filters = ['All', 'By Trip', 'Pending', 'Exported'] as const
type Filter = (typeof filters)[number]

const categoryConfig: Record<string, { icon: typeof Plane; label: string; color: string }> = {
  flight:    { icon: Plane,              label: 'Flight',    color: 'text-blue-600 bg-blue-50' },
  hotel:     { icon: Hotel,              label: 'Hotel',     color: 'text-purple-600 bg-purple-50' },
  transport: { icon: Car,                label: 'Transport', color: 'text-green-600 bg-green-50' },
  meal:      { icon: UtensilsCrossed,    label: 'Meal',      color: 'text-orange-600 bg-orange-50' },
  other:     { icon: Circle,             label: 'Other',     color: 'text-gray-600 bg-gray-50' },
}

const statusBadge: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  exported: 'bg-blue-100 text-blue-700',
}

const categories = ['flight', 'hotel', 'transport', 'meal', 'other'] as const
const currencies = ['SGD', 'USD', 'INR', 'EUR', 'GBP', 'MYR', 'THB', 'JPY', 'AUD']

/* ---------- helpers ---------- */
function fmtAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/* ---------- page ---------- */
export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<Filter>('All')
  const [showForm, setShowForm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reportText, setReportText] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [showReport, setShowReport] = useState(false)

  // Form state
  const [form, setForm] = useState({
    trip_id: '',
    category: 'other' as string,
    merchant_name: '',
    amount: '',
    currency: 'SGD',
    expense_date: new Date().toISOString().slice(0, 10),
    notes: '',
  })

  const fetchData = useCallback(async () => {
    try {
      const [expRes, tripRes] = await Promise.all([
        fetch('/api/expenses'),
        fetch('/api/trips'),
      ])
      if (expRes.ok) setExpenses(await expRes.json())
      if (tripRes.ok) {
        const tripData = await tripRes.json()
        setTrips(Array.isArray(tripData) ? tripData : [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /* ---------- derived stats ---------- */
  const stats = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

    const pendingTotal = expenses
      .filter(e => e.status === 'pending')
      .reduce((s, e) => s + (e.amount_base || e.amount), 0)

    const monthTotal = expenses
      .filter(e => e.expense_date >= monthStart)
      .reduce((s, e) => s + (e.amount_base || e.amount), 0)

    const unassigned = expenses.filter(e => !e.trip_id).length

    const baseCurrency = expenses.find(e => e.base_currency)?.base_currency || 'SGD'

    return { pendingTotal, monthTotal, unassigned, baseCurrency }
  }, [expenses])

  /* ---------- filtering ---------- */
  const filtered = useMemo(() => {
    switch (activeFilter) {
      case 'Pending':  return expenses.filter(e => e.status === 'pending')
      case 'Exported': return expenses.filter(e => e.status === 'exported')
      default:         return expenses
    }
  }, [expenses, activeFilter])

  /* ---------- grouped by trip (for By Trip tab) ---------- */
  const grouped = useMemo(() => {
    const groups: Record<string, { trip: Trip | null; items: Expense[] }> = {}
    for (const e of filtered) {
      const key = e.trip_id || '__unassigned__'
      if (!groups[key]) {
        groups[key] = {
          trip: e.trip ? { id: e.trip.id, destination: e.trip.destination } : null,
          items: [],
        }
      }
      groups[key].items.push(e)
    }
    return groups
  }, [filtered])

  /* ---------- actions ---------- */
  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          trip_id: form.trip_id || null,
        }),
      })
      if (res.ok) {
        setShowForm(false)
        setForm({ trip_id: '', category: 'other', merchant_name: '', amount: '', currency: 'SGD', expense_date: new Date().toISOString().slice(0, 10), notes: '' })
        fetchData()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/expenses/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'csv' }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'expenses.csv'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        fetchData() // refresh to see updated statuses
      }
    } finally {
      setExporting(false)
    }
  }

  /* ---------- render helpers ---------- */
  const renderExpenseRow = (expense: Expense) => {
    const cat = categoryConfig[expense.category] || categoryConfig.other
    const Icon = cat.icon
    return (
      <motion.div
        key={expense.id}
        variants={{ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } }}
        className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white rounded-xl border border-border hover:shadow-sm transition-all duration-200"
      >
        {/* Category icon */}
        <div className={cn('w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0', cat.color)}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{expense.merchant_name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-text-tertiary">{fmtDate(expense.expense_date)}</span>
            {expense.trip && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-light text-primary font-medium truncate max-w-[120px]">
                {expense.trip.destination}
              </span>
            )}
          </div>
        </div>

        {/* Amount + status */}
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-text-primary whitespace-nowrap">
            {fmtAmount(expense.amount, expense.currency)}
          </p>
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', statusBadge[expense.status])}>
            {expense.status}
          </span>
        </div>
      </motion.div>
    )
  }

  const handleGenerateReport = async () => {
    setReportLoading(true)
    setReportText('')
    setShowReport(true)
    try {
      const res = await fetch('/api/expenses/report')
      if (!res.ok) throw new Error()
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setReportText(acc)
      }
    } catch {
      setReportText('Failed to generate report. Make sure you have expenses recorded.')
    } finally {
      setReportLoading(false)
    }
  }

  const pendingCount = expenses.filter(e => e.status === 'pending').length

  return (
    <div>
      <TopBar title="Expenses" subtitle={`${pendingCount} pending`} onSyncComplete={fetchData} />

      <div className="p-4 sm:p-6 lg:p-8">

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-xl border border-border p-4">
            <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide">Pending Total</p>
            <p className="text-xl sm:text-2xl font-bold text-text-primary mt-1">{fmtAmount(stats.pendingTotal, stats.baseCurrency)}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-4">
            <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide">This Month</p>
            <p className="text-xl sm:text-2xl font-bold text-text-primary mt-1">{fmtAmount(stats.monthTotal, stats.baseCurrency)}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-4">
            <p className="text-xs text-text-tertiary font-medium uppercase tracking-wide">Unassigned</p>
            <p className="text-xl sm:text-2xl font-bold text-text-primary mt-1">{stats.unassigned}</p>
            <p className="text-xs text-text-tertiary mt-0.5">expenses without a trip</p>
          </div>
        </div>

        {/* Filters + actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto">
            {filters.map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap',
                  activeFilter === f
                    ? 'bg-primary text-white'
                    : 'bg-white border border-border text-text-secondary hover:bg-surface-secondary'
                )}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              <span>Add Expense</span>
            </button>
            <button
              onClick={handleGenerateReport}
              disabled={reportLoading || expenses.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100 transition-all duration-200 disabled:opacity-50"
            >
              {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>AI Report</span>
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || expenses.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white border border-border text-text-secondary hover:bg-surface-secondary transition-all duration-200 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* AI Report Panel */}
        {showReport && (
          <div className="mb-6 bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-violet-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Expense Analysis Report
              </h3>
              <button onClick={() => setShowReport(false)} className="p-1 text-violet-400 hover:text-violet-600">
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-violet-900 leading-relaxed whitespace-pre-line">
              {reportText}
              {reportLoading && <span className="inline-block w-1.5 h-4 bg-violet-400/60 animate-pulse ml-0.5 align-text-bottom rounded-sm" />}
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
            <p className="text-sm text-text-tertiary mt-3">Loading expenses...</p>
          </div>
        ) : (
          <>
            {activeFilter === 'By Trip' ? (
              /* Grouped view */
              <div className="space-y-6">
                {Object.entries(grouped).map(([key, group]) => (
                  <div key={key}>
                    <h3 className="text-sm font-semibold text-text-secondary mb-3">
                      {group.trip ? group.trip.destination : 'Unassigned'}
                      <span className="text-text-tertiary font-normal ml-2">
                        ({group.items.length} expense{group.items.length !== 1 ? 's' : ''})
                      </span>
                    </h3>
                    <motion.div
                      initial="initial"
                      animate="animate"
                      variants={{ animate: { transition: { staggerChildren: 0.03 } } }}
                      className="space-y-2"
                    >
                      {group.items.map(renderExpenseRow)}
                    </motion.div>
                  </div>
                ))}
                {Object.keys(grouped).length === 0 && (
                  <EmptyState />
                )}
              </div>
            ) : (
              /* Flat list */
              <>
                <motion.div
                  initial="initial"
                  animate="animate"
                  variants={{ animate: { transition: { staggerChildren: 0.03 } } }}
                  className="space-y-2"
                >
                  {filtered.map(renderExpenseRow)}
                </motion.div>
                {filtered.length === 0 && <EmptyState />}
              </>
            )}
          </>
        )}

        {/* Add Expense Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
              onClick={() => setShowForm(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-5 border-b border-border">
                  <h2 className="text-lg font-semibold text-text-primary">Add Expense</h2>
                  <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-surface-secondary transition-colors">
                    <X className="w-5 h-5 text-text-tertiary" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Category</label>
                    <div className="grid grid-cols-5 gap-2">
                      {categories.map(c => {
                        const conf = categoryConfig[c]
                        const Icon = conf.icon
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, category: c }))}
                            className={cn(
                              'flex flex-col items-center gap-1 p-2 rounded-xl border transition-all duration-200 text-xs',
                              form.category === c
                                ? 'border-primary bg-primary-light text-primary'
                                : 'border-border text-text-tertiary hover:border-primary/40'
                            )}
                          >
                            <Icon className="w-4 h-4" />
                            {conf.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Merchant */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Merchant</label>
                    <input
                      type="text"
                      required
                      value={form.merchant_name}
                      onChange={e => setForm(f => ({ ...f, merchant_name: e.target.value }))}
                      placeholder="e.g. Singapore Airlines"
                      className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>

                  {/* Amount + Currency */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-text-secondary mb-1.5">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={form.amount}
                        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-sm font-medium text-text-secondary mb-1.5">Currency</label>
                      <select
                        value={form.currency}
                        onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all bg-white"
                      >
                        {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Date</label>
                    <input
                      type="date"
                      required
                      value={form.expense_date}
                      onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>

                  {/* Trip (optional) */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Trip (optional)</label>
                    <select
                      value={form.trip_id}
                      onChange={e => setForm(f => ({ ...f, trip_id: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all bg-white"
                    >
                      <option value="">No trip</option>
                      {trips.map(t => <option key={t.id} value={t.id}>{t.destination}</option>)}
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Notes (optional)</label>
                    <textarea
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Any additional details..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-all duration-200 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {submitting ? 'Adding...' : 'Add Expense'}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <Receipt className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
      <p className="text-text-secondary font-medium">No expenses yet</p>
      <p className="text-sm text-text-tertiary mt-1">Add your first expense or sync to pull from emails.</p>
    </div>
  )
}
