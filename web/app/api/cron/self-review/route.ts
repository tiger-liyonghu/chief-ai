import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserAIClient } from '@/lib/ai/unified-client'
import { SOPHIE_SELF_REVIEW_SYSTEM } from '@/lib/ai/prompts/sophie-voice'

/**
 * GET /api/cron/self-review
 * Vercel Cron: runs every 8 hours.
 *
 * Sophie 的复盘引擎：用推理模型重新审视最近提取的承诺。
 * - 对了 → 沉默
 * - 错了 → 修改数据库 + 通过 WhatsApp 通知用户
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()

  // Find all commitments created in the last 8 hours across all users
  const { data: recentCommitments, error } = await admin
    .from('commitments')
    .select('id, user_id, type, title, contact_name, contact_email, deadline, status, source_email_id, confidence, created_at')
    .gte('created_at', eightHoursAgo)
    .in('status', ['pending', 'in_progress', 'overdue'])
    .order('created_at', { ascending: false })
    .limit(50)

  if (error || !recentCommitments || recentCommitments.length === 0) {
    return NextResponse.json({ reviewed: 0, message: 'No recent commitments to review' })
  }

  // Group by user
  const byUser = new Map<string, typeof recentCommitments>()
  for (const c of recentCommitments) {
    const existing = byUser.get(c.user_id) || []
    existing.push(c)
    byUser.set(c.user_id, existing)
  }

  let totalReviewed = 0
  let totalFixed = 0
  let totalDeleted = 0
  const corrections: Array<{ userId: string; message: string }> = []

  for (const [userId, commitments] of byUser) {
    try {
      // Fetch source emails for these commitments
      const emailIds = commitments
        .map(c => c.source_email_id)
        .filter(Boolean)

      let emailMap = new Map<string, any>()
      if (emailIds.length > 0) {
        const { data: emails } = await admin
          .from('emails')
          .select('id, subject, from_address, to_address, body_text, date')
          .in('id', emailIds)

        for (const e of emails || []) {
          emailMap.set(e.id, e)
        }
      }

      // Build review prompt with actual email content
      const reviewItems = commitments.map(c => {
        const email = c.source_email_id ? emailMap.get(c.source_email_id) : null
        return {
          commitment_id: c.id,
          type: c.type,
          title: c.title,
          contact_name: c.contact_name,
          contact_email: c.contact_email,
          deadline: c.deadline,
          confidence: c.confidence,
          source_email: email ? {
            subject: email.subject,
            from: email.from_address,
            to: email.to_address,
            date: email.date,
            body: (email.body_text || '').slice(0, 2000), // Limit to 2000 chars
          } : null,
        }
      })

      // Call reasoning model for deep review
      const { client: ai } = await createUserAIClient(userId)

      const res = await ai.chat.completions.create({
        model: 'deepseek-reasoner',
        messages: [
          { role: 'system', content: SOPHIE_SELF_REVIEW_SYSTEM },
          {
            role: 'user',
            content: `请复核以下 ${reviewItems.length} 个承诺：\n\n${JSON.stringify(reviewItems, null, 2)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      })

      const reviewResult = res.choices?.[0]?.message?.content
      if (!reviewResult) continue

      // Parse review result
      let verdicts: any[] = []
      try {
        // Try to parse as JSON — might be wrapped in code block
        const jsonMatch = reviewResult.match(/\[[\s\S]*\]/) || reviewResult.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.all_correct) {
            totalReviewed += commitments.length
            continue // All correct, stay silent
          }
          verdicts = Array.isArray(parsed) ? parsed : [parsed]
        }
      } catch {
        // If JSON parse fails, skip this user
        console.error(`[Self-Review] Failed to parse review result for user ${userId}`)
        continue
      }

      // Process verdicts
      const userCorrections: string[] = []

      for (const verdict of verdicts) {
        if (!verdict.commitment_id || verdict.verdict === 'correct') continue

        const commitment = commitments.find(c => c.id === verdict.commitment_id)
        if (!commitment) continue

        if (verdict.verdict === 'should_delete') {
          // Delete false positive
          await admin.from('commitments').delete().eq('id', verdict.commitment_id)
          totalDeleted++

          // Log as feedback for learning
          await admin.from('commitment_feedback').upsert({
            user_id: userId,
            commitment_id: verdict.commitment_id,
            feedback_type: 'rejected',
            original_title: commitment.title,
            llm_confidence: commitment.confidence,
            llm_rejected_reason: `Self-review: ${(verdict.issues || []).join('; ')}`,
          }, { onConflict: 'commitment_id' })

          userCorrections.push(
            `「${commitment.title}」不是承诺，已删除。${verdict.issues?.[0] ? `（${verdict.issues[0]}）` : ''}`
          )
        } else if (verdict.verdict === 'needs_fix' && verdict.fix) {
          // Apply fix
          const updates: Record<string, any> = { updated_at: new Date().toISOString() }
          for (const [field, value] of Object.entries(verdict.fix)) {
            if (['title', 'deadline', 'type', 'contact_name', 'contact_email', 'status'].includes(field)) {
              updates[field] = value
            }
          }

          if (Object.keys(updates).length > 1) { // > 1 because updated_at is always there
            await admin.from('commitments').update(updates).eq('id', verdict.commitment_id)
            totalFixed++

            const fixDesc = verdict.issues?.[0] || '信息有误'
            userCorrections.push(`「${commitment.title}」${fixDesc}，已更正。`)
          }
        }

        totalReviewed++
      }

      // Send WhatsApp notification if there were corrections
      if (userCorrections.length > 0) {
        const message = `🍎 复核了最近的承诺，有 ${userCorrections.length} 处修正：\n\n${userCorrections.join('\n')}`
        corrections.push({ userId, message })

        // Store correction for next briefing (in case WhatsApp is not connected)
        await admin.from('alerts').insert({
          user_id: userId,
          type: 'self_review_correction',
          title: `复核修正 ${userCorrections.length} 处`,
          body: message,
          severity: 'info',
        })
      }
    } catch (err) {
      console.error(`[Self-Review] Error reviewing user ${userId}:`, err)
    }
  }

  // Send WhatsApp notifications for corrections
  for (const { userId, message } of corrections) {
    try {
      const { data: waConn } = await admin
        .from('whatsapp_connections')
        .select('phone_number')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      if (waConn) {
        // Dynamic import to avoid circular dependency
        const { getConnection } = await import('@/lib/whatsapp/client')
        const sock = getConnection(userId)
        if (sock) {
          const selfJid = `${waConn.phone_number}@s.whatsapp.net`
          await sock.sendMessage(selfJid, { text: message })
        }
      }
    } catch (err) {
      console.error(`[Self-Review] Failed to send WhatsApp notification to ${userId}:`, err)
    }
  }

  return NextResponse.json({
    reviewed: totalReviewed,
    fixed: totalFixed,
    deleted: totalDeleted,
    notifications_sent: corrections.length,
  })
}
