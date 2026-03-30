import { ToolDefinition, ToolContext, getUserTimezone } from './types'
import { supabase } from '../supabase'

export const definitions: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_today_calendar',
      description: '查看今天或指定日期的日历事件/会议',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: '日期，ISO格式如2026-03-29。不传则为今天' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_upcoming_events',
      description: '查看未来几天的日程安排',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: '往后看几天，默认7' },
        },
      },
    },
  },
]

export async function execute(ctx: ToolContext, name: string, args: any): Promise<string | null> {
  const tz = await getUserTimezone(ctx.userId)

  switch (name) {
    case 'get_today_calendar': {
      const dateStr = args.date || new Date().toLocaleDateString('en-CA', { timeZone: tz })
      const dayStart = `${dateStr}T00:00:00`
      const dayEnd = `${dateStr}T23:59:59`
      const { data } = await supabase
        .from('calendar_events')
        .select('title, start_time, end_time, location, attendees')
        .eq('user_id', ctx.userId)
        .gte('start_time', dayStart)
        .lte('start_time', dayEnd)
        .order('start_time')
      if (!data || data.length === 0) return `${dateStr} 没有日程安排。`
      return data.map(e => {
        const start = new Date(e.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: tz })
        const end = new Date(e.end_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: tz })
        const loc = e.location ? ` @ ${e.location}` : ''
        return `${start}-${end} ${e.title}${loc}`
      }).join('\n')
    }

    case 'get_upcoming_events': {
      const days = args.days || 7
      const now = new Date()
      const end = new Date(now.getTime() + days * 86400000)
      const { data } = await supabase
        .from('calendar_events')
        .select('title, start_time, end_time, location')
        .eq('user_id', ctx.userId)
        .gte('start_time', now.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time')
      if (!data || data.length === 0) return `未来 ${days} 天没有日程。`
      return data.map(e => {
        const d = new Date(e.start_time).toLocaleDateString('zh-CN', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: tz })
        const t = new Date(e.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: tz })
        return `${d} ${t} ${e.title}`
      }).join('\n')
    }

    default:
      return null
  }
}
