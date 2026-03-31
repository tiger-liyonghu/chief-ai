/**
 * System prompt for Chief AI — tool-capable version.
 * Uses Sophie personality layer for consistent voice across all channels.
 */
import { SOPHIE_IDENTITY } from './sophie-voice'

export function getChatSystemPrompt(assistantName: string = 'Chief'): string {
  return `${SOPHIE_IDENTITY}

## Dashboard Chat 补充规则

你现在在 Dashboard 上和老板对话。用 markdown 格式（**加粗**、列表）让信息更清晰。

你有工具可以创建任务、完成任务、草拟邮件、转发邮件、搜索全量数据、创建日历事件、推荐地点、记录开支、检查关系健康度。

工具使用：
- 邮件：永远先草拟，不直接发送。
- 搜索：用返回的真实数据回答，不要编造。搜不到就说「没有找到」。
- 批量/危险操作：先确认。
- 可以一次调用多个工具。

判断规则：
- 老板给了足够上下文就直接草拟，不用先搜索。
- 回答时给判断，不只列信息。哪件最重要？为什么？
- 老板问的人/事不在上下文里，先调搜索工具查，不要说找不到。`
}

/** Keep the old constant for backward compatibility */
export const CHAT_SYSTEM_PROMPT = getChatSystemPrompt('Chief')

/**
 * Fallback system prompt for providers without function-calling support.
 * Uses text-based [ACTION:] blocks that get parsed server-side.
 */
export function getChatSystemPromptFallback(assistantName: string = 'Chief'): string {
  return `${SOPHIE_IDENTITY}

## Dashboard Chat（无工具模式）

用 [ACTION:] 块执行操作：

[ACTION:CREATE_TASK]{"title":"...","priority":1,"due_date":"2026-04-01"}[/ACTION]
[ACTION:DRAFT_REPLY]{"to":"email","subject":"Re: ...","body":"..."}[/ACTION]
[ACTION:SEARCH]{"query":"搜索词"}[/ACTION]
[ACTION:COMPLETE_TASK]{"title":"任务名"}[/ACTION]
[ACTION:CREATE_EVENT]{"title":"会议","start_time":"...","end_time":"...","attendee_emails":["..."]}[/ACTION]

规则：
- 邮件永远先草拟，不直接发
- 搜不到就说「没有找到」，不编造
- 批量操作先确认
- 回答时给判断，不只列信息`
}

/** Keep the old constant for backward compatibility */
export const CHAT_SYSTEM_PROMPT_FALLBACK = getChatSystemPromptFallback('Chief')

interface Task {
  title: string
  priority: number
  status: string
  due_date: string | null
}

interface CalendarEvent {
  title: string
  start_time: string
  end_time: string
  location: string | null
}

interface Email {
  subject: string | null
  from_name: string | null
  from_address: string
  snippet: string | null
  received_at: string
}

interface FollowUp {
  type: string
  contact_name: string | null
  subject: string
  commitment_text: string | null
  due_date: string | null
}

interface Commitment {
  type: string
  contact_name: string | null
  contact_email: string | null
  title: string
  deadline: string | null
  status: string
  urgency_score: number | null
  family_member: string | null
}

interface VipContact {
  name: string
  email: string
  company: string | null
  relationship: string
  importance: string
  last_contact_at: string | null
}

export interface UserContext {
  tasks: Task[]
  events: CalendarEvent[]
  emails: Email[]
  followUps: FollowUp[]
  commitments?: Commitment[]
  vipContacts?: VipContact[]
  timezone: string
}

export function formatUserContext(ctx: UserContext): string {
  const now = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: ctx.timezone,
  })

  const sections: string[] = [`Today is ${now}. User timezone: ${ctx.timezone}.`]

  if (ctx.tasks.length > 0) {
    const taskLines = ctx.tasks.map(
      (t) =>
        `- [P${t.priority}] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}`
    )
    sections.push(`**Pending tasks:**\n${taskLines.join('\n')}`)
  } else {
    sections.push('**Pending tasks:** None')
  }

  if (ctx.events.length > 0) {
    const eventLines = ctx.events.map((e) => {
      const start = new Date(e.start_time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: ctx.timezone,
      })
      const end = new Date(e.end_time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: ctx.timezone,
      })
      return `- ${start}-${end}: ${e.title}${e.location ? ` @ ${e.location}` : ''}`
    })
    sections.push(`**Today's calendar:**\n${eventLines.join('\n')}`)
  } else {
    sections.push("**Today's calendar:** No events")
  }

  if (ctx.emails.length > 0) {
    const emailLines = ctx.emails.map(
      (e) => `- From ${e.from_name || e.from_address}: "${e.subject || '(no subject)'}"`
    )
    sections.push(`**Emails needing reply:**\n${emailLines.join('\n')}`)
  } else {
    sections.push('**Emails needing reply:** None')
  }

  if (ctx.followUps.length > 0) {
    const fuLines = ctx.followUps.map(
      (f) =>
        `- [${f.type}] ${f.contact_name || 'Unknown'}: ${f.subject}${f.due_date ? ` (due ${f.due_date})` : ''}`
    )
    sections.push(`**Active follow-ups:**\n${fuLines.join('\n')}`)
  }

  // Commitments (overdue first, then by urgency)
  if (ctx.commitments && ctx.commitments.length > 0) {
    const overdue = ctx.commitments.filter(c => c.status === 'overdue')
    const pending = ctx.commitments.filter(c => c.status !== 'overdue')

    if (overdue.length > 0) {
      const lines = overdue.map(c =>
        `- ⚠️ [${c.type}] ${c.contact_name || c.family_member || '?'}: "${c.title}" (deadline: ${c.deadline || 'none'}, urgency: ${c.urgency_score})`
      )
      sections.push(`**OVERDUE commitments (${overdue.length}):**\n${lines.join('\n')}`)
    }
    if (pending.length > 0) {
      const lines = pending.map(c =>
        `- [${c.type}${c.status === 'waiting' ? '/waiting' : ''}] ${c.contact_name || c.family_member || '?'}: "${c.title}" (deadline: ${c.deadline || 'none'})`
      )
      sections.push(`**Active commitments (${pending.length}):**\n${lines.join('\n')}`)
    }
  }

  // VIP contacts
  if (ctx.vipContacts && ctx.vipContacts.length > 0) {
    const lines = ctx.vipContacts.map(c => {
      const daysSince = c.last_contact_at
        ? Math.floor((Date.now() - new Date(c.last_contact_at).getTime()) / 86400000)
        : null
      const stale = daysSince && daysSince > 14 ? ' ⚠️ no contact in ' + daysSince + 'd' : ''
      return `- [${c.importance}] ${c.name} (${c.company || c.relationship})${stale}`
    })
    sections.push(`**Key contacts:**\n${lines.join('\n')}`)
  }

  return sections.join('\n\n')
}
