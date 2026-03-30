import OpenAI from 'openai'

let _deepseek: OpenAI | null = null

export function getDeepseek(): OpenAI {
  if (!_deepseek) {
    _deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY!,
      baseURL: 'https://api.deepseek.com',
    })
  }
  return _deepseek
}

// Backward compat — lazy getter
export const deepseek = new Proxy({} as OpenAI, {
  get(_, prop) {
    return (getDeepseek() as any)[prop]
  },
})
