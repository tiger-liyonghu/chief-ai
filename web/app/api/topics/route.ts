/**
 * Topics API — 跨渠道事项聚合
 *
 * GET  /api/topics          — 列出用户的 Topics
 * GET  /api/topics?id=xxx   — 获取单个 Topic 详情（含 Signal 时间线）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const topicId = req.nextUrl.searchParams.get('id')

  // ── Single topic detail ──
  if (topicId) {
    const { data: topic, error } = await admin
      .from('topics')
      .select('*')
      .eq('id', topicId)
      .eq('user_id', user.id)
      .single()

    if (error || !topic) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Fetch signal timeline
    const { data: topicSignals } = await admin
      .from('topic_signals')
      .select('signal_channel, signal_id, role, created_at')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true })

    // Resolve signals to actual data
    const timeline: Array<{
      channel: string
      role: string
      timestamp: string
      sender: string | null
      title: string | null
      preview: string | null
    }> = []

    for (const ts of topicSignals || []) {
      if (ts.signal_channel === 'email') {
        const { data: email } = await admin
          .from('emails')
          .select('from_name, from_address, subject, snippet, received_at')
          .eq('id', ts.signal_id)
          .single()
        if (email) {
          timeline.push({
            channel: 'email',
            role: ts.role,
            timestamp: email.received_at,
            sender: email.from_name || email.from_address,
            title: email.subject,
            preview: email.snippet,
          })
        }
      } else if (ts.signal_channel === 'whatsapp') {
        const { data: msg } = await admin
          .from('whatsapp_messages')
          .select('from_name, from_number, body, received_at')
          .eq('id', ts.signal_id)
          .single()
        if (msg) {
          timeline.push({
            channel: 'whatsapp',
            role: ts.role,
            timestamp: msg.received_at,
            sender: msg.from_name || msg.from_number,
            title: null,
            preview: msg.body,
          })
        }
      }
    }

    // Fetch linked commitments
    const { data: commitments } = await admin
      .from('commitments')
      .select('id, type, title, deadline, status, urgency_score, contact_name')
      .eq('topic_id', topicId)
      .order('urgency_score', { ascending: false })

    return NextResponse.json({
      ...topic,
      timeline,
      commitments: commitments || [],
    })
  }

  // ── List topics ──
  const status = req.nextUrl.searchParams.get('status') || 'active'
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50')

  const { data: topics, error } = await admin
    .from('topics')
    .select('*, commitments:commitments(count)')
    .eq('user_id', user.id)
    .eq('status', status)
    .order('last_signal_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(topics || [])
}
