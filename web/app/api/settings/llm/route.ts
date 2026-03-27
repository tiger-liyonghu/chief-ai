import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt, decrypt } from '@/lib/google/tokens'
import { PROVIDER_DEFAULTS } from '@/lib/ai/unified-client'
import OpenAI from 'openai'

const ALLOWED_PROVIDERS = ['deepseek', 'openai', 'claude', 'groq', 'ollama', 'custom'] as const

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('llm_provider, llm_api_key_encrypted, llm_model, llm_base_url')
    .eq('id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const provider = profile?.llm_provider || 'deepseek'
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.deepseek

  return NextResponse.json({
    provider,
    model: profile?.llm_model || defaults.defaultModel,
    base_url: profile?.llm_base_url || defaults.baseURL,
    has_custom_key: !!profile?.llm_api_key_encrypted,
    providers: PROVIDER_DEFAULTS,
  })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  // Validate and set provider
  if ('provider' in body) {
    if (!ALLOWED_PROVIDERS.includes(body.provider)) {
      return NextResponse.json(
        { error: `Provider must be one of: ${ALLOWED_PROVIDERS.join(', ')}` },
        { status: 400 }
      )
    }
    updates.llm_provider = body.provider

    // When switching provider, reset model to the new provider's default
    // unless a model was explicitly provided in this request
    if (!('model' in body)) {
      const defaults = PROVIDER_DEFAULTS[body.provider]
      if (defaults) {
        updates.llm_model = defaults.defaultModel
      }
    }

    // Reset base_url to default when switching provider (unless custom)
    if (!('base_url' in body) && body.provider !== 'custom') {
      const defaults = PROVIDER_DEFAULTS[body.provider]
      if (defaults) {
        updates.llm_base_url = defaults.baseURL
      }
    }
  }

  // Validate and set model
  if ('model' in body) {
    if (typeof body.model !== 'string' || body.model.length === 0 || body.model.length > 100) {
      return NextResponse.json({ error: 'Invalid model name' }, { status: 400 })
    }
    updates.llm_model = body.model
  }

  // Validate and set base_url
  if ('base_url' in body) {
    if (body.base_url && (typeof body.base_url !== 'string' || body.base_url.length > 500)) {
      return NextResponse.json({ error: 'Invalid base URL' }, { status: 400 })
    }
    updates.llm_base_url = body.base_url || null
  }

  // Encrypt and set API key
  if ('api_key' in body) {
    if (body.api_key) {
      if (typeof body.api_key !== 'string' || body.api_key.length > 500) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 400 })
      }
      updates.llm_api_key_encrypted = encrypt(body.api_key)
    } else {
      // Empty string or null = clear the key (fall back to system default)
      updates.llm_api_key_encrypted = null
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (body.action !== 'test') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  // Get user's current LLM config
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('llm_provider, llm_api_key_encrypted, llm_model, llm_base_url')
    .eq('id', user.id)
    .single()

  const provider = profile?.llm_provider || 'deepseek'
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.deepseek

  let apiKey = process.env.DEEPSEEK_API_KEY!
  if (profile?.llm_api_key_encrypted) {
    try {
      apiKey = decrypt(profile.llm_api_key_encrypted)
    } catch {
      return NextResponse.json({ ok: false, error: 'Failed to decrypt API key' })
    }
  }

  const model = profile?.llm_model || defaults.defaultModel
  const baseURL = profile?.llm_base_url || defaults.baseURL

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'No API key configured' })
  }

  if (!baseURL) {
    return NextResponse.json({ ok: false, error: 'No base URL configured' })
  }

  try {
    const client = new OpenAI({ apiKey, baseURL })
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Say "Hello!" in one word.' }],
      max_tokens: 10,
      temperature: 0,
    })

    const reply = response.choices[0]?.message?.content?.trim() || ''
    return NextResponse.json({ ok: true, response: reply, model })
  } catch (err: any) {
    const message = err?.message || 'Connection failed'
    // Clean up common error messages
    const cleanMessage = message.includes('401') ? 'Invalid API key'
      : message.includes('404') ? `Model "${model}" not found`
      : message.includes('ECONNREFUSED') ? 'Cannot connect to server (is it running?)'
      : message.slice(0, 200)
    return NextResponse.json({ ok: false, error: cleanMessage })
  }
}
