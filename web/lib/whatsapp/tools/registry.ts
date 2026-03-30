import { ToolDefinition, ToolContext, getUserTimezone } from '@/lib/whatsapp/tools/types'
import { createAdminClient } from '@/lib/supabase/admin'
import * as calendar from '@/lib/whatsapp/tools/calendar'
import * as email from '@/lib/whatsapp/tools/email'
import * as tasks from '@/lib/whatsapp/tools/tasks'
import * as contacts from '@/lib/whatsapp/tools/contacts'
import * as travel from '@/lib/whatsapp/tools/travel'
import * as agents from '@/lib/whatsapp/tools/agents'
import * as browser from '@/lib/whatsapp/tools/browser'
import * as dev from '@/lib/whatsapp/tools/dev'

const modules = [calendar, email, tasks, contacts, travel, agents, browser, dev]

export const APPLE_TOOLS: ToolDefinition[] = modules.flatMap(m => m.definitions)

export async function executeTool(userId: string, name: string, args: any): Promise<string> {
  const ctx: ToolContext = { userId, supabase: createAdminClient() }

  for (const mod of modules) {
    const result = await mod.execute(ctx, name, args)
    if (result !== null) return result
  }

  return `未知工具：${name}`
}

export { getUserTimezone }
