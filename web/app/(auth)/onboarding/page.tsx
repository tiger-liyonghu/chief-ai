'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Mail,
  MessageSquare,
  Bot,
  Plus,
  Check,
  ArrowRight,
  Shield,
  Target,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { CommitmentDiscovery } from '@/components/dashboard/CommitmentDiscovery'

/* ─── Step definitions ─── */

type Step = 'channels' | 'scanning' | 'ready'

/* ─── Channel Connection Card ─── */

function ChannelCard({ icon: Icon, name, description, connected, onConnect, disabled, badge }: {
  icon: typeof Mail
  name: string
  description: string
  connected: boolean
  onConnect: () => void
  disabled?: boolean
  badge?: string
}) {
  return (
    <div className={cn(
      'border rounded-xl p-4 transition-all',
      connected ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300',
      disabled && 'opacity-50 cursor-not-allowed'
    )}>
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', connected ? 'bg-emerald-100' : 'bg-slate-100')}>
          <Icon className={cn('w-5 h-5', connected ? 'text-emerald-600' : 'text-slate-600')} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{name}</span>
            {badge && <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full">{badge}</span>}
          </div>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        {connected ? (
          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald-600" />
          </div>
        ) : (
          <button
            onClick={onConnect}
            disabled={disabled}
            className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {disabled ? 'Coming soon' : 'Connect'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── AI Config Section ─── */

function AIConfig() {
  const [useOwn, setUseOwn] = useState(false)
  const [provider, setProvider] = useState('openai')
  const [apiKey, setApiKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null)

  const handleTest = async () => {
    if (!apiKey.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: apiKey.trim(), action: 'test' }),
      })
      setTestResult(res.ok ? 'success' : 'fail')
    } catch {
      setTestResult('fail')
    }
    setTesting(false)
  }

  const handleSave = async () => {
    if (!apiKey.trim()) return
    await fetch('/api/settings/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey: apiKey.trim(), action: 'save' }),
    })
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => setUseOwn(false)}
        className={cn('border rounded-xl p-4 cursor-pointer transition-all', !useOwn ? 'border-primary bg-primary/5' : 'border-slate-200')}
      >
        <div className="flex items-center gap-2">
          <div className={cn('w-4 h-4 rounded-full border-2', !useOwn ? 'border-primary bg-primary' : 'border-slate-300')}>
            {!useOwn && <div className="w-2 h-2 bg-white rounded-full m-[2px]" />}
          </div>
          <span className="font-medium text-sm">Chief 内置 AI（免费，推荐）</span>
        </div>
        <p className="text-xs text-slate-500 mt-1 ml-6">无需配置，立即可用</p>
      </div>

      <div
        onClick={() => setUseOwn(true)}
        className={cn('border rounded-xl p-4 cursor-pointer transition-all', useOwn ? 'border-primary bg-primary/5' : 'border-slate-200')}
      >
        <div className="flex items-center gap-2">
          <div className={cn('w-4 h-4 rounded-full border-2', useOwn ? 'border-primary bg-primary' : 'border-slate-300')}>
            {useOwn && <div className="w-2 h-2 bg-white rounded-full m-[2px]" />}
          </div>
          <span className="font-medium text-sm">用我自己的 AI 服务</span>
        </div>

        {useOwn && (
          <div className="mt-3 ml-6 space-y-3">
            <p className="text-xs text-slate-500">
              如果你有 OpenAI、Claude 等 AI 服务的账号，可以让 Chief 用你自己的账号来处理数据。
            </p>
            <div className="text-xs text-slate-600 space-y-1">
              <div>· 你的数据只经过你自己的 AI 账号</div>
              <div>· 没有使用次数限制</div>
              <div>· 可以选择你喜欢的 AI</div>
            </div>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="openai">OpenAI (ChatGPT)</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="deepseek">DeepSeek</option>
              <option value="groq">Groq</option>
              <option value="custom">Custom (OpenAI compatible)</option>
            </select>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestResult(null) }}
                placeholder="粘贴你的密钥"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-24"
              />
              <button
                onClick={handleTest}
                disabled={testing || !apiKey.trim()}
                className="absolute right-1 top-1 px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Test'}
              </button>
            </div>
            {testResult === 'success' && <p className="text-xs text-emerald-600">✅ Connection successful</p>}
            {testResult === 'fail' && <p className="text-xs text-red-600">Connection failed. Check your key.</p>}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Shield className="w-3 h-3" />
              密钥加密存储，仅用于你的 AI 请求
            </div>
            {testResult === 'success' && (
              <button onClick={handleSave} className="px-3 py-1.5 bg-primary text-white text-xs rounded-lg">Save</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Main Onboarding Page ─── */

export default function OnboardingPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [step, setStep] = useState<Step>('channels')
  const [commitmentCount, setCommitmentCount] = useState(0)

  // Channel connection states
  const [emailConnected, setEmailConnected] = useState(true) // already connected via login
  const [emailAddress, setEmailAddress] = useState('')
  const [whatsappConnected, setWhatsappConnected] = useState(false)
  const [telegramConnected, setTelegramConnected] = useState(false)

  const hasMessagingChannel = whatsappConnected || telegramConnected

  // Fetch connected email from profile
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      setEmailAddress(data?.email || '')
    }).catch(() => {})
  }, [])

  const handleWhatsAppConnect = () => {
    // Open WhatsApp QR modal or redirect to settings
    window.open('/dashboard/settings?connect=whatsapp', '_blank')
    // For now, mark as connected after a delay (user will scan QR in new tab)
    // In production, poll for connection status
    const interval = setInterval(async () => {
      const res = await fetch('/api/whatsapp/status').catch(() => null)
      if (res?.ok) {
        const data = await res.json()
        if (data.connected) {
          setWhatsappConnected(true)
          clearInterval(interval)
        }
      }
    }, 3000)
    setTimeout(() => clearInterval(interval), 120000) // stop after 2 min
  }

  const handleTelegramConnect = () => {
    window.open('/dashboard/settings?connect=telegram', '_blank')
    setTelegramConnected(true) // simplified for now
  }

  const handleStartScan = () => {
    setStep('scanning')
  }

  const handleDiscoveryComplete = useCallback(async (count: number) => {
    setCommitmentCount(count)
    // Call onboarding API to mark onboarding complete
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const lang = navigator.language.startsWith('zh') ? 'zh' : navigator.language.startsWith('ms') ? 'ms' : 'en'
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: tz, language: lang }),
      })
    } catch {
      // Non-blocking: don't prevent user from entering dashboard
    }
    setStep('ready')
  }, [])

  const handleEnterDashboard = () => {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200"
          >
            <Sparkles className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-xl font-bold text-slate-900">
            {step === 'channels' ? '设置你的 Chief' :
             step === 'scanning' ? 'Chief 正在了解你...' :
             '准备好了！'}
          </h1>
          {step === 'channels' && (
            <p className="text-sm text-slate-500 mt-1">连接你的渠道，让 Chief 开始帮你追踪承诺</p>
          )}
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 justify-center mb-8">
          {['channels', 'scanning', 'ready'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn('w-2.5 h-2.5 rounded-full transition-colors', {
                'bg-primary': step === s || ['channels', 'scanning', 'ready'].indexOf(step) > i,
                'bg-slate-200': ['channels', 'scanning', 'ready'].indexOf(step) < i,
              })} />
              {i < 2 && <div className={cn('w-8 h-0.5', {
                'bg-primary': ['channels', 'scanning', 'ready'].indexOf(step) > i,
                'bg-slate-200': ['channels', 'scanning', 'ready'].indexOf(step) <= i,
              })} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ─── Step: Channels ─── */}
          {step === 'channels' && (
            <motion.div
              key="channels"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Email section */}
              <div>
                <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" /> 邮箱
                </h2>
                <div className="space-y-2">
                  {emailConnected && emailAddress && (
                    <div className="border border-emerald-300 bg-emerald-50 rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-sm font-medium text-emerald-800">{emailAddress}</span>
                      </div>
                      <p className="text-xs text-emerald-600/70 mt-1 ml-7">邮件扫描、承诺提取、简报生成已就绪</p>
                    </div>
                  )}
                  <button
                    onClick={() => window.location.href = '/api/accounts/add'}
                    className="w-full border border-dashed border-slate-300 rounded-xl p-3 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> 添加另一个邮箱<span className="text-xs text-slate-400">（可选）</span>
                  </button>
                </div>
              </div>

              {/* Messaging section */}
              <div>
                <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> 通讯工具
                  <span className="text-xs font-normal text-red-500">（至少连接一个）</span>
                </h2>
                <p className="text-xs text-slate-500 mb-3">
                  Chief 通过通讯工具给你推送简报、提醒承诺、接收你的语音指令。
                </p>
                <div className="space-y-2">
                  <ChannelCard
                    icon={MessageSquare}
                    name="WhatsApp"
                    description="扫码连接，Chief 在 WhatsApp 里跟你对话"
                    connected={whatsappConnected}
                    onConnect={handleWhatsAppConnect}
                  />
                  <ChannelCard
                    icon={Bot}
                    name="Telegram"
                    description="连接 Telegram Bot"
                    connected={telegramConnected}
                    onConnect={handleTelegramConnect}
                  />
                  <ChannelCard
                    icon={MessageSquare}
                    name="Teams"
                    description="Microsoft Teams 聊天和会议"
                    connected={false}
                    onConnect={() => {}}
                    disabled
                    badge="即将推出"
                  />
                </div>
              </div>

              {/* AI section */}
              <div>
                <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Chief 的大脑
                </h2>
                <p className="text-xs text-slate-500 mb-3">
                  Chief 用 AI 帮你分析邮件、起草回复、追踪承诺。
                </p>
                <AIConfig />
              </div>

              {/* CTA */}
              <button
                onClick={handleStartScan}
                disabled={!hasMessagingChannel}
                className={cn(
                  'w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all',
                  hasMessagingChannel
                    ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                {hasMessagingChannel ? (
                  <>下一步 <ArrowRight className="w-4 h-4" /></>
                ) : (
                  '请先连接至少一个通讯工具'
                )}
              </button>
            </motion.div>
          )}

          {/* ─── Step: Scanning ─── */}
          {step === 'scanning' && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <CommitmentDiscovery onComplete={handleDiscoveryComplete} />
            </motion.div>
          )}

          {/* ─── Step: Ready ─── */}
          {step === 'ready' && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6"
            >
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
                <Target className="w-8 h-8 text-indigo-600 mx-auto mb-3" />
                <div className="text-3xl font-bold text-indigo-700">{commitmentCount}</div>
                <div className="text-sm text-indigo-600 mt-1">个承诺已发现</div>
                <p className="text-xs text-indigo-500 mt-2">Chief 会帮你追踪每一个承诺，不再遗忘</p>
              </div>

              <button
                onClick={handleEnterDashboard}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                进入 Chief <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
