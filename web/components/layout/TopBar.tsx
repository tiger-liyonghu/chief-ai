'use client'

import { RefreshCw, Search, MessageCircle } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { GlobalSearch } from '@/components/dashboard/GlobalSearch'
import { useI18n } from '@/lib/i18n/context'

const SYNC_COOLDOWN = 5 * 60 * 1000 // 5 minutes

function formatLastSync(ts: number): string {
  if (!ts) return ''
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export function TopBar({ title, subtitle, onSyncComplete, autoSync = false }: {
  title: string; subtitle?: string; onSyncComplete?: () => void; autoSync?: boolean
}) {
  const { t } = useI18n()
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [lastSyncLabel, setLastSyncLabel] = useState('')
  const [assistantName, setAssistantName] = useState('Sophia')
  const hasSynced = useRef(false)

  // Fetch assistant name for the chat button
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

  // Update the "last synced" label every 30s
  const updateLastSyncLabel = useCallback(() => {
    const ts = parseInt(localStorage.getItem('chief-last-sync') || '0')
    setLastSyncLabel(formatLastSync(ts))
  }, [])

  useEffect(() => {
    updateLastSyncLabel()
    const timer = setInterval(updateLastSyncLabel, 30000)
    return () => clearInterval(timer)
  }, [updateLastSyncLabel])

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Listen for background sync events from SyncManager
  useEffect(() => {
    const onSyncDone = () => {
      setSyncError(false)
      updateLastSyncLabel()
      onSyncComplete?.()
    }
    const onSyncErr = () => {
      setSyncError(true)
    }
    window.addEventListener('chief-sync-complete', onSyncDone)
    window.addEventListener('chief-sync-error', onSyncErr)
    return () => {
      window.removeEventListener('chief-sync-complete', onSyncDone)
      window.removeEventListener('chief-sync-error', onSyncErr)
    }
  }, [onSyncComplete, updateLastSyncLabel])

  const handleSync = async () => {
    setSyncing(true)
    setSyncError(false)
    try {
      // Phase 1: Fast metadata sync (emails + calendar, no AI)
      const res = await fetch('/api/sync', { method: 'POST' })
      if (res.ok) {
        localStorage.setItem('chief-last-sync', Date.now().toString())
        updateLastSyncLabel()
        onSyncComplete?.() // Refresh UI with raw email data immediately

        // Phase 2: Background AI processing
        fetch('/api/sync/process', { method: 'POST' })
          .then(async (processRes) => {
            if (processRes.ok) {
              onSyncComplete?.() // Refresh UI again with AI-enriched data
            }
          })
          .catch((err) => console.error('AI processing failed:', err))
      } else {
        setSyncError(true)
      }
    } catch {
      setSyncError(true)
    } finally {
      setTimeout(() => setSyncing(false), 1000)
    }
  }

  // Auto-sync on mount with cooldown
  useEffect(() => {
    if (!autoSync || hasSynced.current) return
    hasSynced.current = true

    const lastSync = parseInt(localStorage.getItem('chief-last-sync') || '0')
    if (Date.now() - lastSync > SYNC_COOLDOWN) {
      handleSync()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync])

  const openChat = () => {
    window.dispatchEvent(new CustomEvent('chief-open-chat'))
  }

  return (
    <header className="flex items-center justify-between pl-14 lg:pl-8 pr-4 sm:pr-8 py-4 sm:py-5 border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="min-w-0 flex-1 mr-2">
        <h1 className="text-base sm:text-xl font-semibold text-text-primary truncate">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-text-tertiary mt-0.5 truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <span className="hidden md:inline text-xs text-text-tertiary">
          {lastSyncLabel
            ? `${t('lastSynced')}: ${lastSyncLabel} ${t('ago')}`
            : t('notSyncedYet')}
        </span>
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary-light rounded-xl transition-all duration-200"
          aria-label={t('search')}
        >
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline text-xs text-text-tertiary border border-border rounded-md px-1.5 py-0.5 font-mono">
            {'\u2318'}K
          </span>
        </button>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="relative flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary-light rounded-xl transition-all duration-200"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncError && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
          <span className="hidden sm:inline">{syncing ? t('syncing') : t('syncNow')}</span>
        </button>

        {/* Ask Sophia via FAB (bottom-right) — TopBar button removed to avoid duplicate */}
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
