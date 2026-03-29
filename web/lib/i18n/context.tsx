'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Locale, TranslationKey, t as translate } from './translations'

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chief-locale') as Locale
      if (saved && ['en', 'zh', 'ms'].includes(saved)) return saved
    }
    return 'en'
  })

  useEffect(() => {
    const saved = localStorage.getItem('chief-locale') as Locale
    if (saved && ['en', 'zh', 'ms'].includes(saved) && saved !== locale) {
      setLocaleState(saved)
    }
  }, [])

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    localStorage.setItem('chief-locale', l)
  }

  const t = (key: TranslationKey, params?: Record<string, string | number>) =>
    translate(locale, key, params)

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
