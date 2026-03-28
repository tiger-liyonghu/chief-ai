'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import {
  Users,
  Building2,
  Loader2,
  AlertTriangle,
  Thermometer,
  Search,
  ChevronRight,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'
import Link from 'next/link'

/* ─── Types ─── */

interface Contact {
  id: string
  email: string
  name: string | null
  company: string | null
  role: string | null
  relationship: string
  importance: string
  email_count: number
}

interface RelationshipData {
  email: string
  name: string
  company: string | null
  relationship: string
  importance: string
  temperature: number
  status: 'hot' | 'warm' | 'cooling' | 'cold'
  days_since_contact: number
  recent_interactions_30d: number
  open_commitments: { promised: number; waiting: number }
  needs_attention: boolean
}

interface WeaverResponse {
  relationships: RelationshipData[]
  cooling: RelationshipData[]
  summary: {
    total_contacts: number
    hot: number
    warm: number
    cooling: number
    cold: number
    needs_attention: number
  }
}

/* ─── Constants ─── */

const IMPORTANCE_STYLES: Record<string, { label: string; className: string }> = {
  vip: { label: 'VIP', className: 'bg-amber-100 text-amber-700 border border-amber-300' },
  high: { label: 'High', className: 'bg-blue-100 text-blue-700 border border-blue-300' },
  normal: { label: 'Normal', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
  low: { label: 'Low', className: 'bg-gray-50 text-gray-400 border border-gray-100' },
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  boss: 'Boss',
  team: 'Team',
  client: 'Client',
  investor: 'Investor',
  partner: 'Partner',
  vendor: 'Vendor',
  personal: 'Personal',
  recruiter: 'Recruiter',
  other: 'Other',
}

/* ─── Helpers ─── */

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function getAvatarColor(name: string | null, email: string): string {
  const str = name || email
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-red-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
  ]
  return colors[Math.abs(hash) % colors.length]
}

function getTemperatureColor(temp: number): string {
  if (temp >= 70) return 'bg-emerald-600' // hot
  if (temp >= 40) return 'bg-emerald-400' // warm
  if (temp >= 20) return 'bg-amber-400'   // cooling
  return 'bg-red-400'                      // cold
}

function getTemperatureLabel(status: string): string {
  switch (status) {
    case 'hot': return 'Hot'
    case 'warm': return 'Warm'
    case 'cooling': return 'Cooling'
    case 'cold': return 'Cold'
    default: return ''
  }
}

/* ─── Attention Alert Banner ─── */

function AttentionBanner({ cooling }: { cooling: RelationshipData[] }) {
  if (cooling.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <h3 className="text-sm font-semibold text-amber-800">
          Needs Your Attention
        </h3>
        <span className="ml-auto text-xs text-amber-600 font-medium px-2 py-0.5 bg-amber-100 rounded-full">
          {cooling.length}
        </span>
      </div>
      <div className="space-y-2">
        {cooling.map((rel) => (
          <Link
            key={rel.email}
            href={`/dashboard/contacts/${encodeURIComponent(rel.email)}`}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-amber-100/50 transition-colors"
          >
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0',
              getAvatarColor(rel.name, rel.email)
            )}>
              {getInitials(rel.name, rel.email)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-900 truncate">{rel.name}</p>
              <p className="text-xs text-amber-600">
                {rel.company ? `${rel.company} · ` : ''}{rel.days_since_contact}d since last contact
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                IMPORTANCE_STYLES[rel.importance]?.className || IMPORTANCE_STYLES.normal.className
              )}>
                {IMPORTANCE_STYLES[rel.importance]?.label || 'Normal'}
              </span>
              <TemperatureBar temperature={rel.temperature} status={rel.status} compact />
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  )
}

/* ─── Temperature Bar ─── */

function TemperatureBar({ temperature, status, compact = false }: {
  temperature: number
  status: string
  compact?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-2', compact ? 'w-20' : 'w-28')}>
      <div className={cn(
        'flex-1 bg-gray-100 rounded-full overflow-hidden',
        compact ? 'h-1.5' : 'h-2'
      )}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${temperature}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn('h-full rounded-full', getTemperatureColor(temperature))}
        />
      </div>
      {!compact && (
        <span className="text-xs text-text-tertiary w-6 text-right">{temperature}</span>
      )}
    </div>
  )
}

/* ─── Contact Card ─── */

function ContactCard({ contact, weaverData }: {
  contact: Contact
  weaverData?: RelationshipData
}) {
  const temperature = weaverData?.temperature ?? 50
  const status = weaverData?.status ?? 'warm'

  return (
    <Link href={`/dashboard/contacts/${contact.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        className="bg-white rounded-2xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0',
            getAvatarColor(contact.name, contact.email)
          )}>
            {getInitials(contact.name, contact.email)}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-text-primary truncate">
                {contact.name || contact.email}
              </p>
              <span className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0',
                IMPORTANCE_STYLES[contact.importance]?.className || IMPORTANCE_STYLES.normal.className
              )}>
                {IMPORTANCE_STYLES[contact.importance]?.label || 'Normal'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {contact.company && (
                <span className="text-xs text-text-tertiary flex items-center gap-1 truncate">
                  <Building2 className="w-3 h-3" />
                  {contact.company}
                </span>
              )}
              {contact.relationship && contact.relationship !== 'other' && (
                <span className="text-xs text-text-tertiary">
                  {RELATIONSHIP_LABELS[contact.relationship] || contact.relationship}
                </span>
              )}
            </div>
          </div>

          {/* Temperature */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-text-tertiary">
                {getTemperatureLabel(status)}
              </p>
            </div>
            <TemperatureBar temperature={temperature} status={status} />
            <ChevronRight className="w-4 h-4 text-text-tertiary" />
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

/* ─── Summary Stats ─── */

function SummaryStats({ summary }: { summary: WeaverResponse['summary'] | null }) {
  if (!summary) return null

  const stats = [
    { label: 'Hot', value: summary.hot, color: 'bg-emerald-600' },
    { label: 'Warm', value: summary.warm, color: 'bg-emerald-400' },
    { label: 'Cooling', value: summary.cooling, color: 'bg-amber-400' },
    { label: 'Cold', value: summary.cold, color: 'bg-red-400' },
  ]

  return (
    <div className="flex items-center gap-4 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-2">
          <div className={cn('w-2.5 h-2.5 rounded-full', s.color)} />
          <span className="text-xs text-text-tertiary">{s.label}</span>
          <span className="text-xs font-semibold text-text-primary">{s.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── Main Page ─── */

type FilterTab = 'all' | 'vip' | 'high' | 'cooling'

export default function ContactsPage() {
  const { t } = useI18n()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [weaverData, setWeaverData] = useState<WeaverResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [contactsRes, weaverRes] = await Promise.all([
        fetch('/api/contacts'),
        fetch('/api/agents/weaver'),
      ])
      if (contactsRes.ok) {
        const data = await contactsRes.json()
        setContacts(data)
      }
      if (weaverRes.ok) {
        const data = await weaverRes.json()
        setWeaverData(data)
      }
    } catch (err) {
      console.error('Failed to fetch contacts:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Build weaver lookup by email
  const weaverByEmail = new Map<string, RelationshipData>()
  if (weaverData?.relationships) {
    for (const rel of weaverData.relationships) {
      weaverByEmail.set(rel.email.toLowerCase(), rel)
    }
  }

  // Filter contacts
  const filteredContacts = contacts.filter((c) => {
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const nameMatch = (c.name || '').toLowerCase().includes(q)
      const emailMatch = c.email.toLowerCase().includes(q)
      const companyMatch = (c.company || '').toLowerCase().includes(q)
      if (!nameMatch && !emailMatch && !companyMatch) return false
    }

    // Tab filter
    if (activeFilter === 'vip') return c.importance === 'vip'
    if (activeFilter === 'high') return c.importance === 'high'
    if (activeFilter === 'cooling') {
      const rel = weaverByEmail.get(c.email.toLowerCase())
      return rel?.needs_attention === true
    }

    return true
  })

  // Sort: VIPs first, then by email_count
  const sortedContacts = [...filteredContacts].sort((a, b) => {
    const order: Record<string, number> = { vip: 0, high: 1, normal: 2, low: 3 }
    const diff = (order[a.importance] ?? 3) - (order[b.importance] ?? 3)
    if (diff !== 0) return diff
    return (b.email_count || 0) - (a.email_count || 0)
  })

  const filters: { key: FilterTab; label: string }[] = [
    { key: 'all', label: `All (${contacts.length})` },
    { key: 'vip', label: 'VIP' },
    { key: 'high', label: 'High' },
    { key: 'cooling', label: `Needs Attention (${weaverData?.cooling?.length || 0})` },
  ]

  return (
    <>
      <TopBar
        title={t('contacts' as any)}
        subtitle={`${contacts.length} contacts`}
        onSyncComplete={fetchData}
      />

      <div className="px-4 sm:px-8 py-6 max-w-4xl">
        {/* Attention Banner */}
        {weaverData?.cooling && weaverData.cooling.length > 0 && (
          <AttentionBanner cooling={weaverData.cooling} />
        )}

        {/* Summary Stats */}
        <SummaryStats summary={weaverData?.summary || null} />

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <div className="flex items-center gap-1 bg-white border border-border rounded-xl p-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                  activeFilter === f.key
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:bg-surface-secondary'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contact List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-text-tertiary">Loading contacts...</span>
          </div>
        ) : sortedContacts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Users className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
            <p className="text-sm text-text-secondary font-medium">No contacts found</p>
            <p className="text-xs text-text-tertiary mt-1">
              {contacts.length === 0
                ? 'Sync your emails to detect contacts automatically.'
                : 'Try adjusting your search or filter.'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {sortedContacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  weaverData={weaverByEmail.get(contact.email.toLowerCase())}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </>
  )
}
