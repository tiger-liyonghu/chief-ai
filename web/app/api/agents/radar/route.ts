import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Urgency = 'critical' | 'high' | 'medium'

interface Signal {
  type: string
  urgency: Urgency
  title: string
  detail: string
  action_url: string
  source: { module: string; id: string }
}

// ─── GET /api/agents/radar ───────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const signals: Signal[] = []
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString()

  // Run all queries in parallel
  const [
    overdueResult,
    vipEmailsResult,
    calendarResult,
    whatsappResult,
    normalEmailsResult,
  ] = await Promise.all([
    // 1. Overdue commitments
    supabase
      .from('follow_ups')
      .select('id, title, detail, due_date, contact_name')
      .eq('user_id', user.id)
      .eq('type', 'i_promised')
      .eq('status', 'active')
      .lt('due_date', today)
      .order('due_date', { ascending: true })
      .limit(20),

    // 2. VIP unreplied emails (join via contact email)
    supabase
      .from('emails')
      .select('id, subject, from_name, from_email, received_at, snippet')
      .eq('user_id', user.id)
      .eq('is_reply_needed', true)
      .order('received_at', { ascending: false })
      .limit(100),

    // 3. Calendar events in next 24h for conflict detection
    supabase
      .from('calendar_events')
      .select('id, title, start_time, end_time')
      .eq('user_id', user.id)
      .gte('start_time', today)
      .lte('start_time', new Date(Date.now() + 7 * 86400000).toISOString())
      .order('start_time', { ascending: true })
      .limit(100),

    // 4. WhatsApp inbound last 24h
    supabase
      .from('whatsapp_messages')
      .select('id, from_number, from_name, body, received_at')
      .eq('user_id', user.id)
      .eq('direction', 'inbound')
      .gte('received_at', yesterday)
      .order('received_at', { ascending: false })
      .limit(20),

    // 5. Normal unreplied emails (urgency >= 2)
    // We already fetch all is_reply_needed emails above; we'll split by VIP below
    supabase
      .from('contacts')
      .select('email, importance')
      .eq('user_id', user.id)
      .eq('importance', 'vip')
      .limit(500),
  ])

  // ── 1. Overdue commitments → critical ──────────────────────────────────────

  if (overdueResult.data) {
    for (const fu of overdueResult.data) {
      const dueDate = new Date(fu.due_date)
      const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / 86400000)
      const overdueTxt = daysOverdue === 1 ? 'Due yesterday' : `${daysOverdue} days overdue`

      signals.push({
        type: 'overdue_commitment',
        urgency: 'critical',
        title: `You promised${fu.contact_name ? ` ${fu.contact_name}` : ''}: ${fu.title}`,
        detail: `${overdueTxt}.${fu.detail ? ` ${fu.detail}` : ''}`,
        action_url: '/dashboard/follow-ups',
        source: { module: 'follow_ups', id: fu.id },
      })
    }
  }

  // ── 2 & 5. Emails: split VIP vs normal ────────────────────────────────────

  const vipEmails = new Set(
    (normalEmailsResult.data || []).map(c => c.email?.toLowerCase())
  )

  if (vipEmailsResult.data) {
    for (const email of vipEmailsResult.data) {
      const senderEmail = email.from_email?.toLowerCase() || ''
      const isVip = vipEmails.has(senderEmail)

      if (isVip) {
        signals.push({
          type: 'vip_unreplied_email',
          urgency: 'high',
          title: `VIP unreplied: ${email.from_name || email.from_email}`,
          detail: email.subject || email.snippet || 'No subject',
          action_url: `/dashboard/emails/${email.id}`,
          source: { module: 'emails', id: email.id },
        })
      } else {
        signals.push({
          type: 'unreplied_email',
          urgency: 'medium',
          title: `Unreplied: ${email.from_name || email.from_email}`,
          detail: email.subject || email.snippet || 'No subject',
          action_url: `/dashboard/emails/${email.id}`,
          source: { module: 'emails', id: email.id },
        })
      }
    }
  }

  // ── 3. Calendar conflicts → high ──────────────────────────────────────────

  if (calendarResult.data && calendarResult.data.length >= 2) {
    const events = calendarResult.data
    for (let i = 0; i < events.length - 1; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const a = events[i]
        const b = events[j]
        const aEnd = new Date(a.end_time).getTime()
        const bStart = new Date(b.start_time).getTime()
        const aStart = new Date(a.start_time).getTime()
        const bEnd = new Date(b.end_time).getTime()

        // Overlap: A starts before B ends AND B starts before A ends
        if (aStart < bEnd && bStart < aEnd) {
          signals.push({
            type: 'calendar_conflict',
            urgency: 'high',
            title: `Conflict: "${a.title}" overlaps "${b.title}"`,
            detail: `${new Date(a.start_time).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} - check your calendar.`,
            action_url: '/dashboard/calendar',
            source: { module: 'calendar_events', id: a.id },
          })
        }
      }
    }
  }

  // ── 4. WhatsApp unread → medium ───────────────────────────────────────────

  if (whatsappResult.data) {
    for (const msg of whatsappResult.data) {
      signals.push({
        type: 'whatsapp_unread',
        urgency: 'medium',
        title: `WhatsApp from ${msg.from_name || msg.from_number}`,
        detail: msg.body?.substring(0, 120) || 'New message',
        action_url: '/dashboard/whatsapp',
        source: { module: 'whatsapp_messages', id: msg.id },
      })
    }
  }

  // ── Sort by urgency ───────────────────────────────────────────────────────

  const urgencyOrder: Record<Urgency, number> = { critical: 0, high: 1, medium: 2 }
  signals.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

  // ── Summary ───────────────────────────────────────────────────────────────

  const summary = {
    critical: signals.filter(s => s.urgency === 'critical').length,
    high: signals.filter(s => s.urgency === 'high').length,
    medium: signals.filter(s => s.urgency === 'medium').length,
  }

  return NextResponse.json({ signals, summary })
}
