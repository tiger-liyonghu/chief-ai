/**
 * Context Resolution Layer — the core ontology query engine
 *
 * Given any entity ID, traverses the relations graph and returns
 * a structured context bundle. Replaces 4-5 tool call chains with
 * a single graph traversal.
 *
 * Returns tiered response:
 *   Layer 1: 200-token summary (for LLM system prompt)
 *   Layer 2: Full 1-hop relations with entity data
 *   Layer 3: 2-hop relations (on demand)
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ───

export interface RelatedEntity {
  entity_id: string
  entity_type: string
  relation: string
  direction: 'outgoing' | 'incoming'
  properties: Record<string, unknown>
  confidence: number
  valid_from: string | null
  valid_to: string | null
  // Hydrated entity data (from the actual table)
  data?: Record<string, unknown>
}

export interface ContextBundle {
  entity_id: string
  entity_type: string
  entity_data: Record<string, unknown> | null

  // Layer 1: Summary
  summary: {
    total_relations: number
    persons: number
    commitments: number
    contexts: number
    deals: number
    organizations: number
    urgency_flags: string[]
    key_facts: string[]
  }

  // Layer 2: Full 1-hop relations
  relations: RelatedEntity[]

  // Layer 3: 2-hop (only populated if requested)
  extended_relations?: RelatedEntity[]
}

// ─── Entity table mapping ───

const ENTITY_TABLES: Record<string, string> = {
  person: 'contacts',
  organization: 'organizations',
  commitment: 'commitments',
  context: 'calendar_events',
  deal: 'deals',
}

const ENTITY_SELECT: Record<string, string> = {
  person: 'id, name, email, company, role, relationship, importance, notes, base_timezone',
  organization: 'id, name, alias, industry, size, hq_city, hq_country, status, recent_news',
  commitment: 'id, title, type, status, deadline, deadline_fuzzy, urgency_score, confidence, contact_name, family_member',
  context: 'id, title, description, start_time, end_time, location, priority, flexibility, outcome_summary',
  deal: 'id, name, stage, probability, value, currency, expected_close, status, notes',
}

// ─── Core resolve function ───

export async function resolveContext(
  supabase: SupabaseClient,
  userId: string,
  entityId: string,
  options: {
    entityType?: string    // if known, skip auto-detection
    maxHops?: number       // 1 (default) or 2
    hydrateEntities?: boolean // load actual entity data (default true)
  } = {}
): Promise<ContextBundle> {
  const { maxHops = 1, hydrateEntities = true } = options
  let entityType = options.entityType

  // Auto-detect entity type if not provided
  if (!entityType) {
    for (const [type, table] of Object.entries(ENTITY_TABLES)) {
      const { data } = await supabase
        .from(table)
        .select('id')
        .eq('id', entityId)
        .limit(1)
      if (data && data.length > 0) {
        entityType = type
        break
      }
    }
  }

  if (!entityType) {
    return emptyBundle(entityId, 'unknown')
  }

  // Load the entity itself
  const table = ENTITY_TABLES[entityType]
  const select = ENTITY_SELECT[entityType] || '*'
  const { data: entityDataRaw } = await supabase
    .from(table)
    .select(select)
    .eq('id', entityId)
    .single()
  const entityData = entityDataRaw as Record<string, unknown> | null

  // Load 1-hop relations (both directions)
  const { data: outgoing } = await supabase
    .from('relations')
    .select('id, from_entity, from_type, relation, to_entity, to_type, properties, confidence, valid_from, valid_to')
    .eq('user_id', userId)
    .eq('from_entity', entityId)
    .eq('is_active', true)

  const { data: incoming } = await supabase
    .from('relations')
    .select('id, from_entity, from_type, relation, to_entity, to_type, properties, confidence, valid_from, valid_to')
    .eq('user_id', userId)
    .eq('to_entity', entityId)
    .eq('is_active', true)

  // Combine and normalize
  const relations: RelatedEntity[] = []

  for (const r of outgoing || []) {
    relations.push({
      entity_id: r.to_entity,
      entity_type: r.to_type,
      relation: r.relation,
      direction: 'outgoing',
      properties: r.properties || {},
      confidence: r.confidence,
      valid_from: r.valid_from,
      valid_to: r.valid_to,
    })
  }

  for (const r of incoming || []) {
    relations.push({
      entity_id: r.from_entity,
      entity_type: r.from_type,
      relation: r.relation,
      direction: 'incoming',
      properties: r.properties || {},
      confidence: r.confidence,
      valid_from: r.valid_from,
      valid_to: r.valid_to,
    })
  }

  // Hydrate related entities (load their actual data)
  if (hydrateEntities && relations.length > 0) {
    const byType: Record<string, string[]> = {}
    for (const r of relations) {
      if (!byType[r.entity_type]) byType[r.entity_type] = []
      if (!byType[r.entity_type].includes(r.entity_id)) {
        byType[r.entity_type].push(r.entity_id)
      }
    }

    for (const [type, ids] of Object.entries(byType)) {
      const t = ENTITY_TABLES[type]
      const s = ENTITY_SELECT[type]
      if (!t || !s) continue

      const { data: entities } = await supabase
        .from(t)
        .select(s)
        .in('id', ids)

      if (entities) {
        const entityMap = new Map((entities as any[]).map((e: any) => [e.id, e]))
        for (const r of relations) {
          if (r.entity_type === type && entityMap.has(r.entity_id)) {
            r.data = entityMap.get(r.entity_id) as Record<string, unknown>
          }
        }
      }
    }
  }

  // 2-hop (if requested)
  let extendedRelations: RelatedEntity[] | undefined
  if (maxHops >= 2) {
    extendedRelations = []
    const firstHopIds = relations.map(r => r.entity_id)

    for (const hopEntityId of firstHopIds.slice(0, 20)) { // cap at 20 to avoid explosion
      const { data: hop2out } = await supabase
        .from('relations')
        .select('to_entity, to_type, relation, properties, confidence')
        .eq('user_id', userId)
        .eq('from_entity', hopEntityId)
        .eq('is_active', true)
        .limit(10)

      for (const r of hop2out || []) {
        if (r.to_entity !== entityId && !firstHopIds.includes(r.to_entity)) {
          extendedRelations.push({
            entity_id: r.to_entity,
            entity_type: r.to_type,
            relation: r.relation,
            direction: 'outgoing',
            properties: r.properties || {},
            confidence: r.confidence,
            valid_from: null,
            valid_to: null,
          })
        }
      }
    }
  }

  // Build summary (Layer 1)
  const urgencyFlags: string[] = []
  const keyFacts: string[] = []

  // Count by type
  const typeCounts: Record<string, number> = {}
  for (const r of relations) {
    typeCounts[r.entity_type] = (typeCounts[r.entity_type] || 0) + 1
  }

  // Detect urgency from commitments
  for (const r of relations) {
    if (r.entity_type === 'commitment' && r.data) {
      const c = r.data as Record<string, unknown>
      if (c.status === 'overdue') {
        urgencyFlags.push(`Overdue: ${c.title}`)
      }
      if (c.deadline) {
        const daysLeft = Math.ceil((new Date(c.deadline as string).getTime() - Date.now()) / 86400000)
        if (daysLeft <= 1 && daysLeft >= 0) {
          urgencyFlags.push(`Due today: ${c.title}`)
        }
      }
    }
  }

  // Key facts from entity data
  const ed = entityData as Record<string, unknown> | null
  if (entityType === 'person' && ed) {
    if (ed.company) keyFacts.push(`Works at ${ed.company}`)
    if (ed.role) keyFacts.push(`Role: ${ed.role}`)
    if (ed.importance === 'vip') keyFacts.push('VIP contact')
  }
  if (entityType === 'deal' && ed) {
    keyFacts.push(`Stage: ${ed.stage}`)
    if (ed.value) keyFacts.push(`Value: ${ed.currency} ${ed.value}`)
  }

  return {
    entity_id: entityId,
    entity_type: entityType,
    entity_data: entityData || null,
    summary: {
      total_relations: relations.length,
      persons: typeCounts['person'] || 0,
      commitments: typeCounts['commitment'] || 0,
      contexts: typeCounts['context'] || 0,
      deals: typeCounts['deal'] || 0,
      organizations: typeCounts['organization'] || 0,
      urgency_flags: urgencyFlags,
      key_facts: keyFacts,
    },
    relations,
    extended_relations: extendedRelations,
  }
}

// ─── Format for LLM ───

export function contextToPrompt(bundle: ContextBundle, layer: 1 | 2 | 3 = 1): string {
  if (layer === 1) {
    // Layer 1: ~200 token summary
    const s = bundle.summary
    const lines: string[] = []

    if (bundle.entity_data) {
      const name = (bundle.entity_data as Record<string, string>).name || (bundle.entity_data as Record<string, string>).title || bundle.entity_id
      lines.push(`Entity: ${name} (${bundle.entity_type})`)
    }

    if (s.key_facts.length > 0) lines.push(`Facts: ${s.key_facts.join(', ')}`)
    lines.push(`Relations: ${s.total_relations} total (${s.persons} persons, ${s.commitments} commitments, ${s.contexts} events, ${s.deals} deals, ${s.organizations} orgs)`)
    if (s.urgency_flags.length > 0) lines.push(`URGENT: ${s.urgency_flags.join('; ')}`)

    return lines.join('\n')
  }

  if (layer === 2) {
    // Layer 2: Full 1-hop detail
    const lines: string[] = []
    for (const r of bundle.relations) {
      const name = r.data ? ((r.data as Record<string, string>).name || (r.data as Record<string, string>).title || r.entity_id) : r.entity_id
      const dir = r.direction === 'outgoing' ? '→' : '←'
      const props = Object.keys(r.properties).length > 0 ? ` (${JSON.stringify(r.properties)})` : ''
      lines.push(`${dir} ${r.relation}: ${name} [${r.entity_type}]${props}`)
    }
    return lines.join('\n')
  }

  // Layer 3: Extended 2-hop
  const lines = [contextToPrompt(bundle, 2)]
  if (bundle.extended_relations && bundle.extended_relations.length > 0) {
    lines.push('\n--- 2-hop connections ---')
    for (const r of bundle.extended_relations.slice(0, 10)) {
      lines.push(`  → ${r.relation}: ${r.entity_id} [${r.entity_type}]`)
    }
  }
  return lines.join('\n')
}

// ─── Helper ───

function emptyBundle(entityId: string, entityType: string): ContextBundle {
  return {
    entity_id: entityId,
    entity_type: entityType,
    entity_data: null,
    summary: {
      total_relations: 0, persons: 0, commitments: 0,
      contexts: 0, deals: 0, organizations: 0,
      urgency_flags: [], key_facts: [],
    },
    relations: [],
  }
}
