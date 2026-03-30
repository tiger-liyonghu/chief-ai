/**
 * Browser automation tool — Apple can open headless Chrome to search for info,
 * check websites, look up flights/hotels, and take screenshots.
 */

import { ToolModule, ToolContext, getLLMClient } from './types'

export const definitions: ToolModule['definitions'] = [
  {
    type: 'function',
    function: {
      name: 'browse_web',
      description: '打开浏览器查看网页内容。可以用来查航班信息、酒店评价、公司官网、新闻等。',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '要访问的网址' },
          search_query: { type: 'string', description: '如果没有具体网址，提供搜索关键词，Apple会用Google搜索' },
          extract: { type: 'string', description: '要从页面提取什么信息（如"航班价格"、"酒店评分"、"公司简介"）' },
        },
      },
    },
  },
]

export async function execute(ctx: ToolContext, name: string, args: any): Promise<string | null> {
  if (name !== 'browse_web') return null

  try {
    let url = args.url
    if (!url && args.search_query) {
      url = `https://www.google.com/search?q=${encodeURIComponent(args.search_query)}`
    }
    if (!url) return '请提供网址或搜索关键词。'

    console.log(`[Apple] Browsing: ${url}`)

    // Use fetch for simple page content extraction
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return `网页请求失败：${res.status} ${res.statusText}`

    const html = await res.text()

    // Extract text content (strip HTML tags)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000)

    // If user wants specific extraction, use LLM to parse
    if (args.extract) {
      const client = getLLMClient()
      const completion = await client.chat.completions.create({
        model: process.env.LLM_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个网页内容提取助手。从给定的网页文本中提取用户要求的信息。只输出提取的信息，简洁明了。' },
          { role: 'user', content: `网址: ${url}\n\n要提取: ${args.extract}\n\n网页内容:\n${textContent}` },
        ],
        temperature: 0.2,
        max_tokens: 500,
      })
      return completion.choices[0]?.message?.content?.trim() || '无法提取信息。'
    }

    return `网页内容（${url}）：\n${textContent.slice(0, 2000)}`
  } catch (err: any) {
    if (err.name === 'AbortError') return '网页加载超时（15秒）。'
    return `浏览失败：${err.message}`
  }
}
