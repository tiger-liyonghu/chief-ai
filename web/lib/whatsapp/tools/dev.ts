import { ToolDefinition, ToolContext } from '@/lib/whatsapp/tools/types'

export const definitions: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'run_dev_task',
      description: '执行开发任务 — 调用 Claude Code 进行代码修改、功能开发、bug修复等。老板说"改一下XX"、"加个XX功能"、"修一下XX bug"时使用。',
      parameters: {
        type: 'object',
        properties: {
          task_description: { type: 'string', description: '开发任务的详细描述，用英文或中文都可以' },
          project: {
            type: 'string',
            enum: ['chief', 'dtsg6', 'actuary100', 'medex'],
            description: 'chief=通用助手(默认), dtsg6=Digital Twins SG, actuary100=保险高管图谱, medex=医疗险产品',
          },
        },
        required: ['task_description'],
      },
    },
  },
]

export async function execute(ctx: ToolContext, name: string, args: any): Promise<string | null> {
  switch (name) {
    case 'run_dev_task': {
      const projectPaths: Record<string, string> = {
        chief: '/Users/tigerli/Desktop/通用助手/web',
        dtsg6: '/Users/tigerli/Desktop/DT SG 6/web',
        actuary100: '/Users/tigerli/Desktop/Actuary100/web',
        medex: '/Users/tigerli/Desktop/Medex 2',
      }
      const project = args.project || 'chief'
      const cwd = projectPaths[project] || projectPaths.chief
      const task = args.task_description

      // Only allow specific user IDs to use dev tasks
      const ALLOWED_DEV_USERS = ['47cca1a7-c00f-4d00-a95f-e381aab88dd7']
      if (!ALLOWED_DEV_USERS.includes(ctx.userId)) {
        return '开发任务仅限管理员使用。'
      }

      console.log(`[Apple] Running dev task in ${cwd}: ${task.slice(0, 80)}`)

      const { execFileSync } = await import('child_process')
      try {
        const result = execFileSync(
          'claude',
          ['-p', task, '--output-format', 'text', '--max-turns', '20'],
          {
            cwd,
            timeout: 300000,
            encoding: 'utf-8',
            env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: 'apple-whatsapp' },
          },
        )
        // Truncate if too long for WhatsApp
        const output = result.trim()
        if (output.length > 3000) {
          return output.slice(0, 2900) + '\n\n... (输出已截断，共 ' + output.length + ' 字符)'
        }
        return output || '任务已执行完成，无输出。'
      } catch (err: any) {
        const stderr = err.stderr?.toString()?.slice(0, 500) || ''
        const stdout = err.stdout?.toString()?.slice(0, 500) || ''
        return `开发任务执行出错：\n${stderr || stdout || err.message}`
      }
    }

    default:
      return null
  }
}
