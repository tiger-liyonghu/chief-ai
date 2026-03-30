import { ToolDefinition, ToolContext, sanitizeFilter } from './types'
import { supabase } from '../supabase'

export const definitions: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_tasks',
      description: '查看待办任务',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'all'],
            description: '任务状态，默认pending',
          },
          priority: { type: 'number', description: '优先级筛选：1=紧急 2=本周 3=稍后' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: '创建新任务/待办',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '任务标题（动词开头）' },
          priority: { type: 'number', description: '1=紧急 2=本周 3=稍后，默认2' },
          due_date: { type: 'string', description: '截止日期，ISO格式，可选' },
          due_reason: { type: 'string', description: '为什么这个日期，可选' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: '标记任务完成',
      parameters: {
        type: 'object',
        properties: {
          task_title_keyword: { type: 'string', description: '任务标题关键词，用于模糊匹配' },
        },
        required: ['task_title_keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_commitments',
      description: '查看承诺事项（我承诺的 / 对方承诺的）',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['i_promised', 'they_promised', 'all'],
            description: 'i_promised=我承诺的, they_promised=对方承诺的, all=全部',
          },
        },
      },
    },
  },
]

export async function execute(ctx: ToolContext, name: string, args: any): Promise<string | null> {
  switch (name) {
    case 'get_tasks': {
      let query = supabase
        .from('tasks')
        .select('id, title, priority, status, due_date, due_reason')
        .eq('user_id', ctx.userId)
        .order('priority')
        .limit(10)

      if (args.status === 'pending' || !args.status) {
        query = query.in('status', ['pending', 'in_progress'])
      } else if (args.status === 'in_progress') {
        query = query.eq('status', 'in_progress')
      }
      if (args.priority) {
        query = query.eq('priority', args.priority)
      }

      const { data } = await query
      if (!data || data.length === 0) return '目前没有待办任务。'
      const labels = { 1: '🔴紧急', 2: '🟡本周', 3: '🔵稍后' } as Record<number, string>
      return data.map(t => {
        const due = t.due_date ? ` (截止 ${t.due_date})` : ''
        return `${labels[t.priority] || ''} ${t.title}${due}`
      }).join('\n')
    }

    case 'create_task': {
      const { error } = await supabase.from('tasks').insert({
        user_id: ctx.userId,
        title: args.title,
        priority: args.priority || 2,
        status: 'pending',
        source_type: 'whatsapp',
        due_date: args.due_date || null,
        due_reason: args.due_reason || null,
      })
      if (error) return `创建失败：${error.message}`
      const dueNote = args.due_date ? `，截止 ${args.due_date}` : ''
      return `已创建任务「${args.title}」${dueNote}`
    }

    case 'complete_task': {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title')
        .eq('user_id', ctx.userId)
        .in('status', ['pending', 'in_progress'])
        .ilike('title', `%${sanitizeFilter(args.task_title_keyword)}%`)
        .limit(1)

      if (!tasks || tasks.length === 0) return `没有找到包含"${args.task_title_keyword}"的任务。`
      await supabase.from('tasks').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', tasks[0].id)
      return `已完成任务「${tasks[0].title}」✓`
    }

    case 'get_commitments': {
      let query = supabase
        .from('commitments')
        .select('contact_name, contact_email, title, description, type, deadline, status')
        .eq('user_id', ctx.userId)
        .in('status', ['pending', 'in_progress'])
        .order('deadline', { ascending: true })
        .limit(10)

      if (args.type === 'i_promised') {
        query = query.eq('type', 'i_promised')
      } else if (args.type === 'they_promised') {
        query = query.eq('type', 'they_promised')
      }

      const { data } = await query
      if (!data || data.length === 0) return '目前没有活跃的承诺事项。'
      return data.map(f => {
        const icon = f.type === 'i_promised' ? '📤你承诺的' : '📥对方承诺的'
        const overdue = f.deadline && new Date(f.deadline) < new Date() ? ' ⚠️已逾期' : ''
        const due = f.deadline ? ` (截止 ${f.deadline})` : ''
        return `${icon} ${f.contact_name || f.contact_email}: ${f.title || f.description}${due}${overdue}`
      }).join('\n')
    }

    default:
      return null
  }
}
