'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ChevronDown, Mail } from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const { t } = useI18n()
  const [showOtherEmail, setShowOtherEmail] = useState(false)

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/login'
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-2xl text-text-primary">Chief</span>
        </Link>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-center mb-2">{t('welcomeBack')}</h1>
          <p className="text-sm text-text-secondary text-center mb-8">
            {t('signInSubtitle')}
          </p>

          {/* Google - primary */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-border rounded-xl hover:bg-surface-secondary transition-all duration-200 font-medium text-sm group"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="group-hover:translate-x-0.5 transition-transform duration-200">
              {t('continueWithGoogle')}
            </span>
          </button>

          {/* Microsoft */}
          <a
            href="/api/accounts/add-outlook"
            className="mt-3 w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-[#0078D4] rounded-xl hover:bg-[#0078D4]/5 transition-all duration-200 font-medium text-sm group"
          >
            <svg className="w-5 h-5" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z"/>
              <path fill="#81bc06" d="M12 1h10v10H12z"/>
              <path fill="#05a6f0" d="M1 12h10v10H1z"/>
              <path fill="#ffba08" d="M12 12h10v10H12z"/>
            </svg>
            <span className="group-hover:translate-x-0.5 transition-transform duration-200 text-[#0078D4]">
              {t('continueWithMicrosoft')}
            </span>
          </a>

          {/* Other email providers */}
          <button
            onClick={() => setShowOtherEmail(!showOtherEmail)}
            className="mt-4 w-full flex items-center justify-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          >
            其他邮箱
            <ChevronDown className={cn('w-3 h-3 transition-transform', showOtherEmail && 'rotate-180')} />
          </button>

          {showOtherEmail && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 space-y-2"
            >
              {[
                { name: 'QQ 邮箱', href: '/api/accounts/add-imap?provider=qq' },
                { name: '163 / 126 邮箱', href: '/api/accounts/add-imap?provider=163' },
                { name: 'Yahoo Mail', href: '/api/accounts/add-imap?provider=yahoo' },
                { name: 'iCloud 邮箱', href: '/api/accounts/add-imap?provider=icloud' },
              ].map((provider) => (
                <a
                  key={provider.name}
                  href={provider.href}
                  className="w-full flex items-center gap-3 px-4 py-2.5 border border-border rounded-lg hover:bg-surface-secondary transition-colors text-sm text-text-secondary"
                >
                  <Mail className="w-4 h-4 text-text-tertiary" />
                  {provider.name}
                </a>
              ))}
              <a
                href="/api/accounts/add-imap"
                className="w-full flex items-center gap-3 px-4 py-2.5 border border-dashed border-border rounded-lg hover:bg-surface-secondary transition-colors text-sm text-text-tertiary"
              >
                <Mail className="w-4 h-4" />
                其他邮箱（输入邮箱地址）
              </a>
            </motion.div>
          )}

          <p className="mt-5 text-xs text-text-tertiary text-center leading-relaxed">
            {t('loginDisclaimer')}
          </p>
        </div>
      </motion.div>
    </div>
  )
}
