'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { ChatPanel } from '@/components/dashboard/ChatPanel'
import { SyncManager } from '@/components/dashboard/SyncManager'
import { Sun, Mail, Users, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'

function BottomTabItem({ href, icon: Icon, label, active, onClick }: {
  href?: string
  icon: any
  label: string
  active?: boolean
  onClick?: () => void
}) {
  const content = (
    <div className="flex flex-col items-center gap-0.5 py-1">
      <Icon className={cn('w-5 h-5', active ? 'text-primary' : 'text-text-tertiary')} />
      <span className={cn('text-[10px] font-medium', active ? 'text-primary' : 'text-text-tertiary')}>
        {label}
      </span>
    </div>
  )

  if (onClick) {
    return (
      <button onClick={onClick} className="flex-1 flex justify-center">
        {content}
      </button>
    )
  }

  return (
    <Link href={href!} className="flex-1 flex justify-center">
      {content}
    </Link>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { t } = useI18n()

  const openChat = () => {
    window.dispatchEvent(new CustomEvent('chief-open-chat'))
  }

  return (
    <div className="min-h-screen bg-surface-secondary">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile, fixed on desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      <main className="lg:ml-64 pb-20 lg:pb-0">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around py-2">
          <BottomTabItem
            href="/dashboard"
            icon={Sun}
            label={t('todayNav' as any)}
            active={pathname === '/dashboard'}
          />
          <BottomTabItem
            href="/dashboard/inbox"
            icon={Mail}
            label={t('inbox')}
            active={pathname === '/dashboard/inbox' || pathname.startsWith('/dashboard/inbox/')}
          />
          <BottomTabItem
            href="/dashboard/contacts"
            icon={Users}
            label={t('people' as any)}
            active={pathname === '/dashboard/contacts' || pathname.startsWith('/dashboard/contacts/')}
          />
          <BottomTabItem
            icon={MessageCircle}
            label={t('chat' as any)}
            onClick={openChat}
          />
        </div>
      </div>

      {/* Background sync engine */}
      <SyncManager />

      {/* Floating AI Chat */}
      <ChatPanel />
    </div>
  )
}
