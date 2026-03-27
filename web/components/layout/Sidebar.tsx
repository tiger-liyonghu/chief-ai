'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'
import { Locale, localeNames } from '@/lib/i18n/translations'
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Settings,
  Sparkles,
  LogOut,
  Globe,
} from 'lucide-react'

const navKeys = [
  { href: '/dashboard', key: 'inbox' as const, icon: LayoutDashboard },
  { href: '/dashboard/tasks', key: 'tasks' as const, icon: CheckSquare },
  { href: '/dashboard/calendar', key: 'calendar' as const, icon: Calendar },
  { href: '/dashboard/settings', key: 'settings' as const, icon: Settings },
]

const locales: Locale[] = ['en', 'zh', 'ms']

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname()
  const { t, locale, setLocale } = useI18n()

  return (
    <aside className="w-64 h-screen bg-white border-r border-border flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-border">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg">{t('chief')}</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navKeys.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary-light text-primary'
                  : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
              )}
            >
              <item.icon className="w-5 h-5" />
              {t(item.key)}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-border space-y-2">
        {/* Language Switcher */}
        <div className="flex items-center gap-1 px-3 py-1.5">
          <Globe className="w-4 h-4 text-text-tertiary shrink-0" />
          <div className="flex items-center gap-0.5 bg-surface-secondary rounded-lg p-0.5 flex-1">
            {locales.map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={cn(
                  'flex-1 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200',
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

        <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-tertiary hover:text-danger hover:bg-red-50 transition-all duration-200 w-full">
          <LogOut className="w-5 h-5" />
          {t('signOut')}
        </button>
      </div>
    </aside>
  )
}
