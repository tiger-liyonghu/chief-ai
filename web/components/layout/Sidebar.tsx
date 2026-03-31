'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'
import { Locale, localeNames } from '@/lib/i18n/translations'
import { createClient } from '@/lib/supabase/client'
import {
  Target,
  Mail,
  Users,
  CalendarDays,
  Plane,
  Receipt,
  Heart,
  TrendingUp,
  Settings,
  Sparkles,
  LogOut,
  Globe,
} from 'lucide-react'

const navKeys = [
  { href: '/dashboard', key: 'commitmentsNav' as const, icon: Target },
  { href: '/dashboard/calendar', key: 'calendar' as const, icon: CalendarDays },
  { href: '/dashboard/inbox', key: 'inbox' as const, icon: Mail },
  { href: '/dashboard/contacts', key: 'people' as const, icon: Users },
  { href: '/dashboard/trips', key: 'trips' as const, icon: Plane },
  { href: '/dashboard/family', key: 'familyNav' as const, icon: Heart },
  { href: '/dashboard/expenses', key: 'expenses' as const, icon: Receipt },
  { href: '/dashboard/insights', key: 'insightsNav' as const, icon: TrendingUp },
]

const locales: Locale[] = ['en', 'zh']

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname()
  const { t, locale, setLocale } = useI18n()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside className="w-64 h-full bg-white border-r border-border flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-border">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg">{t('chief')}</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navKeys.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === item.href || pathname.startsWith(item.href + '/')
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
        {/* Settings */}
        <Link
          href="/dashboard/settings"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
            pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/')
              ? 'bg-primary-light text-primary'
              : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
          )}
        >
          <Settings className="w-5 h-5" />
          {t('settings')}
        </Link>

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

        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-tertiary hover:text-danger hover:bg-red-50 transition-all duration-200 w-full"
        >
          <LogOut className="w-5 h-5" />
          {t('signOut')}
        </button>
      </div>
    </aside>
  )
}
