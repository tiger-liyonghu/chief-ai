import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createUserAIClient } from '@/lib/ai/unified-client'

/**
 * POST /api/trips/recommend
 * Get dining/experience recommendations for a trip destination.
 *
 * Body: { city: string, country?: string, meal_type?: string, business_meal?: boolean, dietary?: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { city, country, meal_type, business_meal, dietary } = await request.json()
  if (!city) return NextResponse.json({ error: 'city required' }, { status: 400 })

  const { client, model } = await createUserAIClient(user.id)

  const stream = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `You are a local dining and experience guide for business travelers. Given a city, recommend 3-5 specific restaurants or experiences. For each recommendation, provide:
- Name of the place
- Cuisine type or experience type
- Price range ($ to $$$$)
- Why it's good for this occasion
- Location/area within the city
- One practical tip (reservation needed? dress code? best dishes?)

Be specific — real place names, not generic advice. If you're not confident about a specific place existing, say so. Format as a natural, conversational list. Write in English unless the user's context suggests another language.`,
      },
      {
        role: 'user',
        content: `City: ${city}${country ? `, ${country}` : ''}
${meal_type ? `Meal type: ${meal_type}` : 'General dining recommendations'}
${business_meal ? 'This is for a business meal — professional atmosphere preferred' : ''}
${dietary ? `Dietary preferences: ${dietary}` : ''}`,
      },
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 800,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || ''
        if (text) controller.enqueue(encoder.encode(text))
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
