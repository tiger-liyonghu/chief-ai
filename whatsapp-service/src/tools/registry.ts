import { ToolDefinition, ToolContext, getUserTimezone } from './types'
import * as calendar from './calendar'
import * as email from './email'
import * as tasks from './tasks'
import * as contacts from './contacts'
import * as travel from './travel'
import * as agents from './agents'
import * as browser from './browser'
import * as dev from './dev'

const modules = [calendar, email, tasks, contacts, travel, agents, browser, dev]

export const APPLE_TOOLS: ToolDefinition[] = modules.flatMap(m => m.definitions)

export async function executeTool(userId: string, name: string, args: any): Promise<string> {
  const ctx: ToolContext = { userId, supabase: (await import('../supabase')).supabase }

  for (const mod of modules) {
    const result = await mod.execute(ctx, name, args)
    if (result !== null) return result
  }

  return `未知工具：${name}`
}

export { getUserTimezone }
