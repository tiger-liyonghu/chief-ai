import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/agents/weaver
 * Weaver Agent — calculates relationship health for all contacts.
 * Returns contacts sorted by "cooling" relationships that need attention.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const now = new Date()

  // Get all contacts with importance >= normal
  const { data: contacts } = await admin
    .from('contacts')
    .select('id, email, name, company, relationship, importance, last_contact_at, email_count')
    .eq('user_id', user.id)
    .in('importance', ['vip', 'high', 'normal'])
    .order('importance', { ascending: true })
    .limit(50)

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ relationships: [], cooling: [], healthy: [] })
  }

  // Get email interaction counts per contact (last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()
  const contactEmails = contacts.map(c => c.email.toLowerCase())

  const { data: recentEmails } = await admin
    .from('emails')
    .select('from_address')
    .eq('user_id', user.id)
    .in('from_address', contactEmails)
    .gte('received_at', thirtyDaysAgo)

  // Count interactions per contact
  const recentCounts = new Map<string, number>()
  for (const e of recentEmails || []) {
    const addr = (e.from_address || '').toLowerCase()
    recentCounts.set(addr, (recentCounts.get(addr) || 0) + 1)
  }

  // Get active commitments per contact
  const { data: commitmentsList } = await admin
    .from('commitments')
    .select('contact_email, type')
    .eq('user_id', user.id)
    .in('status', ['pending', 'in_progress', 'overdue'])
    .in('contact_email', contactEmails)

  const commitmentCounts = new Map<string, { promised: number; waiting: number }>()
  for (const f of commitmentsList || []) {
    const email = (f.contact_email || '').toLowerCase()
    const current = commitmentCounts.get(email) || { promised: 0, waiting: 0 }
    if (f.type === 'i_promised') current.promised++
    else current.waiting++
    commitmentCounts.set(email, current)
  }

  // Calculate relationship temperature for each contact
  const relationships = contacts.map(c => {
    const email = c.email.toLowerCase()
    const daysSinceContact = c.last_contact_at
      ? Math.ceil((now.getTime() - new Date(c.last_contact_at).getTime()) / 86400000)
      : 999

    const recentInteractions = recentCounts.get(email) || 0
    const fups = commitmentCounts.get(email) || { promised: 0, waiting: 0 }

    // Temperature calculation (0-100)
    // Factors: recency, frequency, importance, open commitments
    let temperature = 50 // baseline

    // Recency boost/penalty
    if (daysSinceContact <= 3) temperature += 30
    else if (daysSinceContact <= 7) temperature += 20
    else if (daysSinceContact <= 14) temperature += 10
    else if (daysSinceContact <= 30) temperature -= 10
    else if (daysSinceContact <= 60) temperature -= 25
    else temperature -= 40

    // Frequency boost
    temperature += Math.min(recentInteractions * 3, 15)

    // Open commitments = active relationship
    temperature += (fups.promised + fups.waiting) * 5

    // Clamp
    temperature = Math.max(0, Math.min(100, temperature))

    // Status label
    let status: 'hot' | 'warm' | 'cooling' | 'cold' = 'warm'
    if (temperature >= 70) status = 'hot'
    else if (temperature >= 40) status = 'warm'
    else if (temperature >= 20) status = 'cooling'
    else status = 'cold'

    return {
      email: c.email,
      name: c.name || c.email,
      company: c.company,
      relationship: c.relationship,
      importance: c.importance,
      temperature,
      status,
      days_since_contact: daysSinceContact,
      recent_interactions_30d: recentInteractions,
      open_commitments: fups,
      needs_attention: (c.importance === 'vip' && temperature < 50) ||
                       (c.importance === 'high' && temperature < 30),
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
