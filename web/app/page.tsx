'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Target, Plane, Heart, Sparkles, Shield, Zap, Mail } from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
}

export default function LandingPage() {
  const { t } = useI18n()
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-text-primary">Chief</span>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher compact />
          <Link
            href="/login"
            className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-hover transition-all duration-200 shadow-sm hover:shadow-md"
          >
            {t('getStarted')}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-16 text-center">
        <motion.div {...fadeUp} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-light rounded-full text-primary text-sm font-medium mb-4 sm:mb-6">
            <Sparkles className="w-4 h-4" />
            {t('aiPoweredProductivity')}
          </div>
        </motion.div>

        <motion.h1
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-3xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-tight mb-4 sm:mb-6"
        >
          {t('heroTitle1')}
          <span className="text-primary"> {t('heroTitle2')}</span>
        </motion.h1>

        <motion.p
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto mb-6 sm:mb-10 leading-relaxed px-2"
        >
          {t('heroSubtitle')}
        </motion.p>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.3 }}>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-semibold text-lg hover:bg-primary-hover transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            {t('connectGmail')}
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="mt-4 text-sm text-text-tertiary">{t('freeToStart')}</p>
        </motion.div>

        {/* Product screenshot mock */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-16 max-w-3xl mx-auto"
        >
          <div className="rounded-2xl border-2 border-transparent bg-gradient-to-br from-primary/20 via-primary/5 to-indigo-100 p-[2px]">
            <div className="bg-white rounded-[14px] overflow-hidden shadow-xl">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-border">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-white rounded-md px-3 py-1 text-xs text-text-tertiary border border-border text-center">
                    app.chiefai.com/dashboard
                  </div>
                </div>
              </div>
              {/* Dashboard mock */}
              <div className="flex min-h-[280px]">
                {/* Sidebar */}
                <div className="w-48 bg-gray-50/80 border-r border-border p-4 hidden sm:block">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="font-semibold text-sm text-text-primary">Chief</span>
                  </div>
                  {[t('commitmentsNav'), t('inbox'), t('calendar'), t('familyNav')].map((item, i) => (
                    <div key={item} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs mb-1 ${i === 0 ? 'bg-primary/10 text-primary font-medium' : 'text-text-secondary'}`}>
                      <div className={`w-3.5 h-3.5 rounded ${i === 0 ? 'bg-primary/20' : 'bg-gray-200'}`} />
                      {item}
                    </div>
                  ))}
                </div>
                {/* Main content */}
                <div className="flex-1 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm font-semibold text-text-primary">{t('goodMorning')}</div>
                      <div className="text-xs text-text-tertiary">{t('mockSummary', { tasks: 3, emails: 5, meetings: 2 })}</div>
                    </div>
                    <div className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-lg">{t('syncNow')}</div>
                  </div>
                  {/* Stat cards */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: t('needsYourAction'), value: '3', color: 'text-blue-600' },
                      { label: t('waitingOnThem'), value: '5', color: 'text-amber-600' },
                      { label: t('complianceRate'), value: '92%', color: 'text-emerald-600' },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-gray-50 rounded-xl p-3">
                        <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                        <div className="text-[10px] text-text-tertiary">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Commitment rows */}
                  <div className="space-y-2">
                    {[t('heroMockTask1'), t('heroMockTask2'), t('heroMockTask3')].map((task, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-red-400' : i === 1 ? 'bg-orange-400' : 'bg-pink-400'}`} />
                        <span className="text-xs text-text-primary">{task}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Target className="w-6 h-6" />,
              title: t('commitmentTracking'),
              desc: t('commitmentTrackingDesc'),
              color: 'bg-blue-50 text-blue-600',
            },
            {
              icon: <Plane className="w-6 h-6" />,
              title: t('citySwitching'),
              desc: t('citySwitchingDesc'),
              color: 'bg-sky-50 text-sky-600',
            },
            {
              icon: <Heart className="w-6 h-6" />,
              title: t('familyGuard'),
              desc: t('familyGuardDesc'),
              color: 'bg-pink-50 text-pink-600',
            },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
              className="p-6 rounded-2xl bg-white border border-border hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-4`}>
                {feature.icon}
              </div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <div className="flex flex-wrap justify-center gap-8 text-sm text-text-tertiary">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            {t('gdprCompliant')}
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            {t('realTimeSync')}
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            {t('gmailCalendar')}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-text-tertiary">
        <p>{t('footerText', { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  )
}
