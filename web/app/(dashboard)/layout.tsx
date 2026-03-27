'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { ChatPanel } from '@/components/dashboard/ChatPanel'
import { SyncManager } from '@/components/dashboard/SyncManager'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-surface-secondary">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 bg-white rounded-xl border border-border flex items-center justify-center shadow-sm"
      >
        <Menu className="w-5 h-5 text-text-secondary" />
      </button>

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

      <main className="lg:ml-64">
        {children}
      </main>

      {/* Background sync engine */}
      <SyncManager />

      {/* Floating AI Chat */}
      <ChatPanel />
    </div>
  )
}
