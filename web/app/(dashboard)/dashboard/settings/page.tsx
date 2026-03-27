'use client'

import { TopBar } from '@/components/layout/TopBar'
import { Globe, Clock, Shield, Trash2, Download, Send, Check, Plus, X, Mail, User, MessageCircle, Loader2, Bot, Eye, EyeOff, Zap, CheckCircle2, AlertCircle } from 'lucide-react'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'

interface Settings {
  timezone: string
  daily_brief_time: string
  gdpr_data_retention_days: number
  writing_style_notes: string | null
}

interface GoogleAccount {
  id: string
  google_email: string
  google_name: string | null
  google_avatar: string | null
  is_primary: boolean
  created_at: string
}

function SettingsContent() {
  const searchParams = useSearchParams()
  const [settings, setSettings] = useState<Settings>({
    timezone: 'Asia/Singapore',
    daily_brief_time: '08:00',
    gdpr_data_retention_days: 90,
    writing_style_notes: '',
  })
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [digestSending, setDigestSending] = useState(false)
  const [digestEnabled, setDigestEnabled] = useState(true)
  const [digestSendResult, setDigestSendResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [digestLastSent, setDigestLastSent] = useState<string | null>(null)
  const [digestScheduleLoading, setDigestScheduleLoading] = useState(true)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const fadeRef = useRef<NodeJS.Timeout | null>(null)

  // Connected accounts state
  const [accounts, setAccounts] = useState<GoogleAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [accountMessage, setAccountMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // WhatsApp state
  const { t } = useI18n()
  const [waConnection, setWaConnection] = useState<any>(null)
  const [waMessageCount, setWaMessageCount] = useState(0)
  const [waLoading, setWaLoading] = useState(true)
  const [waConnecting, setWaConnecting] = useState(false)
  const [waDisconnecting, setWaDisconnecting] = useState(false)
  const [waQrDataUrl, setWaQrDataUrl] = useState<string | null>(null)
  const [waPairingCode, setWaPairingCode] = useState<string | null>(null)
  const [waPhoneInput, setWaPhoneInput] = useState('')
  const [waMethod, setWaMethod] = useState<'qr' | 'phone'>('phone')
  const [waError, setWaError] = useState<string | null>(null)
  const [waAiEnabled, setWaAiEnabled] = useState(false)
  const [waAiToggling, setWaAiToggling] = useState(false)
  const waQrPollRef = useRef<NodeJS.Timeout | null>(null)

  // LLM config state
  const [llmProvider, setLlmProvider] = useState('deepseek')
  const [llmModel, setLlmModel] = useState('')
  const [llmApiKey, setLlmApiKey] = useState('')
  const [llmBaseUrl, setLlmBaseUrl] = useState('')
  const [llmHasCustomKey, setLlmHasCustomKey] = useState(false)
  const [llmShowKey, setLlmShowKey] = useState(false)
  const [llmLoading, setLlmLoading] = useState(true)
  const [llmTesting, setLlmTesting] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [llmProviders, setLlmProviders] = useState<Record<string, { baseURL: string; models: string[]; defaultModel: string }>>({})
  const llmDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Check for success/error messages from OAuth callback
  useEffect(() => {
    const added = searchParams.get('account_added')
    const updated = searchParams.get('account_updated')
    const error = searchParams.get('error')

    if (added) {
      setAccountMessage({ type: 'success', text: `Connected ${added}` })
    } else if (updated) {
      setAccountMessage({ type: 'success', text: `Re-authorized ${updated}` })
    } else if (error === 'add_failed') {
      setAccountMessage({ type: 'error', text: 'Failed to add account. Please try again.' })
    }

    if (added || updated || error) {
      // Clean URL params
      const url = new URL(window.location.href)
      url.searchParams.delete('account_added')
      url.searchParams.delete('account_updated')
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.toString())

      // Auto-dismiss message
      const timer = setTimeout(() => setAccountMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  // Fetch connected accounts
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch('/api/accounts')
        if (res.ok) {
          const data = await res.json()
          setAccounts(data)
        }
      } catch {
        // Silently fail
      } finally {
        setAccountsLoading(false)
      }
    }
    fetchAccounts()
  }, [])

  // Fetch WhatsApp connection status
  useEffect(() => {
    async function fetchWhatsApp() {
      try {
        const res = await fetch('/api/whatsapp')
        if (res.ok) {
          const data = await res.json()
          setWaConnection(data.connection)
          setWaMessageCount(data.messageCount)
          setWaAiEnabled(data.aiEnabled || false)
        }
      } catch {
        // Silently fail
      } finally {
        setWaLoading(false)
      }
    }
    fetchWhatsApp()
  }, [])

  // Fetch LLM config
  useEffect(() => {
    async function fetchLLMConfig() {
      try {
        const res = await fetch('/api/settings/llm')
        if (res.ok) {
          const data = await res.json()
          setLlmProvider(data.provider || 'deepseek')
          setLlmModel(data.model || '')
          setLlmBaseUrl(data.base_url || '')
          setLlmHasCustomKey(data.has_custom_key || false)
          if (data.providers) setLlmProviders(data.providers)
        }
      } catch {
        // Silently fail
      } finally {
        setLlmLoading(false)
      }
    }
    fetchLLMConfig()
  }, [])

  const saveLLMConfig = useCallback(async (updates: Record<string, string | null>) => {
    if (llmDebounceRef.current) clearTimeout(llmDebounceRef.current)
    llmDebounceRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        const res = await fetch('/api/settings/llm', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        if (res.ok) {
          setSaveStatus('saved')
          if (fadeRef.current) clearTimeout(fadeRef.current)
          fadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
        } else {
          setSaveStatus('error')
          fadeRef.current = setTimeout(() => setSaveStatus('idle'), 3000)
        }
      } catch {
        setSaveStatus('error')
        fadeRef.current = setTimeout(() => setSaveStatus('idle'), 3000)
      }
    }, 600)
  }, [])

  const testLLMConnection = async () => {
    setLlmTesting(true)
    setLlmTestResult(null)
    try {
      const res = await fetch('/api/settings/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      })
      const data = await res.json()
      setLlmTestResult({
        ok: data.ok,
        message: data.ok ? `${t('connectionOk')}${data.response ? ` — ${data.response}` : ''}` : `${t('connectionFailed')}: ${data.error}`,
      })
    } catch {
      setLlmTestResult({ ok: false, message: t('connectionFailed') })
    } finally {
      setLlmTesting(false)
    }
  }

  const handleProviderChange = (provider: string) => {
    setLlmProvider(provider)
    const defaults = llmProviders[provider]
    if (defaults) {
      setLlmModel(defaults.defaultModel)
      setLlmBaseUrl(defaults.baseURL)
    }
    setLlmTestResult(null)
    saveLLMConfig({ provider })
  }

  const handleModelChange = (model: string) => {
    setLlmModel(model)
    setLlmTestResult(null)
    saveLLMConfig({ model })
  }

  const handleApiKeyBlur = () => {
    if (llmApiKey) {
      saveLLMConfig({ api_key: llmApiKey })
      setLlmHasCustomKey(true)
      setLlmApiKey('')
    }
  }

  const clearApiKey = () => {
    saveLLMConfig({ api_key: '' })
    setLlmHasCustomKey(false)
    setLlmApiKey('')
  }

  const handleBaseUrlChange = (url: string) => {
    setLlmBaseUrl(url)
    setLlmTestResult(null)
    saveLLMConfig({ base_url: url })
  }

  const connectWhatsApp = async (phoneNumber?: string) => {
    setWaConnecting(true)
    setWaError(null)
    setWaQrDataUrl(null)
    setWaPairingCode(null)
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          ...(phoneNumber ? { phone_number: phoneNumber } : {}),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.connected) {
          setWaConnection({ status: 'active', phone_number: data.phoneNumber })
          setWaQrDataUrl(null)
          setWaPairingCode(null)
        } else if (data.pairing_code) {
          // Phone number pairing code flow
          setWaPairingCode(data.pairing_code)
          startQrPolling()
        } else if (data.qr_data_url) {
          setWaQrDataUrl(data.qr_data_url)
          startQrPolling()
        } else {
          setWaError('Failed to connect. Please try again.')
        }
      } else {
        setWaError(data.error || 'Failed to connect')
      }
    } catch {
      setWaError('Network error. Please try again.')
    } finally {
      setWaConnecting(false)
    }
  }

  const startQrPolling = () => {
    // Clear any existing poll
    if (waQrPollRef.current) clearInterval(waQrPollRef.current)

    waQrPollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/whatsapp')
        if (res.ok) {
          const data = await res.json()
          if (data.connected) {
            // QR scanned successfully
            setWaQrDataUrl(null)
            setWaConnection({ status: 'active', phone_number: data.phoneNumber })
            setWaMessageCount(data.messageCount || 0)
            if (waQrPollRef.current) clearInterval(waQrPollRef.current)
          }
        }
      } catch {
        // Silently fail — next poll will retry
      }
    }, 3000)
  }

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (waQrPollRef.current) clearInterval(waQrPollRef.current)
    }
  }, [])

  const disconnectWhatsApp = async () => {
    if (!confirm('Disconnect WhatsApp? Messages already synced will be kept.')) return
    setWaDisconnecting(true)
    try {
      const res = await fetch('/api/whatsapp', { method: 'DELETE' })
      if (res.ok) {
        setWaConnection(null)
        setWaQrDataUrl(null)
        setWaAiEnabled(false)
        if (waQrPollRef.current) clearInterval(waQrPollRef.current)
      }
    } catch {
      // Silently fail
    } finally {
      setWaDisconnecting(false)
    }
  }

  const toggleWaAi = async () => {
    const newValue = !waAiEnabled
    setWaAiToggling(true)
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_enabled: newValue }),
      })
      if (res.ok) {
        setWaAiEnabled(newValue)
      }
    } catch {
      // Silently fail
    } finally {
      setWaAiToggling(false)
    }
  }

  // Fetch settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          setSettings({
            timezone: data.timezone || 'Asia/Singapore',
            daily_brief_time: data.daily_brief_time?.slice(0, 5) || '08:00',
            gdpr_data_retention_days: data.gdpr_data_retention_days || 90,
            writing_style_notes: data.writing_style_notes || '',
          })
        }
      } catch {
        // Use defaults on error
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  // Debounced save
  const persistSettings = useCallback(async (updates: Partial<Settings>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (fadeRef.current) clearTimeout(fadeRef.current)

    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        const res = await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        if (res.ok) {
          setSaveStatus('saved')
          fadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
        } else {
          setSaveStatus('error')
          fadeRef.current = setTimeout(() => setSaveStatus('idle'), 3000)
        }
      } catch {
        setSaveStatus('error')
        fadeRef.current = setTimeout(() => setSaveStatus('idle'), 3000)
      }
    }, 600)
  }, [])

  const updateField = <K extends keyof Settings>(field: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
    persistSettings({ [field]: value })
  }

  // Fetch digest schedule state
  useEffect(() => {
    async function fetchDigestSchedule() {
      try {
        const res = await fetch('/api/digest/schedule')
        if (res.ok) {
          const data = await res.json()
          setDigestEnabled(data.enabled ?? false)
        }
      } catch {
        // Use defaults on error
      } finally {
        setDigestScheduleLoading(false)
      }
    }
    fetchDigestSchedule()
  }, [])

  const toggleDigest = async (enabled: boolean) => {
    setDigestEnabled(enabled)
    try {
      await fetch('/api/digest/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
    } catch {
      setDigestEnabled(!enabled) // revert on failure
    }
  }

  const sendDigestNow = async () => {
    setDigestSending(true)
    setDigestSendResult(null)
    try {
      const res = await fetch('/api/digest', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setDigestSendResult({ ok: true, message: `Digest sent to ${data.sent_to}` })
        setDigestLastSent(new Date().toLocaleString())
      } else {
        const data = await res.json()
        setDigestSendResult({ ok: false, message: data.error || 'Failed to send digest' })
      }
    } catch {
      setDigestSendResult({ ok: false, message: 'Network error. Please try again.' })
    } finally {
      setDigestSending(false)
      setTimeout(() => setDigestSendResult(null), 5000)
    }
  }

  const removeAccount = async (accountId: string) => {
    if (!confirm('Remove this Google account? Emails already synced will be kept.')) return

    setRemovingId(accountId)
    try {
      const res = await fetch('/api/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
      const data = await res.json()
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== accountId))
        setAccountMessage({ type: 'success', text: `Removed ${data.removed}` })
        setTimeout(() => setAccountMessage(null), 3000)
      } else {
        setAccountMessage({ type: 'error', text: data.error || 'Failed to remove account' })
        setTimeout(() => setAccountMessage(null), 5000)
      }
    } catch {
      setAccountMessage({ type: 'error', text: 'Network error. Please try again.' })
      setTimeout(() => setAccountMessage(null), 5000)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div>
      <TopBar title="Settings" />

      <div className="p-8 max-w-2xl">
        {/* Save indicator */}
        <div className="h-6 mb-2">
          {saveStatus === 'saving' && (
            <p className="text-xs text-text-tertiary animate-pulse">Saving...</p>
          )}
          {saveStatus === 'saved' && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> Saved
            </p>
          )}
          {saveStatus === 'error' && (
            <p className="text-xs text-danger">Failed to save. Try again.</p>
          )}
        </div>

        <div className="space-y-8">
          {/* Connected Accounts Section */}
          <section>
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Connected Accounts</h2>

            {/* Account message */}
            {accountMessage && (
              <div className={`mb-4 px-4 py-3 rounded-xl text-sm flex items-center justify-between ${
                accountMessage.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                <span>{accountMessage.text}</span>
                <button onClick={() => setAccountMessage(null)} className="ml-2 opacity-60 hover:opacity-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-border divide-y divide-border">
              {accountsLoading ? (
                <div className="p-5 text-sm text-text-tertiary animate-pulse">Loading accounts...</div>
              ) : accounts.length === 0 ? (
                <div className="p-5 text-sm text-text-tertiary">
                  No email accounts connected. Add Gmail or Outlook to start syncing.
                </div>
              ) : (
                accounts.map((account) => (
                  <div key={account.id} className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {account.google_avatar ? (
                        <img
                          src={account.google_avatar}
                          alt=""
                          className="w-9 h-9 rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-surface-secondary flex items-center justify-center">
                          <User className="w-4 h-4 text-text-tertiary" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {account.google_name || account.google_email}
                          </p>
                          {account.is_primary && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              Primary
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-tertiary flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {account.google_email}
                        </p>
                      </div>
                    </div>
                    {!account.is_primary && (
                      <button
                        onClick={() => removeAccount(account.id)}
                        disabled={removingId === account.id}
                        className="text-xs font-medium text-text-tertiary hover:text-danger transition-colors disabled:opacity-50"
                      >
                        {removingId === account.id ? 'Removing...' : 'Remove'}
                      </button>
                    )}
                  </div>
                ))
              )}

              {/* Add Account buttons */}
              <div className="p-5 flex items-center gap-6">
                <a
                  href="/api/accounts/add"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Gmail
                </a>
                <a
                  href="/api/accounts/add-outlook"
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Outlook
                </a>
              </div>
            </div>
          </section>

          {/* WhatsApp Integration Section */}
          <section>
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">{t('whatsappIntegration')}</h2>
            <div className="bg-white rounded-2xl border border-border divide-y divide-border">
              {waLoading ? (
                <div className="p-5 text-sm text-text-tertiary animate-pulse">Loading...</div>
              ) : waConnection && waConnection.status === 'active' ? (
                /* ── Connected state ── */
                <>
                  <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                        <MessageCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{waConnection.phone_number}</p>
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            {t('whatsappConnected')}
                          </span>
                        </div>
                        <p className="text-xs text-text-tertiary">{t('waMessages', { n: waMessageCount })}</p>
                      </div>
                    </div>
                    <button
                      onClick={disconnectWhatsApp}
                      disabled={waDisconnecting}
                      className="text-xs font-medium text-text-tertiary hover:text-danger transition-colors disabled:opacity-50"
                    >
                      {waDisconnecting ? 'Disconnecting...' : t('disconnectWhatsApp')}
                    </button>
                  </div>
                  {/* AI Auto-Reply toggle */}
                  <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t('waAiAutoReply')}</p>
                        <p className="text-xs text-text-tertiary">{t('waAiAutoReplyDesc')}</p>
                      </div>
                    </div>
                    <button
                      onClick={toggleWaAi}
                      disabled={waAiToggling}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        waAiEnabled ? 'bg-primary' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          waAiEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </>
              ) : (
                /* ── Not connected / QR scanning state ── */
                <div className="p-5">
                  {!waQrDataUrl && !waPairingCode ? (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-gray-50 text-text-tertiary rounded-xl flex items-center justify-center">
                          <MessageCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{t('whatsappDisconnected')}</p>
                          <p className="text-xs text-text-tertiary">{t('whatsappDesc')}</p>
                        </div>
                      </div>

                      {waError && (
                        <div className="mb-4 px-4 py-2 bg-red-50 text-red-700 rounded-xl text-xs border border-red-200">{waError}</div>
                      )}

                      {/* Method toggle */}
                      <div className="flex items-center gap-1 bg-surface-secondary rounded-xl p-1 mb-4 w-fit">
                        <button
                          onClick={() => setWaMethod('qr')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${waMethod === 'qr' ? 'bg-white text-primary shadow-sm' : 'text-text-tertiary'}`}
                        >
                          QR Code
                        </button>
                        <button
                          onClick={() => setWaMethod('phone')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${waMethod === 'phone' ? 'bg-white text-primary shadow-sm' : 'text-text-tertiary'}`}
                        >
                          Phone Number
                        </button>
                      </div>

                      {waMethod === 'phone' && (
                        <div className="flex items-center gap-2 mb-4">
                          <input
                            type="tel"
                            value={waPhoneInput}
                            onChange={(e) => setWaPhoneInput(e.target.value)}
                            placeholder="+65 9123 4567"
                            className="flex-1 px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      )}

                      <button
                        onClick={() => waMethod === 'phone' && waPhoneInput.trim()
                          ? connectWhatsApp(waPhoneInput.trim())
                          : connectWhatsApp()
                        }
                        disabled={waConnecting || (waMethod === 'phone' && !waPhoneInput.trim())}
                        className="text-sm font-medium text-primary bg-primary/10 px-4 py-2 rounded-xl hover:bg-primary/20 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        {waConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {waConnecting ? 'Connecting...' : t('connectWhatsApp')}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col items-center text-center">
                        {waPairingCode ? (
                          <>
                            {/* Pairing Code display */}
                            <p className="text-sm font-medium mb-1">Enter this code on your phone</p>
                            <p className="text-xs text-text-tertiary mb-4">Open WhatsApp → Settings → Linked Devices → Link a Device → Link with phone number</p>
                            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm mb-4">
                              <p className="text-4xl font-mono font-bold tracking-[0.3em] text-primary">{waPairingCode}</p>
                            </div>
                          </>
                        ) : waQrDataUrl ? (
                          <>
                            {/* QR Code display */}
                            <p className="text-sm font-medium mb-1">{t('waScanQr')}</p>
                            <p className="text-xs text-text-tertiary mb-4">{t('waScanInstructions')}</p>
                            <div className="bg-white p-3 rounded-2xl border border-border shadow-sm mb-4">
                              <img
                                src={waQrDataUrl}
                                alt="WhatsApp QR Code"
                                className="w-[280px] h-[280px]"
                              />
                            </div>
                          </>
                        ) : null}

                        <div className="bg-surface-secondary rounded-xl p-4 text-left w-full max-w-sm">
                          <p className="text-xs font-semibold text-text-secondary mb-2">{t('whatsappSetupGuide')}</p>
                          <div className="text-xs text-text-tertiary space-y-1">
                            <p>{t('waStep1')}</p>
                            <p>{t('waStep2')}</p>
                            <p>{t('waStep3')}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-4 text-xs text-text-tertiary">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>{t('waWaitingScan')}</span>
                        </div>

                        <button
                          onClick={() => { setWaQrDataUrl(null); setWaError(null); if (waQrPollRef.current) clearInterval(waQrPollRef.current) }}
                          className="mt-3 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Preferences Section */}
          <section>
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Preferences</h2>
            <div className="bg-white rounded-2xl border border-border divide-y divide-border">
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-text-tertiary" />
                  <div>
                    <p className="text-sm font-medium">Timezone</p>
                    <p className="text-xs text-text-tertiary">For daily brief scheduling</p>
                  </div>
                </div>
                <select
                  value={settings.timezone}
                  onChange={(e) => updateField('timezone', e.target.value)}
                  disabled={loading}
                  className="text-sm bg-surface-secondary border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                >
                  <option value="Asia/Singapore">Singapore (GMT+8)</option>
                  <option value="Asia/Kolkata">India (GMT+5:30)</option>
                  <option value="America/New_York">US Eastern (GMT-5)</option>
                  <option value="America/Los_Angeles">US Pacific (GMT-8)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Berlin">Berlin (GMT+1)</option>
                </select>
              </div>

              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-text-tertiary" />
                  <div>
                    <p className="text-sm font-medium">Daily Brief Time</p>
                    <p className="text-xs text-text-tertiary">When to compile your daily brief</p>
                  </div>
                </div>
                <input
                  type="time"
                  value={settings.daily_brief_time}
                  onChange={(e) => updateField('daily_brief_time', e.target.value)}
                  disabled={loading}
                  className="text-sm bg-surface-secondary border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                />
              </div>

              {/* Writing Style Notes */}
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-5 h-5 flex items-center justify-center text-text-tertiary text-xs font-bold">Aa</div>
                  <div>
                    <p className="text-sm font-medium">Writing Style Notes</p>
                    <p className="text-xs text-text-tertiary">Tone and style preferences for AI-drafted replies</p>
                  </div>
                </div>
                <textarea
                  value={settings.writing_style_notes || ''}
                  onChange={(e) => updateField('writing_style_notes', e.target.value)}
                  disabled={loading}
                  placeholder="e.g., Keep it concise and friendly. Use bullet points for action items. Sign off with 'Best, Tiger'."
                  rows={3}
                  className="w-full text-sm bg-surface-secondary border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 resize-none"
                />
              </div>
            </div>
          </section>

          {/* Digest Section */}
          <section>
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Daily Digest Email</h2>
            <div className="bg-white rounded-2xl border border-border divide-y divide-border">
              {/* Toggle */}
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-text-tertiary" />
                  <div>
                    <p className="text-sm font-medium">Daily Digest Email</p>
                    <p className="text-xs text-text-tertiary">
                      {digestEnabled
                        ? `AI-powered summary delivered to your inbox every day`
                        : 'Email digest is paused'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleDigest(!digestEnabled)}
                  disabled={digestScheduleLoading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                    digestEnabled ? 'bg-primary' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      digestEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Time picker */}
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-text-tertiary" />
                  <div>
                    <p className="text-sm font-medium">Delivery Time</p>
                    <p className="text-xs text-text-tertiary">When to send your daily digest email</p>
                  </div>
                </div>
                <input
                  type="time"
                  value={settings.daily_brief_time}
                  onChange={(e) => {
                    updateField('daily_brief_time', e.target.value)
                    // Also update digest schedule time
                    fetch('/api/digest/schedule', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ time: e.target.value }),
                    }).catch(() => {})
                  }}
                  disabled={loading || !digestEnabled}
                  className="text-sm bg-surface-secondary border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                />
              </div>

              {/* Send Test Digest */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Send className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="text-sm font-medium">Send Test Digest Now</p>
                      <p className="text-xs text-text-tertiary">Send yourself an immediate digest email to preview</p>
                    </div>
                  </div>
                  <button
                    onClick={sendDigestNow}
                    disabled={digestSending}
                    className="text-sm font-medium text-primary bg-primary/10 px-4 py-2 rounded-xl hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {digestSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    {digestSending ? 'Sending...' : 'Send Test'}
                  </button>
                </div>

                {/* Result message */}
                {digestSendResult && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
                    digestSendResult.ok
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {digestSendResult.ok ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    )}
                    {digestSendResult.message}
                  </div>
                )}

                {/* Last sent timestamp */}
                {digestLastSent && (
                  <p className="text-xs text-text-tertiary mt-2">
                    Last digest sent: {digestLastSent}
                  </p>
                )}
              </div>

              {/* Email Preview */}
              <div className="p-5">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Preview</p>
                <div className="border border-border rounded-xl overflow-hidden bg-surface-secondary">
                  {/* Mini email preview */}
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 text-white">
                    <p className="text-[10px] opacity-80 mb-1">Today</p>
                    <p className="text-xs font-semibold mb-2">Good morning</p>
                    <div className="space-y-1">
                      <div className="h-2 bg-white/20 rounded-full w-full" />
                      <div className="h-2 bg-white/20 rounded-full w-4/5" />
                      <div className="h-2 bg-white/20 rounded-full w-3/5" />
                    </div>
                  </div>
                  <div className="p-3 space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold text-text-secondary mb-1">Today&apos;s Meetings</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <div className="h-1.5 bg-border rounded-full w-32" />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <div className="h-1.5 bg-border rounded-full w-24" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-text-secondary mb-1">Priority Tasks</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-1.5 rounded-full bg-red-300" />
                          <div className="h-1.5 bg-border rounded-full w-28" />
                        </div>
                      </div>
                    </div>
                    <div className="text-center pt-2">
                      <div className="inline-block px-4 py-1 bg-primary/10 rounded-lg">
                        <p className="text-[9px] font-semibold text-primary">Open Chief Dashboard</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Privacy Section */}
          <section>
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Privacy & Data</h2>
            <div className="bg-white rounded-2xl border border-border divide-y divide-border">
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-text-tertiary" />
                  <div>
                    <p className="text-sm font-medium">Data Retention</p>
                    <p className="text-xs text-text-tertiary">How long we keep your processed data</p>
                  </div>
                </div>
                <select
                  value={settings.gdpr_data_retention_days}
                  onChange={(e) => updateField('gdpr_data_retention_days', Number(e.target.value))}
                  disabled={loading}
                  className="text-sm bg-surface-secondary border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                >
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>180 days</option>
                  <option value={365}>1 year</option>
                </select>
              </div>

              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5 text-text-tertiary" />
                  <div>
                    <p className="text-sm font-medium">Export Data</p>
                    <p className="text-xs text-text-tertiary">Download all your data (GDPR)</p>
                  </div>
                </div>
                <button className="text-sm font-medium text-primary hover:underline">
                  Export JSON
                </button>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section>
            <h2 className="text-sm font-semibold text-danger uppercase tracking-wider mb-4">Danger Zone</h2>
            <div className="bg-white rounded-2xl border border-red-200">
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trash2 className="w-5 h-5 text-danger" />
                  <div>
                    <p className="text-sm font-medium text-danger">Delete Account</p>
                    <p className="text-xs text-text-tertiary">Permanently delete your account and all data</p>
                  </div>
                </div>
                <button className="text-sm font-medium text-danger bg-red-50 px-4 py-1.5 rounded-lg hover:bg-red-100 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>}>
      <SettingsContent />
    </Suspense>
  )
}
