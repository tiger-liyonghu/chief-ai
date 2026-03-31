/**
 * GET /api/commitments/graph
 * Returns commitment data structured for graph visualization.
 *
 * Nodes: user (center) + each contact with active commitments
 * Edges: commitments between user and contacts
 * Edge direction: i_promised (outbound) vs they_promised (inbound)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface GraphNode {
  id: string
  label: string
  type: 'user' | 'contact' | 'family'
  importance?: string
  company?: string
}

interface GraphEdge {
  id: string
  source: string
  target: string
  label: string
  type: 'i_promised' | 'they_promised' | 'family'
  status: string
  urgency: number
  deadline: string | null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch active commitments with contact info
  const { data: commitments } = await admin
    .from('commitments')
    .select('id, type, contact_name, contact_email, contact_id, title, deadline, status, urgency_score, family_member')
    .eq('user_id', user.id)
    .in('status', ['pending', 'in_progress', 'overdue', 'waiting'])
    .order('urgency_score', { ascending: false })

  // Fetch contact details for enrichment
  const contactEmails = [...new Set((commitments || []).map(c => c.contact_email).filter(Boolean))]
  const { data: contacts } = contactEmails.length > 0
    ? await admin
        .from('contacts')
        .select('id, email, name, company, importance')
        .eq('user_id', user.id)
        .in('email', contactEmails)
    : { data: [] }

  const contactMap = new Map((contacts || []).map(c => [c.email, c]))

  // Build graph
  const nodes: GraphNode[] = [
    { id: 'user', label: 'Me', type: 'user' },
  ]
  const edges: GraphEdge[] = []
  const seenContacts = new Set<string>()

  for (const c of commitments || []) {
    const contactKey = c.contact_email || c.family_member || c.contact_name || 'unknown'

    // Add contact node (deduplicated)
    if (!seenContacts.has(contactKey)) {
      seenContacts.add(contactKey)
      const contactInfo = c.contact_email ? contactMap.get(c.contact_email) : null
      nodes.push({
        id: contactKey,
        label: c.contact_name || c.family_member || contactKey,
        type: c.type === 'family' ? 'family' : 'contact',
        importance: contactInfo?.importance,
        company: contactInfo?.company,
      })
    }

    // Add edge
    edges.push({
      id: c.id,
      source: c.type === 'i_promised' || c.type === 'family' ? 'user' : contactKey,
      target: c.type === 'i_promised' || c.type === 'family' ? contactKey : 'user',
      label: c.title,
      type: c.type,
      status: c.status,
      urgency: c.urgency_score || 0,
      deadline: c.deadline,
    })
  }

  // Stats
  const stats = {
    total_active: edges.length,
    i_promised: edges.filter(e => e.type === 'i_promised').length,
    they_promised: edges.filter(e => e.type === 'they_promised').length,
    family: edges.filter(e => e.type === 'family').length,
    overdue: edges.filter(e => e.status === 'overdue').length,
    contacts: nodes.length - 1,
  }

  return NextResponse.json({ nodes, edges, stats })
}
