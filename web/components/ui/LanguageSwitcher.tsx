'use client'

import { useI18n } from '@/lib/i18n/context'
import { Locale, localeNames } from '@/lib/i18n/translations'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

const locales: Locale[] = ['en', 'zh', 'ms']

/**
 * Standalone language switcher — usable in landing page, sidebar, or anywhere.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n()

  return (
    <div className="flex items-center gap-1">
      {!compact && <Globe className="w-4 h-4 text-text-tertiary shrink-0" />}
      <div className="flex items-center gap-0.5 bg-surface-secondary rounded-lg p-0.5">
        {locales.map((l) => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            className={cn(
              'px-2 py-1 rounded-md text-xs font-medium transition-all duration-200',
              locale === l
                ? 'bg-white text-primary shadow-sm'
                : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            {localeNames[l]}
          </button>
        ))}
      </div>
    </div>
  )
}
