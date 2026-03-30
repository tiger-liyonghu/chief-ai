import { ToolDefinition, ToolContext, sanitizeFilter, getLLMClient } from '@/lib/whatsapp/tools/types'

export const definitions: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'create_custom_agent',
      description: '创建一个自定义专项Agent。老板描述需求，Apple帮他建Agent（如竞品监控、周报、招聘跟进等）',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Agent名称' },
          description: { type: 'string', description: '这个Agent做什么（自然语言描述）' },
          schedule: { type: 'string', description: '执行频率：daily/weekly/on_demand，默认on_demand' },
        },
        required: ['name', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_custom_agents',
      description: '列出已创建的自定义Agent',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_custom_agent',
      description: '手动运行某个自定义Agent',
      parameters: {
        type: 'object',
        properties: {
          agent_name: { type: 'string', description: 'Agent名称关键词' },
        },
        required: ['agent_name'],
      },
    },
  },
]

export async function execute(ctx: ToolContext, name: string, args: any): Promise<string | null> {
  const supabase = ctx.supabase

  switch (name) {
    case 'create_custom_agent': {
      const schedule = args.schedule || 'on_demand'
      // Generate system prompt for the agent
      const client = getLLMClient()
      const completion = await client.chat.completions.create({
        model: process.env.LLM_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个AI Agent设计师。根据用户的描述，生成一个简洁的system prompt，让一个AI助手能执行这个任务。只输出prompt本身，不要解释。' },
          { role: 'user', content: `任务描述：${args.description}` },
        ],
        temperature: 0.4,
        max_tokens: 500,
      })
      const systemPrompt = completion.choices[0]?.message?.content?.trim() || args.description

      // Try to save to custom_agents table, fallback to contacts table
      const agentData = {
        user_id: ctx.userId,
        name: args.name,
        description: args.description,
        system_prompt: systemPrompt,
        schedule,
        is_active: true,
      }

      const { error } = await supabase.from('custom_agents').insert(agentData)
      if (error) return `创建Agent失败：${error.message}`

      const scheduleLabel = schedule === 'daily' ? '每天' : schedule === 'weekly' ? '每周' : '按需'
      return `已创建Agent「${args.name}」\n功能：${args.description}\n执行频率：${scheduleLabel}\n\n跟我说"运行${args.name}"即可手动触发。`
    }

    case 'list_custom_agents': {
      const { data: agents } = await supabase
        .from('custom_agents')
        .select('name, description, schedule, is_active, last_run_at')
        .eq('user_id', ctx.userId)
        .eq('is_active', true)

      if (!agents || agents.length === 0) return '还没有创建自定义Agent。跟我说想要什么Agent，我帮你建。'
      const items = agents.map(a => {
        const sched = a.schedule === 'daily' ? '每天' : a.schedule === 'weekly' ? '每周' : '按需'
        return `🤖 *${a.name}* — ${a.description} (${sched})`
      })
      return `你的Agent列表：\n\n${items.join('\n')}`
    }

    case 'run_custom_agent': {
      const { data: agents } = await supabase
        .from('custom_agents')
        .select('name, system_prompt')
        .eq('user_id', ctx.userId)
        .ilike('name', `%${sanitizeFilter(args.agent_name)}%`)
        .eq('is_active', true)
        .limit(1)

      if (!agents || agents.length === 0) return `没有找到名为"${args.agent_name}"的Agent。`

      const agentPrompt = agents[0].system_prompt
      const agentName = agents[0].name
      await supabase.from('custom_agents').update({ last_run_at: new Date().toISOString() }).eq('name', agents[0].name).eq('user_id', ctx.userId)

      // Agent gets access to data tools for querying user's data
      const { APPLE_TOOLS, executeTool } = await import('@/lib/whatsapp/tools/registry')
      const dataTools = APPLE_TOOLS.filter(t => {
        const n = (t as any).function.name
        return ['get_today_calendar', 'get_upcoming_events', 'get_pending_emails', 'get_tasks',
                'get_commitments', 'get_contact_info', 'get_trip_info', 'search_company_news'].includes(n)
      })

      const client = getLLMClient()
      const msgs: any[] = [
        { role: 'system', content: agentPrompt },
        { role: 'user', content: `请执行你的任务，基于当前日期 ${new Date().toISOString().split('T')[0]}。你可以使用工具查询用户的邮件、日历、任务、联系人等数据。输出结果。` },
      ]

      let completion = await client.chat.completions.create({
        model: process.env.LLM_MODEL || 'deepseek-chat',
        messages: msgs,
        tools: dataTools.length > 0 ? dataTools : undefined,
        temperature: 0.5,
        max_tokens: 1000,
      })

      let assistantMsg = completion.choices[0]?.message
      // Handle tool calls (up to 3 rounds)
      let rounds = 0
      while (assistantMsg?.tool_calls && rounds < 3) {
        rounds++
        msgs.push(assistantMsg)
        for (const tc of assistantMsg.tool_calls) {
          let toolArgs: any = {}
          try { toolArgs = JSON.parse((tc as any).function.arguments || '{}') } catch {}
          const toolResult = await executeTool(ctx.userId, (tc as any).function.name, toolArgs)
          msgs.push({ role: 'tool', tool_call_id: tc.id, content: toolResult })
        }
        completion = await client.chat.completions.create({
          model: process.env.LLM_MODEL || 'deepseek-chat',
          messages: msgs,
          tools: dataTools,
          temperature: 0.5,
          max_tokens: 1000,
        })
        assistantMsg = completion.choices[0]?.message
      }

      const result = assistantMsg?.content?.trim()
      return result ? `🤖 *${agentName}* 执行结果：\n\n${result}` : 'Agent执行完毕但无输出。'
    }

    default:
      return null
  }
}
