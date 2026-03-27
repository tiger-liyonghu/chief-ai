'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Mail, Calendar, CheckSquare, Sparkles, Shield, Zap } from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
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
        <Link
          href="/login"
          className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-hover transition-all duration-200 shadow-sm hover:shadow-md"
        >
          {t('getStarted')}
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <motion.div {...fadeUp} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-light rounded-full text-primary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            {t('aiPoweredProductivity')}
          </div>
        </motion.div>

        <motion.h1
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-6xl font-bold text-text-primary leading-tight mb-6"
        >
          {t('heroTitle1')}
          <span className="text-primary"> {t('heroTitle2')}</span>
        </motion.h1>

        <motion.p
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed"
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
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <CheckSquare className="w-6 h-6" />,
              title: t('smartTaskExtraction'),
              desc: t('smartTaskExtractionDesc'),
              color: 'bg-emerald-50 text-emerald-600',
            },
            {
              icon: <Mail className="w-6 h-6" />,
              title: t('aiReplyAssistant'),
              desc: t('aiReplyAssistantDesc'),
              color: 'bg-blue-50 text-blue-600',
            },
            {
              icon: <Calendar className="w-6 h-6" />,
              title: t('meetingPrep'),
              desc: t('meetingPrepDesc'),
              color: 'bg-amber-50 text-amber-600',
            },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
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
