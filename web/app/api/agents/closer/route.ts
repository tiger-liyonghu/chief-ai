import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'

/**
 * POST /api/agents/closer
 * Closer Agent — scans overdue commitments and generates escalation drafts.
 * Can also be called by cron for automatic processing.
 *
 * Returns generated drafts for user approval (human-in-the-loop).
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)

  // Find overdue commitments that haven't been nudged recently (>48h since last nudge)
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

  const { data: overdueItems, error } = await admin
    .from('commitments')
    .select('id, type, contact_email, contact_name, title, description, deadline, last_nudge_at, source_email_id')
    .eq('user_id', user.id)
    .in('status', ['pending', 'in_progress', 'overdue'])
    .lte('deadline', todayISO)
    .or(`last_nudge_at.is.null,last_nudge_at.lt.${twoDaysAgo}`)
    .order('deadline', { ascending: true })
    .limit(10)

  if (error || !overdueItems || overdueItems.length === 0) {
    return NextResponse.json({ drafts: [], message: 'No overdue items to follow up on' })
  }

  // Get contact profiles for context
  const contactEmails = [...new Set(overdueItems.map(i => i.contact_email).filter(Boolean))]
  const { data: contacts } = await admin
    .from('contacts')
    .select('email, name, company, relationship, importance')
    .eq('user_id', user.id)
    .in('email', contactEmails)

  const contactMap = new Map<string, any>()
  for (const c of contacts || []) {
    contactMap.set(c.email.toLowerCase(), c)
  }

  // Generate follow-up drafts
  const { client, model } = await createUserAIClient(user.id)
  const drafts: any[] = []

  for (const item of overdueItems) {
    try {
      const contact = contactMap.get((item.contact_email || '').toLowerCase())
      const daysOverdue = Math.ceil((now.getTime() - new Date(item.deadline).getTime()) / 86400000)

      // Determine escalation level
      let escalation: 'gentle' | 'firm' | 'urgent' = 'gentle'
      if (daysOverdue > 7) escalation = 'urgent'
      else if (daysOverdue > 3) escalation = 'firm'

      const isMyPromise = item.type === 'i_promised'

      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `You are Closer, an AI follow-up agent. Generate a brief follow-up message.

Rules:
- ${isMyPromise ? 'The USER promised this to the contact. Draft an apology + delivery message.' : 'The contact owes the user. Draft a polite nudge.'}
- Escalation level: ${escalation} (${daysOverdue} days overdue)
- Keep it to 2-3 sentences max
- Be professional but human
- Detect language from the title/description and respond in same language
- For "gentle": casual reminder
- For "firm": reference the original deadline
- For "urgent": express concern about timeline impact`,
          },
          {
            role: 'user',
            content: `Contact: ${contact?.name || item.contact_name || item.contact_email} (${contact?.relationship || 'unknown'}, ${contact?.company || ''})
Title: ${item.title}
Description: ${item.description || 'N/A'}
Deadline: ${item.deadline}
Days overdue: ${daysOverdue}
Type: ${isMyPromise ? 'I promised them' : 'They owe me'}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 200,
      })

      const draft = completion.choices[0]?.message?.content?.trim()
      if (draft) {
        drafts.push({
          commitment_id: item.id,
          contact_email: item.contact_email,
          contact_name: contact?.name || item.contact_name || item.contact_email,
          title: item.title,
          type: item.type,
          days_overdue: daysOverdue,
          escalation,
          draft,
          suggested_channel: daysOverdue > 5 ? 'whatsapp' : 'email',
        })

        // Mark as nudged
        await admin.from('commitments').update({
          last_nudge_at: now.toISOString(),
        }).eq('id', item.id)
      }
    } catch (err) {
      console.error(`Closer: failed to generate draft for ${item.id}:`, err)
    }
  }

  return NextResponse.json({
    drafts,
    summary: {
      total_overdue: overdueItems.length,
      drafts_generated: drafts.length,
      escalation_breakdown: {
        gentle: drafts.filter(d => d.escalation === 'gentle').length,
        firm: drafts.filter(d => d.escalation === 'firm').length,
        urgent: drafts.filter(d => d.escalation === 'urgent').length,
      },
    },
  })
}

/**
 * GET /api/agents/closer
 * Returns current overdue stats without generating drafts.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const todayISO = new Date().toISOString().slice(0, 10)

  const { count: overdueCount } = await supabase
    .from('commitments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['pending', 'in_progress', 'overdue'])
    .lte('deadline', todayISO)

  const { count: myPromisesOverdue } = await supabase
    .from('commitments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['pending', 'in_progress', 'overdue'])
    .eq('type', 'i_promised')
    .lte('deadline', todayISO)

  return NextResponse.json({
    overdue_total: overdueCount || 0,
    my_promises_overdue: myPromisesOverdue || 0,
    they_promised_overdue: (overdueCount || 0) - (myPromisesOverdue || 0),
  })
}
