'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, AlertTriangle, Sparkles } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

type StepStatus = 'pending' | 'running' | 'done' | 'warning'

interface OnboardingStep {
  id: string
  labelKey: string
  doneKey?: string
  status: StepStatus
  result?: string
}

interface OnboardingProgressProps {
  timezone: string
  language: string
  onComplete: () => void
}

export function OnboardingProgress({ timezone, language, onComplete }: OnboardingProgressProps) {
  const { t } = useI18n()
  const [steps, setSteps] = useState<OnboardingStep[]>([
    { id: 'connected', labelKey: 'onboardingConnected', status: 'done' },
    { id: 'sync', labelKey: 'onboardingSyncing', doneKey: 'onboardingSynced', status: 'pending' },
    { id: 'process', labelKey: 'onboardingAnalyzing', doneKey: 'onboardingTasks', status: 'pending' },
    { id: 'trips', labelKey: 'onboardingTrips', doneKey: 'onboardingTripsFound', status: 'pending' },
    { id: 'contacts', labelKey: 'onboardingContacts', doneKey: 'onboardingContactsDone', status: 'pending' },
    { id: 'timezone', labelKey: 'onboardingTimezone', status: 'pending' },
    { id: 'ready', labelKey: 'onboardingReady', status: 'pending' },
  ])
  const [allDone, setAllDone] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const updateStep = useCallback((id: string, status: StepStatus, result?: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, result } : s))
  }, [])

  const completedCount = steps.filter(s => s.status === 'done' || s.status === 'warning').length
  const progressPercent = Math.round((completedCount / steps.length) * 100)

  useEffect(() => {
    let cancelled = false

    async function runOnboarding() {
      // Step: timezone (instant)
      updateStep('timezone', 'running')
      await new Promise(r => setTimeout(r, 400))
      if (cancelled) return
      updateStep('timezone', 'done', timezone)

      // Step: sync
      updateStep('sync', 'running')
      try {
        const res = await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timezone, language }),
        })

        if (!res.ok) throw new Error('Onboarding API failed')

        const data = await res.json()
        if (cancelled) return

        // Update sync step
        const emailsSynced = data.results?.sync?.emails_synced ?? 0
        updateStep('sync', 'done', String(emailsSynced))

        // Update process step
        const processed = data.results?.process?.processed ?? 0
        const remaining = data.results?.process?.remaining ?? 0
        if (data.results?.process?.error) {
          updateStep('process', 'warning')
        } else {
          updateStep('process', 'done', JSON.stringify({
            tasks: processed,
            followups: remaining,
          }))
        }

        // Update trips step
        const tripsFound = data.results?.trips?.trips_found ?? 0
        if (data.results?.trips?.error) {
          updateStep('trips', 'warning')
        } else {
          updateStep('trips', 'done', String(tripsFound))
        }

        // Update contacts step
        const contactsProcessed = data.results?.contacts?.contacts_processed ?? 0
        const newContacts = data.results?.contacts?.new_contacts ?? 0
        if (data.results?.contacts?.error) {
          updateStep('contacts', 'warning')
        } else {
          updateStep('contacts', 'done', String(contactsProcessed + newContacts))
        }

        // Final step
        await new Promise(r => setTimeout(r, 300))
        if (cancelled) return
        updateStep('ready', 'done')
        setAllDone(true)
      } catch (err) {
        console.error('Onboarding failed:', err)
        // Mark remaining pending steps as warnings
        setSteps(prev => prev.map(s =>
          s.status === 'pending' || s.status === 'running'
            ? { ...s, status: 'warning' }
            : s
        ))
        updateStep('ready', 'done')
        setAllDone(true)
      }
    }

    runOnboarding()
    return () => { cancelled = true }
  }, [timezone, language, updateStep])

  // Auto-dismiss after 2 seconds of completion
  useEffect(() => {
    if (!allDone) return
    const timer = setTimeout(() => {
      setDismissed(true)
      onComplete()
    }, 2000)
    return () => clearTimeout(timer)
  }, [allDone, onComplete])

  const handleDismiss = () => {
    setDismissed(true)
    onComplete()
  }

  if (dismissed) return null

  function renderStepLabel(step: OnboardingStep): string {
    if (step.status === 'done' && step.id === 'sync' && step.result) {
      return t('onboardingSynced' as any, { n: step.result })
    }
    if (step.status === 'done' && step.id === 'process' && step.result) {
      try {
        const parsed = JSON.parse(step.result)
        return t('onboardingTasks' as any, { tasks: parsed.tasks, followups: parsed.followups })
      } catch {
        return t(step.doneKey as any || step.labelKey as any)
      }
    }
    if (step.status === 'done' && step.id === 'trips' && step.result) {
      return t('onboardingTripsFound' as any, { n: step.result })
    }
    if (step.status === 'done' && step.id === 'contacts' && step.result) {
      return t('onboardingContactsDone' as any, { n: step.result })
    }
    if (step.status === 'done' && step.id === 'timezone' && step.result) {
      return t('onboardingTimezoneSet' as any, { tz: step.result })
    }
    return t(step.labelKey as any)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200"
            >
              <Sparkles className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-xl font-bold text-text-primary">
              {t('onboardingTitle' as any)}
            </h1>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-gray-100 rounded-full mb-8 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          {/* Steps */}
          <div className="space-y-3 mb-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08, duration: 0.3 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-100 shadow-sm"
              >
                {/* Status icon */}
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  {step.status === 'done' ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                      className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    </motion.div>
                  ) : step.status === 'running' ? (
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                  ) : step.status === 'warning' ? (
                    <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 bg-gray-100 rounded-full" />
                  )}
                </div>

                {/* Label */}
                <span className={`text-sm font-medium flex-1 ${
                  step.status === 'done' ? 'text-text-primary' :
                  step.status === 'running' ? 'text-indigo-600' :
                  step.status === 'warning' ? 'text-amber-600' :
                  'text-text-tertiary'
                }`}>
                  {renderStepLabel(step)}
                </span>
              </motion.div>
            ))}
          </div>

          {/* CTA button */}
          <AnimatePresence>
            {allDone && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <button
                  onClick={handleDismiss}
                  className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
                >
                  {t('onboardingGo' as any)}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
