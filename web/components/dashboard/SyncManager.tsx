'use client'

import { useEffect, useRef, useCallback } from 'react'

const SYNC_INTERVAL = 5 * 60 * 1000 // 5 minutes

/**
 * Headless background sync manager.
 * Runs a silent sync every 5 minutes to keep inbox data fresh.
 * Dispatches a custom event so any listener can refresh UI data.
 */
export function SyncManager() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const syncingRef = useRef(false)

  const runBackgroundSync = useCallback(async () => {
    if (syncingRef.current) return
    syncingRef.current = true

    try {
      // Phase 1: metadata sync
      const res = await fetch('/api/sync', { method: 'POST' })
      if (res.ok) {
        localStorage.setItem('chief-last-sync', Date.now().toString())
        // Notify listeners that sync completed
        window.dispatchEvent(new CustomEvent('chief-sync-complete'))

        // Phase 2: background AI processing (fire-and-forget)
        fetch('/api/sync/process', { method: 'POST' })
          .then(async (processRes) => {
            if (processRes.ok) {
              window.dispatchEvent(new CustomEvent('chief-sync-complete'))
            }
          })
          .catch(() => {
            // AI processing failure is non-critical
          })
      } else {
        window.dispatchEvent(new CustomEvent('chief-sync-error'))
      }
    } catch {
      window.dispatchEvent(new CustomEvent('chief-sync-error'))
    } finally {
      syncingRef.current = false
    }
  }, [])

  useEffect(() => {
    // On mount: check if we need an initial sync
    const lastSync = parseInt(localStorage.getItem('chief-last-sync') || '0')
    if (Date.now() - lastSync > SYNC_INTERVAL) {
      // Delay initial background sync by 3s to let page load first
      const initTimeout = setTimeout(runBackgroundSync, 3000)
      return () => clearTimeout(initTimeout)
    }
  }, [runBackgroundSync])

  useEffect(() => {
    // Set up recurring interval
    intervalRef.current = setInterval(runBackgroundSync, SYNC_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [runBackgroundSync])

  // Renders nothing - purely a background sync engine
  return null
}
