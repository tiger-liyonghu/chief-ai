'use client'

import { cn } from '@/lib/utils'

/**
 * Skeleton loading placeholder — replaces spinners throughout the app.
 * Usage: <Skeleton className="h-4 w-32" /> for a text line
 *        <Skeleton className="h-20 w-full rounded-2xl" /> for a card
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-surface-secondary',
        className,
      )}
    />
  )
}

/**
 * SkeletonCard — common pattern for card-shaped loading states.
 */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  )
}

/**
 * SkeletonBriefing — loading state for the Today Briefing.
 */
export function SkeletonBriefing() {
  return (
    <div className="space-y-6 p-4 sm:p-8 max-w-3xl mx-auto">
      {/* Greeting */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Urgent items */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        {[1, 2].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-border p-4 space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
            <Skeleton className="h-3 w-3/4 ml-11" />
          </div>
        ))}
      </div>

      {/* Meetings */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-16 h-6 rounded" />
            <Skeleton className="h-4 flex-1" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="w-16 h-6 rounded" />
            <Skeleton className="h-4 flex-1" />
          </div>
        </div>
      </div>

      {/* Summary */}
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  )
}
