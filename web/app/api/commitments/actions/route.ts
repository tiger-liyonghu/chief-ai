import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'

/**
 * Commitment Actions — one-click operations on commitments.
 * Actions: draft_reply, send_nudge, postpone, mark_done, escalate
 */

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, action, ...params } = await req.json()
  if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })

  // Get the commitment
  const { data: commitment, error } = await supabase
    .from('commitments')
    .select('*, contacts(id, name, company, email, importance)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !commitment) return NextResponse.json({ error: 'Commitment not found' }, { status: 404 })

  // Resolve the user's primary email for the "from" field
  const admin = createAdminClient()
  const { data: firstAccount } = await admin
    .from('google_accounts')
    .select('google_email')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  const fromEmail = firstAccount?.google_email || null

  switch (action) {
    case 'mark_done': {
      await supabase.from('commitments').update({
        status: 'done',
        completed_at: new Date().toISOString(),
      }).eq('id', id)
      return NextResponse.json({ success: true, action: 'mark_done' })
    }

    case 'postpone': {
      const days = params.days || 7
      const newDeadline = new Date()
      newDeadline.setDate(newDeadline.getDate() + days)

      await supabase.from('commitments').update({
        deadline: newDeadline.toISOString().split('T')[0],
        status: 'pending', // reset from overdue
      }).eq('id', id)

      // If they_promised type, generate a "checking in" draft
      if (commitment.type === 'they_promised' && commitment.contact_email) {
        const draft = await generateDraft(
          user.id, commitment,
          `Generate a brief, polite email checking in about: "${commitment.title}". Mention you've moved the deadline. Keep it under 3 sentences.`
        )
        return NextResponse.json({ success: true, action: 'postpone', draft })
      }

      return NextResponse.json({ success: true, action: 'postpone', new_deadline: newDeadline.toISOString().split('T')[0] })
    }

    case 'draft_reply': {
      const draft = await generateDraft(
        user.id, commitment,
        `Generate a brief email to fulfill this commitment: "${commitment.title}".
        The email should be professional but warm. Keep it concise.
        ${commitment.description ? `Context: ${commitment.description}` : ''}`
      )
      return NextResponse.json({ success: true, action: 'draft_reply', draft, fromEmail })
    }

    case 'send_nudge': {
      // Determine escalation level
      let daysWaiting = 0
      if (commitment.created_at) {
        daysWaiting = Math.ceil((Date.now() - new Date(commitment.created_at).getTime()) / 86400000)
      }

      let tone = 'gentle'
      if (daysWaiting > 7) tone = 'firm'
      if (daysWaiting > 14) tone = 'urgent'

      const draft = await generateDraft(
        user.id, commitment,
        `Generate a ${tone} follow-up email about: "${commitment.title}".
        They promised this ${daysWaiting} days ago.
        ${tone === 'gentle' ? 'Be friendly and assume they\'re busy.' : ''}
        ${tone === 'firm' ? 'Be direct but professional. Mention the timeline.' : ''}
        ${tone === 'urgent' ? 'Be clear this is urgent and needs immediate attention.' : ''}
        Keep it under 4 sentences.`
      )

      // Update last_nudge_at
      await supabase.from('commitments').update({
        last_nudge_at: new Date().toISOString(),
      }).eq('id', id)

      return NextResponse.json({ success: true, action: 'send_nudge', draft, tone, fromEmail })
    }

    case 'escalate': {
      // Mark as escalated and suggest alternative approaches
      const draft = await generateDraft(
        user.id, commitment,
        `This commitment has been outstanding too long: "${commitment.title}".
        Generate two things:
        1. A direct email to the person asking for a definitive timeline
        2. A brief suggestion of alternative approaches if they can't deliver
        Keep it professional but firm.`
      )
      return NextResponse.json({ success: true, action: 'escalate', draft, fromEmail })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}

async function generateDraft(
  userId: string,
  commitment: Record<string, unknown>,
  prompt: string
): Promise<{ to: string; subject: string; body: string } | null> {
  try {
    const { client: ai, model } = await createUserAIClient(userId)

    const contactName = (commitment.contacts as Record<string, string>)?.name || commitment.contact_name || commitment.contact_email
    const contactEmail = commitment.contact_email as string

    const res = await ai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are drafting an email for a business professional.
The recipient is: ${contactName} <${contactEmail}>
Respond in JSON: { "subject": "...", "body": "..." }
Match the language of the commitment title (English or Chinese).`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const content = res.choices?.[0]?.message?.content
    if (!content) return null

    const parsed = JSON.parse(content)
    return {
      to: contactEmail,
      subject: parsed.subject || `Re: ${commitment.title}`,
      body: parsed.body || '',
    }
  } catch {
    return null
  }
}
