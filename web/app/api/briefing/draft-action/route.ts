import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'

/**
 * POST /api/briefing/draft-action
 * Generate a draft email for a briefing ACTION item.
 * Body: { person, title, deadline, note }
 *
 * Looks up the person in contacts, generates a contextual reply draft.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { person, title, deadline, note } = await request.json()
  if (!person || !title) {
    return NextResponse.json({ error: 'Missing person or title' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Look up contact by name (fuzzy match)
  const { data: contacts } = await admin
    .from('contacts')
    .select('id, name, email, company, relationship')
    .eq('user_id', user.id)
    .ilike('name', `%${person}%`)
    .limit(3)

  const contact = contacts?.[0] || null
  const toEmail = contact?.email || ''

  // Get user's profile for from email
  const { data: profile } = await admin
    .from('profiles')
    .select('email, display_name')
    .eq('id', user.id)
    .single()

  const fromEmail = profile?.email || user.email || ''
  const userName = profile?.display_name || 'Me'

  // Generate draft via AI
  try {
    const { client, model } = await createUserAIClient(user.id)
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a professional email assistant. Draft a concise, warm but direct email.
Output ONLY the email body — no subject line, no "Dear X" header (the user will see the To field separately).
Keep it under 100 words. Be natural, not robotic.
If the context mentions a deadline, acknowledge it.
Match the language of the context (Chinese or English).`,
        },
        {
          role: 'user',
          content: `Draft an email from ${userName} to ${person}${contact?.company ? ` (${contact.company})` : ''}.
Context: ${title}${deadline ? ` — deadline: ${deadline}` : ''}${note ? `. Note: ${note}` : ''}
Relationship: ${contact?.relationship || 'professional contact'}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    })

    const body = completion.choices[0]?.message?.content?.trim() || ''

    return NextResponse.json({
      draft: {
        to: toEmail,
        subject: `Re: ${title}`,
        body,
      },
      fromEmail,
    })
  } catch (err: any) {
    console.error('Draft generation failed:', err)
    return NextResponse.json(
      { error: 'Failed to generate draft', detail: err.message },
      { status: 500 }
    )
  }
}
