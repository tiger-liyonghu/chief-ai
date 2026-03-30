import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/google/tokens'
import { getModelForTask, type TaskType, type LLMConfig, type ModelSelection } from './router'

export type { LLMConfig, TaskType, ModelSelection }

// Default configs for each provider
const PROVIDER_DEFAULTS: Record<string, { baseURL: string; models: string[]; defaultModel: string }> = {
  deepseek: {
    baseURL: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
  },
  openai: {
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o3-mini'],
    defaultModel: 'gpt-4o-mini',
  },
  claude: {
    baseURL: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414', 'claude-opus-4-20250514'],
    defaultModel: 'claude-sonnet-4-20250514',
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
  },
  ollama: {
    baseURL: 'http://localhost:11434/v1',
    models: ['llama3.2', 'mistral', 'qwen2.5'],
    defaultModel: 'llama3.2',
  },
  custom: {
    baseURL: '',
    models: [],
    defaultModel: '',
  },
}

export { PROVIDER_DEFAULTS }

// Get user's LLM config from database
export async function getUserLLMConfig(userId: string): Promise<LLMConfig> {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('llm_provider, llm_api_key_encrypted, llm_model, llm_base_url')
    .eq('id', userId)
    .single()

  const provider = profile?.llm_provider || 'deepseek'
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.deepseek

  let apiKey = process.env.DEEPSEEK_API_KEY! // fallback to system key
  if (profile?.llm_api_key_encrypted) {
    try {
      apiKey = decrypt(profile.llm_api_key_encrypted)
    } catch {
      // If decryption fails, use system default
    }
  }

  // Warn if using the known-invalid shell-leaked key (ends with 6d83)
  if (apiKey && apiKey.endsWith('6d83')) {
    console.warn(
      '[LLM Config] WARNING: DeepSeek API key ends with "6d83" — this is the old invalid key ' +
      'leaked from shell environment. Ensure .env.local has the correct DEEPSEEK_API_KEY or ' +
      'start the dev server with the correct key: DEEPSEEK_API_KEY=sk-... npm run dev'
    )
  }

  return {
    provider,
    apiKey,
    model: profile?.llm_model || defaults.defaultModel,
    baseURL: profile?.llm_base_url || defaults.baseURL,
  }
}

// Create an OpenAI-compatible client for the user
export async function createUserAIClient(userId: string): Promise<{ client: OpenAI; model: string }> {
  const config = await getUserLLMConfig(userId)

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  })

  return { client, model: config.model }
}

// Create an OpenAI-compatible client with task-optimized parameters
export async function createTaskAIClient(
  userId: string,
  taskType: TaskType,
): Promise<{ client: OpenAI; model: string; temperature: number; maxTokens: number }> {
  const config = await getUserLLMConfig(userId)
  const selection = getModelForTask(taskType, config)

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  })

  return {
    client,
    model: selection.model,
    temperature: selection.temperature,
    maxTokens: selection.maxTokens,
  }
}

// For system-level calls (no user context), use default DeepSeek
export const systemAIClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseURL: 'https://api.deepseek.com',
})
