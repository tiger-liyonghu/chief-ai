import { ToolDefinition, ToolContext, sanitizeFilter, timeAgo } from './types'
import { supabase } from '../supabase'

export const definitions: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_pending_emails',
      description: '查看需要回复的邮件，或最近收到的邮件',
      parameters: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            enum: ['needs_reply', 'recent', 'from_person'],
            description: 'needs_reply=待回复, recent=最近收到, from_person=某人的邮件',
          },
          person_name: { type: 'string', description: '如果filter=from_person，搜索的人名或邮箱' },
          limit: { type: 'number', description: '返回数量，默认5' },
        },
        required: ['filter'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_email_reply',
      description: '为某封邮件起草回复',
      parameters: {
        type: 'object',
        properties: {
          email_keyword: { type: 'string', description: '邮件主题或发件人关键词' },
          instruction: { type: 'string', description: '老板的指示，如"就说下周安排"' },
          tone: { type: 'string', enum: ['professional', 'casual', 'formal'], description: '语气，默认professional' },
        },
        required: ['email_keyword', 'instruction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_email_reply',
      description: '老板确认后，真正发送邮件回复。老板说"发"、"发送"、"send"时使用。必须先用 draft_email_reply 生成草稿并获得老板确认后才能调用。',
      parameters: {
        type: 'object',
        properties: {
          email_id: { type: 'string', description: '要回复的邮件 ID（从 draft_email_reply 结果中获取）' },
          reply_content: { type: 'string', description: '最终确认的回复内容' },
        },
        required: ['email_id', 'reply_content'],
      },
    },
  },
]

export async function execute(ctx: ToolContext, name: string, args: any): Promise<string | null> {
  switch (name) {
    case 'get_pending_emails': {
      const limit = args.limit || 5
      let query = supabase
        .from('emails')
        .select('id, subject, from_name, from_address, snippet, received_at, reply_urgency')
        .eq('user_id', ctx.userId)
        .order('received_at', { ascending: false })
        .limit(limit)

      if (args.filter === 'needs_reply') {
        query = query.eq('is_reply_needed', true)
      } else if (args.filter === 'from_person' && args.person_name) {
        const sp = sanitizeFilter(args.person_name)
        query = query.or(`from_name.ilike.%${sp}%,from_address.ilike.%${sp}%`)
      }

      const { data } = await query
      if (!data || data.length === 0) return '没有找到相关邮件。'
      return data.map(e => {
        const ago = timeAgo(e.received_at)
        const urgency = e.reply_urgency && e.reply_urgency >= 2 ? ' ⚠️紧急' : ''
        return `${e.from_name || e.from_address}: "${e.subject}" (${ago})${urgency}\n  ${e.snippet?.slice(0, 80) || ''}`
      }).join('\n\n')
    }

    case 'draft_email_reply': {
      const { data: emails } = await supabase
        .from('emails')
        .select('id, subject, from_name, from_address, body_text, snippet')
        .eq('user_id', ctx.userId)
        .or(`subject.ilike.%${sanitizeFilter(args.email_keyword)}%,from_name.ilike.%${sanitizeFilter(args.email_keyword)}%,from_address.ilike.%${sanitizeFilter(args.email_keyword)}%`)
        .order('received_at', { ascending: false })
        .limit(1)

      if (!emails || emails.length === 0) return `没有找到包含"${args.email_keyword}"的邮件。`
      const email = emails[0]
      const emailContent = email.body_text || email.snippet || ''
      return JSON.stringify({
        found_email: {
          id: email.id,
          subject: email.subject,
          from: email.from_name || email.from_address,
          content_preview: emailContent.slice(0, 500),
        },
        instruction: args.instruction,
        tone: args.tone || 'professional',
        _note: 'Please draft a reply based on this email and the instruction. Present the draft to the boss for approval.',
      })
    }

    case 'send_email_reply': {
      // Call the web app's send-reply endpoint
      const webUrl = process.env.WEB_APP_URL || 'http://localhost:3000'
      try {
        const res = await fetch(`${webUrl}/api/send-reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email_id: args.email_id,
            reply_content: args.reply_content,
            user_id: ctx.userId,
          }),
        })
        if (!res.ok) {
          const errBody: any = await res.json().catch(() => ({ error: 'Unknown error' }))
          return `发送失败：${errBody.error || res.statusText}`
        }
        // Update reply draft status
        await supabase.from('reply_drafts')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('email_id', args.email_id)
          .eq('user_id', ctx.userId)
        return '邮件已发送 ✓'
      } catch (err: any) {
        return `发送失败：${err.message}。可能需要在网页端操作。`
      }
    }

    default:
      return null
  }
}
