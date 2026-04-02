import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCoolingContacts } from '@/lib/signals/query'
import { shouldNotify } from '@/lib/scheduler/should-notify'
import { wasNotificationSent, markNotificationSent } from '@/lib/whatsapp/notification-log'

/**
 * GET /api/cron/weaver-push
 * Daily relationship cooling alert. Runs once per morning.
 *
 * Manifesto: "Kevin 一个月没联系了 → Sophia 告诉你关系在冷却"
 *
 * Only pushes for contacts with role "client" or "vip" —
 * not every acquaintance deserves a nudge.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const todayISO = new Date().toISOString().slice(0, 10)

  // Get all onboarded users
  const { data: users } = await admin
    .from('profiles')
    .select('id')
    .not('onboarding_completed_at', 'is', null)
    .limit(100)

  if (!users || users.length === 0) {
    return NextResponse.json({ processed: 0, pushed: 0 })
  }

  let totalPushed = 0

  for (const user of users) {
    try {
      // Check if we should notify this user right now
      const decision = await shouldNotify(admin, user.id, 'medium', 'relationship_cooling')
      if (!decision.allowed) continue

      // Get cooling contacts (clients and VIPs only)
      const cooling = await getCoolingContacts(admin, user.id, {
        threshold: 40,
        rolesFilter: ['client', 'vip'],
        limit: 5,
      })

      if (cooling.length === 0) continue

      // Filter out already-notified today
      const unsent = []
      for (const c of cooling) {
        const sent = await wasNotificationSent(user.id, 'relationship_cooling', c.id, todayISO)
        if (!sent) unsent.push(c)
      }
      if (unsent.length === 0) continue

      // Push via WhatsApp
      const pushed = await pushCoolingAlert(user.id, unsent)

      // Mark as sent
      for (const c of unsent) {
        await markNotificationSent(user.id, 'relationship_cooling', c.id, todayISO)
      }

      totalPushed += pushed ? unsent.length : 0

      // ─── Policy renewal reminders (insurance vertical) ───
      const in45days = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10)
      const { data: expiringPolicies } = await admin
        .from('policies')
        .select('id, contact_name, contact_email, product_type, expiry_date, policy_number')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .lte('expiry_date', in45days)
        .gte('expiry_date', todayISO)
        .order('expiry_date')
        .limit(5)

      if (expiringPolicies && expiringPolicies.length > 0) {
        const unsentPolicies = []
        for (const p of expiringPolicies) {
          const sent = await wasNotificationSent(user.id, 'policy_renewal', p.id, todayISO)
          if (!sent) unsentPolicies.push(p)
        }
        if (unsentPolicies.length > 0) {
          await pushPolicyRenewalAlert(user.id, unsentPolicies)
          for (const p of unsentPolicies) {
            await markNotificationSent(user.id, 'policy_renewal', p.id, todayISO)
          }
          totalPushed += unsentPolicies.length
        }
      }
      // ─── Family date reminders (birthday, anniversary, exam) ───
      const { data: upcomingFamily } = await admin
        .from('family_calendar')
        .select('id, title, start_date, event_type, family_member, remind_days_before')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .in('event_type', ['important_date', 'hard_constraint'])

      if (upcomingFamily && upcomingFamily.length > 0) {
        const remindable = upcomingFamily.filter(fe => {
          const remindDays = fe.remind_days_before || 3
          const eventDate = new Date(fe.start_date)
          const remindDate = new Date(eventDate.getTime() - remindDays * 86400000)
          const today = new Date(todayISO)
          // Remind if today is the reminder date (or within 1 day of it)
          return today >= remindDate && today < eventDate

          // Also handle yearly recurring (birthday, anniversary)
        }).filter(fe => {
          // Check recurrence
          if (fe.event_type === 'important_date') {
            // Yearly events: check month+day match within remind window
            const ed = new Date(fe.start_date)
            const today = new Date(todayISO)
            const thisYearDate = new Date(today.getFullYear(), ed.getMonth(), ed.getDate())
            const remindDays = fe.remind_days_before || 3
            const remindDate = new Date(thisYearDate.getTime() - remindDays * 86400000)
            return today >= remindDate && today < thisYearDate
          }
          return true
        })

        const unsentFamily = []
        for (const fe of remindable) {
          const sent = await wasNotificationSent(user.id, 'family_reminder', fe.id, todayISO)
          if (!sent) unsentFamily.push(fe)
        }

        if (unsentFamily.length > 0) {
          await pushFamilyReminder(user.id, unsentFamily)
          for (const fe of unsentFamily) {
            await markNotificationSent(user.id, 'family_reminder', fe.id, todayISO)
          }
          totalPushed += unsentFamily.length
        }
      }
    } catch (err) {
      console.error(`[Weaver Push] Error for user ${user.id}:`, err)
    }
  }

  return NextResponse.json({ processed: users.length, pushed: totalPushed })
}

async function pushFamilyReminder(
  userId: string,
  events: Array<{ title: string; start_date: string; family_member: string | null; event_type: string }>,
): Promise<boolean> {
  try {
    const { getConnection } = await import('@/lib/whatsapp/client')
    const sock = getConnection(userId)
    if (!sock?.user) return false

    const myNumber = sock.user.id.split(':')[0]
    const myLid = sock.user.lid?.split(':')[0]
    const selfJid = myLid ? `${myLid}@lid` : `${myNumber}@s.whatsapp.net`

    const lines = events.map(fe => {
      const daysUntil = Math.ceil((new Date(fe.start_date).getTime() - Date.now()) / 86400000)
      const member = fe.family_member ? ` (${fe.family_member})` : ''
      return `  💗 ${fe.title}${member} — ${daysUntil === 0 ? 'today!' : `in ${daysUntil} days`}`
    })

    const text = [
      '🏠 Family Reminder',
      '',
      ...lines,
      '',
      '━━━',
      "Don't forget what matters most.",
    ].join('\n')

    await sock.sendMessage(selfJid, { text })
    return true
  } catch {
    return false
  }
}

async function pushPolicyRenewalAlert(
  userId: string,
  policies: Array<{ contact_name: string; product_type: string; expiry_date: string; policy_number: string | null }>,
): Promise<boolean> {
  try {
    const { getConnection } = await import('@/lib/whatsapp/client')
    const sock = getConnection(userId)
    if (!sock?.user) return false

    const myNumber = sock.user.id.split(':')[0]
    const myLid = sock.user.lid?.split(':')[0]
    const selfJid = myLid ? `${myLid}@lid` : `${myNumber}@s.whatsapp.net`

    const lines = policies.map(p => {
      const daysLeft = Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / 86400000)
      return `  ${p.contact_name || 'Unknown'} — ${p.product_type} ${p.policy_number ? `(${p.policy_number})` : ''} — ${daysLeft} days left`
    })

    const text = [
      '📋 Policy Renewal Reminders',
      '',
      ...lines,
      '',
      '━━━',
      'Time to reach out about renewal.',
    ].join('\n')

    await sock.sendMessage(selfJid, { text })
    return true
  } catch {
    return false
  }
}

async function pushCoolingAlert(
  userId: string,
  contacts: Array<{ name: string; daysSinceContact: number; importance: string; temperature: { score: number; label: string } }>,
): Promise<boolean> {
  try {
    const { getConnection } = await import('@/lib/whatsapp/client')
    const sock = getConnection(userId)
    if (!sock?.user) return false

    const myNumber = sock.user.id.split(':')[0]
    const myLid = sock.user.lid?.split(':')[0]
    const selfJid = myLid ? `${myLid}@lid` : `${myNumber}@s.whatsapp.net`

    const lines = contacts.map(c => {
      const badge = c.importance === 'vip' ? '⭐ ' : ''
      return `${badge}${c.name} — ${c.daysSinceContact} days no contact (${c.temperature.label})`
    })

    const text = [
      `🧊 Cooling Relationships`,
      ``,
      ...lines,
      ``,
      `━━━`,
      `These important contacts may need your attention.`,
      `Reply: reconnect [name] | snooze [name]`,
    ].join('\n')

    await sock.sendMessage(selfJid, { text })
    return true
  } catch {
    return false
  }
}
