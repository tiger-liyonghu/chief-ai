import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'

export type ToolDefinition = OpenAI.Chat.Completions.ChatCompletionTool

export interface ToolContext {
  userId: string
  supabase: ReturnType<typeof createAdminClient>
}

export interface ToolModule {
  definitions: ToolDefinition[]
  execute: (ctx: ToolContext, name: string, args: any) => Promise<string | null>
}

/** Sanitize input for PostgREST filters to prevent injection */
export function sanitizeFilter(input: string): string {
  return input.replace(/[,.()"'\\]/g, '').slice(0, 100)
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

export async function getUserTimezone(userId: string): Promise<string> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .single()
  return data?.timezone || 'Asia/Singapore'
}

export function getLLMClient(): OpenAI {
  return new OpenAI({
    baseURL: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
    apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '',
  })
}
