import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'

/**
 * GET /api/cron/commitment-check
 * Vercel Cron: runs every 6 hours.
 * Scans all users' overdue commitments and creates alerts.
 *
 * Escalation strategy:
 * - 1 day overdue → gentle reminder in alerts
 * - 3 days overdue → flag as urgent
 * - 7+ days overdue → critical, suggest action
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)

  // Find all overdue active commitments across all users
  const { data: overdueItems, error } = await admin
    .from('commitments')
    .select('id, user_id, type, contact_email, contact_name, title, deadline, last_nudge_at')
    .in('status', ['pending', 'in_progress', 'overdue'])
    .lt('deadline', todayISO)
    .order('due_date', { ascending: true })
    .limit(100)

  if (error || !overdueItems || overdueItems.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let processed = 0
  let escalationsGenerated = 0

  for (const item of overdueItems) {
    const daysOverdue = Math.ceil((now.getTime() - new Date(item.deadline).getTime()) / 86400000)

    // Determine escalation level
    let escalation: 'gentle' | 'urgent' | 'critical' = 'gentle'
    if (daysOverdue >= 7) escalation = 'critical'
    else if (daysOverdue >= 3) escalation = 'urgent'

    // Check if we already nudged recently (don't spam)
    if (item.last_nudge_at) {
      const hoursSinceNudge = (now.getTime() - new Date(item.last_nudge_at).getTime()) / 3600000
      // Gentle: nudge every 48h, Urgent: every 24h, Critical: every 12h
      const nudgeInterval = escalation === 'critical' ? 12 : escalation === 'urgent' ? 24 : 48
      if (hoursSinceNudge < nudgeInterval) continue
    }

    // Update last_nudge_at
    await admin.from('commitments').update({
      last_nudge_at: now.toISOString(),
    }).eq('id', item.id)

    // Smart Escalation: if 7+ days overdue AND already nudged before, generate AI suggestion
    if (daysOverdue >= 7 && item.last_nudge_at) {
      try {
        const { client: ai, model } = await createUserAIClient(item.user_id)

        // Optionally fetch contact importance
        let contactImportance = 'normal'
        if (item.contact_email) {
          const { data: contact } = await admin
            .from('contacts')
            .select('importance, name')
            .eq('user_id', item.user_id)
            .eq('email', item.contact_email)
            .single()
          if (contact?.importance) contactImportance = contact.importance
        }

        const contactName = item.contact_name || item.contact_email || 'the contact'

        const res = await ai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: `You are an AI chief of staff helping a busy professional manage commitments. Respond in the same language as the commitment title. Keep suggestions practical and actionable. Output plain text only, no JSON.`,
            },
            {
              role: 'user',
              content: `This commitment has been overdue for ${daysOverdue} days and I already nudged them before:
Title: "${item.title}"
Contact: ${contactName}
Contact importance: ${contactImportance}
Deadline was: ${item.deadline}

Suggest 2-3 alternative escalation approaches. Be concise (under 100 words total). Format as a numbered list.`,
            },
          ],
          temperature: 0.4,
          max_tokens: 300,
        })

        const suggestion = res.choices?.[0]?.message?.content
        if (suggestion) {
          // Fetch current description to append
          const { data: current } = await admin
            .from('commitments')
            .select('description')
            .eq('id', item.id)
            .single()

          const separator = '\n\n---ESCALATION---\n'
          const existingDesc = current?.description || ''
          // Replace any previous escalation suggestion
          const baseDesc = existingDesc.split('---ESCALATION---')[0].trimEnd()
          const newDesc = baseDesc
            ? `${baseDesc}${separator}${suggestion}`
            : `${separator}${suggestion}`

          await admin.from('commitments').update({
            description: newDesc,
          }).eq('id', item.id)
          escalationsGenerated++
        }
      } catch (escalationErr) {
        console.error('Escalation suggestion failed for commitment:', item.id, escalationErr)
        // Non-fatal, continue processing
      }
    }

    processed++
  }

  // --- Urgency score refresh for all users with overdue items ---
  let urgencyUpdated = 0
  const userIds = [...new Set(overdueItems.map(i => i.user_id))]

  for (const userId of userIds) {
    try {
      // Get all active commitments for this user
      const { data: commitments } = await admin
        .from('commitments')
        .select('id, type, contact_email, deadline, deadline_fuzzy, status, last_nudge_at, created_at, urgency_score')
        .eq('user_id', userId)
        .in('status', ['pending', 'in_progress', 'waiting', 'overdue'])

      if (!commitments || commitments.length === 0) continue

      // Get VIP contacts for this user
      const { data: vipContacts } = await admin
        .from('contacts')
        .select('email, importance')
        .eq('user_id', userId)
        .in('importance', ['vip', 'high'])

      const vipEmails = new Set((vipContacts || []).map(c => c.email))
      const scoreToday = new Date()
      scoreToday.setHours(0, 0, 0, 0)

      for (const c of commitments) {
        let score = 0

        // 1. Deadline proximity
        if (c.deadline) {
          const deadline = new Date(c.deadline)
          const daysLeft = Math.ceil((deadline.getTime() - scoreToday.getTime()) / 86400000)
          if (daysLeft < 0) {
            score += 5 + Math.min(Math.abs(daysLeft), 5)
            if (c.status !== 'overdue') {
              await admin.from('commitments').update({ status: 'overdue' }).eq('id', c.id)
            }
          } else if (daysLeft === 0) score += 4
          else if (daysLeft === 1) score += 3
          else if (daysLeft <= 3) score += 2
          else if (daysLeft <= 7) score += 1
        } else if (c.deadline_fuzzy) {
          const fuzzy = (c.deadline_fuzzy as string).toLowerCase()
          if (fuzzy.includes('asap') || fuzzy.includes('urgent') || fuzzy.includes('尽快')) score += 3
          else score += 1
        }

        // 2. VIP contact
        if (c.contact_email && vipEmails.has(c.contact_email)) score += 2

        // 3. Been nudged
        if (c.last_nudge_at) score += 2

        // 4. Age
        const ageInDays = Math.ceil((scoreToday.getTime() - new Date(c.created_at).getTime()) / 86400000)
        if (ageInDays > 14) score += 2
        else if (ageInDays > 7) score += 1

        // 5. Family commitments floor
        if (c.type === 'family') score = Math.max(score, 3)

        // 6. Cap
        score = Math.min(score, 10)

        if (score !== c.urgency_score) {
          await admin.from('commitments').update({ urgency_score: score }).eq('id', c.id)
          urgencyUpdated++
        }
      }
    } catch (scoreErr) {
      console.error('Urgency scoring failed for user:', userId, scoreErr)
    }
  }

  return NextResponse.json({
    processed,
    escalations_generated: escalationsGenerated,
    total_overdue: overdueItems.length,
    urgency_scores_updated: urgencyUpdated,
    breakdown: {
      gentle: overdueItems.filter(i => {
        const d = Math.ceil((now.getTime() - new Date(i.deadline).getTime()) / 86400000)
        return d < 3
      }).length,
      urgent: overdueItems.filter(i => {
        const d = Math.ceil((now.getTime() - new Date(i.deadline).getTime()) / 86400000)
        return d >= 3 && d < 7
      }).length,
      critical: overdueItems.filter(i => {
        const d = Math.ceil((now.getTime() - new Date(i.deadline).getTime()) / 86400000)
        return d >= 7
      }).length,
    },
  })
}
