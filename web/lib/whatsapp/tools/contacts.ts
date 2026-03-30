import { ToolDefinition, ToolContext, sanitizeFilter, timeAgo } from '@/lib/whatsapp/tools/types'

export const definitions: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_contact_info',
      description: '查看某个联系人的信息和交互历史',
      parameters: {
        type: 'object',
        properties: {
          name_or_email: { type: 'string', description: '联系人姓名或邮箱' },
        },
        required: ['name_or_email'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_contact_from_card',
      description: '从名片信息保存联系人到通讯录',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '姓名' },
          email: { type: 'string', description: '邮箱' },
          company: { type: 'string', description: '公司' },
          role: { type: 'string', description: '职位' },
          phone: { type: 'string', description: '电话' },
          notes: { type: 'string', description: '备注（如在哪认识的）' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_contact_taste',
      description: '更新联系人的品味/偏好信息（饮食、爱好、家庭、忌讳等）',
      parameters: {
        type: 'object',
        properties: {
          name_or_email: { type: 'string', description: '联系人姓名或邮箱' },
          taste_key: { type: 'string', description: '偏好类型：diet/alcohol/hobbies/spouse/gift_notes/taboo/other' },
          taste_value: { type: 'string', description: '偏好内容' },
        },
        required: ['name_or_email', 'taste_key', 'taste_value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_boss_preference',
      description: '保存老板的偏好（饮食、住宿、出行、作息等），Apple 观察到或老板主动说的',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['dining', 'accommodation', 'travel', 'communication', 'energy', 'gifting', 'other'], description: '偏好类别' },
          key: { type: 'string', description: '具体偏好项，如"座位"、"口味"、"起床时间"' },
          value: { type: 'string', description: '偏好值，如"靠走道"、"不吃辣"、"7:00"' },
        },
        required: ['category', 'key', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_contacts_in_city',
      description: '查询在某个城市认识的联系人（用于出差前看谁可以约）',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名' },
        },
        required: ['city'],
      },
    },
  },
]

export async function execute(ctx: ToolContext, name: string, args: any): Promise<string | null> {
  const supabase = ctx.supabase

  switch (name) {
    case 'get_contact_info': {
      const search = args.name_or_email
      const { data: contacts } = await supabase
        .from('contacts')
        .select('name, email, company, role, relationship, importance, last_contact_at, email_count, notes')
        .eq('user_id', ctx.userId)
        .or(`name.ilike.%${sanitizeFilter(search)}%,email.ilike.%${sanitizeFilter(search)}%`)
        .limit(3)

      if (!contacts || contacts.length === 0) return `没有找到"${search}"的联系人信息。`
      return contacts.map(c => {
        const parts = [`*${c.name || c.email}*`]
        if (c.company) parts.push(`${c.company}${c.role ? ' ' + c.role : ''}`)
        if (c.relationship) parts.push(`关系：${c.relationship}`)
        if (c.importance) parts.push(`重要度：${c.importance}`)
        if (c.last_contact_at) parts.push(`上次联系：${timeAgo(c.last_contact_at)}`)
        if (c.email_count) parts.push(`邮件往来：${c.email_count} 封`)
        if (c.notes) parts.push(`备注：${c.notes}`)
        return parts.join('\n')
      }).join('\n---\n')
    }

    case 'save_contact_from_card': {
      const contactData: any = {
        user_id: ctx.userId,
        name: args.name,
        email: args.email || `unknown-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@placeholder.internal`,
        company: args.company || null,
        role: args.role || null,
        notes: args.notes || null,
        relationship: 'other',
        importance: 'normal',
        auto_detected: true,
      }

      const { error } = await supabase
        .from('contacts')
        .upsert(contactData, { onConflict: 'user_id,email' })

      if (error) return `保存失败：${error.message}`
      return `已保存联系人：${args.name}${args.company ? ' @ ' + args.company : ''}${args.role ? ' (' + args.role + ')' : ''}`
    }

    case 'update_contact_taste': {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, taste_profile')
        .eq('user_id', ctx.userId)
        .or(`name.ilike.%${sanitizeFilter(args.name_or_email)}%,email.ilike.%${sanitizeFilter(args.name_or_email)}%`)
        .limit(1)

      if (!contacts || contacts.length === 0) return `没有找到"${args.name_or_email}"的联系人。`
      const contact = contacts[0]
      const taste = contact.taste_profile || {}
      taste[args.taste_key] = args.taste_value

      await supabase.from('contacts').update({ taste_profile: taste }).eq('id', contact.id)
      return `已更新${contact.name}的偏好：${args.taste_key} = ${args.taste_value}`
    }

    case 'save_boss_preference': {
      const { error } = await supabase
        .from('boss_preferences')
        .upsert({
          user_id: ctx.userId,
          category: args.category,
          key: args.key,
          value: args.value,
          learned_from: 'explicit',
          confidence: 1.0,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,category,key' })

      if (error) return `保存失败：${error.message}`
      return `已记住：${args.key} = ${args.value}`
    }

    case 'get_contacts_in_city': {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('name, company, role, email, last_contact_at, notes')
        .eq('user_id', ctx.userId)
        .or(`company.ilike.%${sanitizeFilter(args.city)}%,notes.ilike.%${sanitizeFilter(args.city)}%`)
        .limit(10)

      // Also search by company headquarters in notes
      if (!contacts || contacts.length === 0) return `通讯录里没有找到跟"${args.city}"相关的联系人。可以试试搜公司名。`
      return contacts.map(c => {
        const ago = c.last_contact_at ? `上次联系: ${timeAgo(c.last_contact_at)}` : '尚未联系'
        return `${c.name}${c.company ? ' @ ' + c.company : ''}${c.role ? ' (' + c.role + ')' : ''}\n  ${ago}`
      }).join('\n\n')
    }

    default:
      return null
  }
}
