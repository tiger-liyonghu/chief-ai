'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Sidebar } from '@/components/layout/Sidebar'
import { ChatPanel } from '@/components/dashboard/ChatPanel'
import { SyncManager } from '@/components/dashboard/SyncManager'
import { Sun, Mail, CheckSquare, MessageCircle, CalendarDays, Menu } from 'lucide-react'
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

      {/* Mobile hamburger button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-40 lg:hidden bg-white rounded-xl shadow-sm border border-border p-2"
      >
        <Menu className="w-5 h-5 text-text-secondary" />
      </button>

      <main className="lg:ml-64 pb-20 lg:pb-0">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
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
            href="/dashboard/calendar"
            icon={CalendarDays}
            label={t('calendar')}
            active={pathname === '/dashboard/calendar'}
          />
          <BottomTabItem
            href="/dashboard/inbox"
            icon={Mail}
            label={t('inbox')}
            active={pathname === '/dashboard/inbox' || pathname.startsWith('/dashboard/inbox/')}
          />
          <BottomTabItem
            href="/dashboard/tasks"
            icon={CheckSquare}
            label={t('tasks')}
            active={pathname === '/dashboard/tasks'}
          />
        </div>
      </div>

      {/* Background sync engine */}
      <SyncManager />

      {/* Floating AI Chat */}
      <ChatPanel />

      {/* Sophia Floating Action Button */}
      <button
        onClick={openChat}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center text-white transition-all hover:scale-105"
        aria-label="Ask Sophia"
      >
        <MessageCircle className="w-5 h-5" />
      </button>
    </div>
  )
}
