import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateTemperature, type TemperatureLabel } from '@/lib/contacts/temperature'

/**
 * GET /api/agents/weaver
 * Weaver Agent — calculates relationship health for all contacts.
 * Returns contacts sorted by "cooling" relationships that need attention.
 *
 * Uses unified temperature algorithm from lib/contacts/temperature.ts
 * (exponential decay, half-life 14 days).
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get all contacts with importance >= normal
  const { data: contacts } = await admin
    .from('contacts')
    .select('id, email, name, company, relationship, importance, roles, last_contact_at, email_count')
    .eq('user_id', user.id)
    .in('importance', ['vip', 'high', 'normal'])
    .order('importance', { ascending: true })
    .limit(50)

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ relationships: [], cooling: [], summary: {} })
  }

  // Batch get recent interaction counts (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const contactEmails = contacts.map(c => c.email.toLowerCase())

  const [recentEmailsRes, commitmentsRes] = await Promise.all([
    admin
      .from('emails')
      .select('from_address')
      .eq('user_id', user.id)
      .in('from_address', contactEmails)
      .gte('received_at', thirtyDaysAgo),

    admin
      .from('commitments')
      .select('contact_email')
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress', 'overdue'])
      .in('contact_email', contactEmails),
  ])

  const recentCounts = new Map<string, number>()
  for (const e of recentEmailsRes.data || []) {
    const addr = (e.from_address || '').toLowerCase()
    recentCounts.set(addr, (recentCounts.get(addr) || 0) + 1)
  }

  const commitmentCounts = new Map<string, number>()
  for (const c of commitmentsRes.data || []) {
    const email = (c.contact_email || '').toLowerCase()
    commitmentCounts.set(email, (commitmentCounts.get(email) || 0) + 1)
  }

  // Calculate temperature using unified algorithm
  const relationships = contacts.map(c => {
    const email = c.email.toLowerCase()
    const lastInteractionAt = c.last_contact_at ? new Date(c.last_contact_at) : null
    const daysSinceContact = lastInteractionAt
      ? Math.ceil((Date.now() - lastInteractionAt.getTime()) / 86400000)
      : 999

    const temp = calculateTemperature({
      lastInteractionAt,
      recentInteractionCount: recentCounts.get(email) || 0,
      activeCommitmentCount: commitmentCounts.get(email) || 0,
      importance: c.importance || 'normal',
    })

    return {
      id: c.id,
      email: c.email,
      name: c.name || c.email,
      company: c.company,
      relationship: c.relationship,
      importance: c.importance,
      roles: c.roles || [],
      temperature: temp.score,
      status: temp.label,
      days_since_contact: daysSinceContact,
      recent_interactions_30d: recentCounts.get(email) || 0,
      open_commitments: commitmentCounts.get(email) || 0,
      needs_attention: temp.needsAttention,
    }
  })

  // Sort: needs_attention first, then by temperature ascending (coldest first)
  relationships.sort((a, b) => {
    if (a.needs_attention && !b.needs_attention) return -1
    if (!a.needs_attention && b.needs_attention) return 1
    return a.temperature - b.temperature
  })

  return NextResponse.json({
    relationships,
    cooling: relationships.filter(r => r.needs_attention),
    summary: {
      total_contacts: relationships.length,
      hot: relationships.filter(r => r.status === 'hot').length,
      warm: relationships.filter(r => r.status === 'warm').length,
      cooling: relationships.filter(r => r.status === 'cooling').length,
      cold: relationships.filter(r => r.status === 'cold').length,
      needs_attention: relationships.filter(r => r.needs_attention).length,
    },
  })
}
