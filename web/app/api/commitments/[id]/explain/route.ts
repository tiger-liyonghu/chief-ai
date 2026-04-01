import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/commitments/:id/explain
 * 纲领原则#10: 可解释。Sophia做任何判断，用户可以问为什么。不是黑箱。
 *
 * Returns: why this commitment was extracted, source email, confidence reasoning.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Fetch commitment with source email
  const { data: commitment, error } = await admin
    .from('commitments')
    .select('id, type, sub_type, title, contact_name, contact_email, deadline, confidence, confidence_label, source_type, source_email_id, created_at, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !commitment) {
    return NextResponse.json({ error: 'Commitment not found' }, { status: 404 })
  }

  // Fetch source email if available
  let sourceEmail = null
  if (commitment.source_email_id) {
    const { data: email } = await admin
      .from('emails')
      .select('subject, from_name, from_address, snippet, received_at')
      .eq('id', commitment.source_email_id)
      .single()
    sourceEmail = email
  }

  // Fetch feedback history
  const { data: feedback } = await admin
    .from('commitment_feedback')
    .select('feedback_type, created_at')
    .eq('commitment_id', id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Build explanation
  const directionLabel = commitment.type === 'i_promised'
    ? '你承诺了对方'
    : commitment.type === 'they_promised'
      ? '对方承诺了你'
      : '家庭承诺'

  const confidenceExplanation = {
    confirmed: '非常明确的承诺，有清晰的交付物和时间',
    likely: '较明确的承诺，但有一定模糊性',
    tentative: '模糊的承诺，可能是客套或附条件的',
    unlikely: '不太可能是真正的承诺',
  }

  const subTypeLabel = {
    promise: '任务承诺',
    debt: '人情债',
    investment: '关系投资',
    signal: '优先级信号',
  }

  return NextResponse.json({
    commitment_id: commitment.id,
    explanation: {
      direction: directionLabel,
      sub_type: subTypeLabel[commitment.sub_type as keyof typeof subTypeLabel] || '承诺',
      confidence: commitment.confidence,
      confidence_label: commitment.confidence_label,
      confidence_reason: confidenceExplanation[commitment.confidence_label as keyof typeof confidenceExplanation] || '标准置信度',
      source: commitment.source_type === 'email'
        ? `从邮件中提取: "${sourceEmail?.subject || '未知主题'}"`
        : commitment.source_type === 'manual'
          ? '手动创建'
          : `从${commitment.source_type}中提取`,
      extracted_at: commitment.created_at,
    },
    source_email: sourceEmail ? {
      subject: sourceEmail.subject,
      from: sourceEmail.from_name || sourceEmail.from_address,
      snippet: sourceEmail.snippet,
      date: sourceEmail.received_at,
    } : null,
    feedback_history: (feedback || []).map((f: any) => ({
      action: f.feedback_type,
      date: f.created_at,
    })),
  })
}
