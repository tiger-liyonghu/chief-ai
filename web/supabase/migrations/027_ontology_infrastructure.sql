-- Migration 027: Ontology Infrastructure
-- Core tables for Chief's knowledge graph: relations, relation_types, entity_types

-- ═══════════════════════════════════════════════════════════════
-- 1. Entity Types Registry
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.entity_types (
  type_name   TEXT PRIMARY KEY,
  table_name  TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.entity_types (type_name, table_name, description) VALUES
  ('person', 'contacts', 'People: contacts, family members, self'),
  ('organization', 'organizations', 'Companies, partners, competitors'),
  ('commitment', 'commitments', 'Promises, favors, obligations'),
  ('context', 'calendar_events', 'Meetings, trips, family events, holidays'),
  ('deal', 'deals', 'Business opportunities and pipeline'),
  ('market', 'markets', 'Industries, segments, regulations (Phase 2)')
ON CONFLICT (type_name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 2. Relation Types (metadata/definitions)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.relation_types (
  id              TEXT PRIMARY KEY,
  from_type       TEXT NOT NULL REFERENCES public.entity_types(type_name),
  to_type         TEXT NOT NULL REFERENCES public.entity_types(type_name),
  label           TEXT NOT NULL,
  label_zh        TEXT,
  inverse         TEXT,
  is_symmetric    BOOLEAN DEFAULT false,
  is_transitive   BOOLEAN DEFAULT false,
  properties_schema JSONB,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Person to Person (8 types)
INSERT INTO public.relation_types (id, from_type, to_type, label, label_zh, inverse, is_symmetric, properties_schema, description) VALUES
  ('introduced_by', 'person', 'person', 'introduced by', '由...介绍', 'introduced', false, '{"context":"string","date":"date","event":"string"}', 'Who introduced this person'),
  ('reports_to', 'person', 'person', 'reports to', '汇报给', 'manages', false, '{"since":"date"}', 'Reporting relationship'),
  ('spouse_of', 'person', 'person', 'spouse of', '配偶', 'spouse_of', true, NULL, 'Marriage relationship'),
  ('parent_of', 'person', 'person', 'parent of', '父母', 'child_of', false, NULL, 'Parent-child relationship'),
  ('colleague_of', 'person', 'person', 'colleague of', '同事', 'colleague_of', true, '{"company":"string","since":"date"}', 'Current or former colleagues'),
  ('classmate_of', 'person', 'person', 'classmate of', '校友', 'classmate_of', true, '{"school":"string","year":"string"}', 'School/university alumni'),
  ('mentor_of', 'person', 'person', 'mentor of', '导师', 'mentee_of', false, '{"domain":"string"}', 'Mentorship relationship'),
  ('competes_with', 'person', 'person', 'competes with', '竞争关系', 'competes_with', true, '{"domain":"string"}', 'Professional competition')
ON CONFLICT (id) DO NOTHING;

-- Person to Organization (8 types)
INSERT INTO public.relation_types (id, from_type, to_type, label, label_zh, inverse, is_symmetric, properties_schema, description) VALUES
  ('works_at', 'person', 'organization', 'works at', '在职于', 'employs', false, '{"role":"string","department":"string","since":"date"}', 'Current or former employment (use valid_from/valid_to for temporal)'),
  ('founded', 'person', 'organization', 'founded', '创立', 'founded_by', false, '{"year":"number"}', 'Founder relationship'),
  ('invested_in_org', 'person', 'organization', 'invested in', '投资了', 'investor', false, '{"round":"string","amount":"string","date":"date"}', 'Investment relationship'),
  ('advises', 'person', 'organization', 'advises', '顾问', 'advised_by', false, '{"capacity":"string","since":"date"}', 'Advisory role'),
  ('board_member_of', 'person', 'organization', 'board member of', '董事会成员', 'has_board_member', false, '{"role":"string","since":"date"}', 'Board membership'),
  ('decision_maker_at', 'person', 'organization', 'decision maker at', '决策人', NULL, false, '{"scope":"string","authority_level":"string"}', 'Has decision-making authority'),
  ('influencer_at', 'person', 'organization', 'influencer at', '影响者', NULL, false, '{"influence_area":"string"}', 'Has influence but not formal authority'),
  ('alumni_of', 'person', 'organization', 'alumni of', '前员工', NULL, false, '{"role":"string","from":"date","to":"date"}', 'Former employee/member')
ON CONFLICT (id) DO NOTHING;

-- Person to Commitment (4 types)
INSERT INTO public.relation_types (id, from_type, to_type, label, label_zh, inverse, is_symmetric, properties_schema, description) VALUES
  ('promised_to', 'person', 'commitment', 'promised to', '承诺给', 'promised_by', false, NULL, 'I made this promise to this person'),
  ('promised_by', 'person', 'commitment', 'promised by', '被承诺', 'promised_to', false, NULL, 'This person made this promise to me'),
  ('owes_favor', 'person', 'person', 'owes favor to', '欠人情', 'owed_favor_by', false, '{"weight":"string","description":"string","date":"date","acknowledged":"boolean"}', 'Informal reciprocity debt'),
  ('invested_in_rel', 'person', 'person', 'invested in relationship with', '关系投资', NULL, false, '{"weight":"string","description":"string","date":"date"}', 'Relationship investment without immediate return')
ON CONFLICT (id) DO NOTHING;

-- Person to Context (4 types)
INSERT INTO public.relation_types (id, from_type, to_type, label, label_zh, inverse, is_symmetric, properties_schema, description) VALUES
  ('attends', 'person', 'context', 'attends', '参加', 'attended_by', false, '{"role":"string","confirmed":"boolean"}', 'Attending an event'),
  ('hosts', 'person', 'context', 'hosts', '主持', 'hosted_by', false, NULL, 'Hosting an event'),
  ('travels_to', 'person', 'context', 'travels to', '出差去', NULL, false, NULL, 'Trip association'),
  ('family_participant', 'person', 'context', 'participates in family event', '参加家庭事件', NULL, false, NULL, 'Family event participation')
ON CONFLICT (id) DO NOTHING;

-- Person to Deal (5 types, including facilitator)
INSERT INTO public.relation_types (id, from_type, to_type, label, label_zh, inverse, is_symmetric, properties_schema, description) VALUES
  ('champion_of', 'person', 'deal', 'champion of', '支持者', NULL, false, '{"since":"date","influence":"string"}', 'Internal champion for the deal'),
  ('blocker_of', 'person', 'deal', 'blocker of', '阻碍者', NULL, false, '{"reason":"string","since":"date"}', 'Blocking or delaying the deal'),
  ('decision_maker_of', 'person', 'deal', 'decision maker of', '决策人', NULL, false, '{"authority":"string"}', 'Final decision authority'),
  ('influencer_of', 'person', 'deal', 'influencer of', '影响者', NULL, false, '{"influence_area":"string"}', 'Has influence on deal outcome'),
  ('facilitator_of', 'person', 'deal', 'facilitator of', '引荐人/中间人', NULL, false, '{"introduced_parties":"string","ongoing_role":"string","protocol_notes":"string"}', 'Ongoing introducer/middleman role in SEA deals')
ON CONFLICT (id) DO NOTHING;

-- Organization to Organization (5 types)
INSERT INTO public.relation_types (id, from_type, to_type, label, label_zh, inverse, is_symmetric, properties_schema, description) VALUES
  ('partner_of', 'organization', 'organization', 'partner of', '合作伙伴', 'partner_of', true, '{"type":"string","since":"date"}', 'Business partnership'),
  ('competitor_of', 'organization', 'organization', 'competitor of', '竞争对手', 'competitor_of', true, '{"domain":"string"}', 'Market competition'),
  ('subsidiary_of', 'organization', 'organization', 'subsidiary of', '子公司', 'parent_company_of', false, NULL, 'Corporate ownership'),
  ('client_of', 'organization', 'organization', 'client of', '客户', 'vendor_of', false, '{"since":"date","contract_value":"string"}', 'Client-vendor relationship'),
  ('vendor_of', 'organization', 'organization', 'vendor of', '供应商', 'client_of', false, '{"since":"date","service":"string"}', 'Vendor-client relationship')
ON CONFLICT (id) DO NOTHING;

-- Deal to Organization (2 types)
INSERT INTO public.relation_types (id, from_type, to_type, label, label_zh, inverse, is_symmetric, properties_schema, description) VALUES
  ('opportunity_at', 'deal', 'organization', 'opportunity at', '机会在', NULL, false, NULL, 'Which organization this deal targets'),
  ('sold_to', 'deal', 'organization', 'sold to', '卖给', NULL, false, '{"contract_date":"date"}', 'Buyer organization for closed deals')
ON CONFLICT (id) DO NOTHING;

-- Deal to Commitment (3 types)
INSERT INTO public.relation_types (id, from_type, to_type, label, label_zh, inverse, is_symmetric, properties_schema, description) VALUES
  ('depends_on', 'deal', 'commitment', 'depends on', '依赖', NULL, false, '{"criticality":"string"}', 'Deal depends on this commitment being fulfilled'),
  ('blocked_by', 'deal', 'commitment', 'blocked by', '被阻塞', NULL, false, '{"since":"date"}', 'Deal is blocked by this commitment'),
  ('advanced_by', 'deal', 'commitment', 'advanced by', '被推进', NULL, false, NULL, 'This commitment advances the deal')
ON CONFLICT (id) DO NOTHING;

-- Deal to Context (2 types)
INSERT INTO public.relation_types (id, from_type, to_type, label, label_zh, inverse, is_symmetric, properties_schema, description) VALUES
  ('discussed_at', 'deal', 'context', 'discussed at', '在...讨论', NULL, false, NULL, 'Deal was discussed at this event'),
  ('target_event', 'deal', 'context', 'target event', '目标事件', NULL, false, '{"milestone":"string"}', 'Target milestone event for the deal')
ON CONFLICT (id) DO NOTHING;

-- Context to Context (3 types)
INSERT INTO public.relation_types (id, from_type, to_type, label, label_zh, inverse, is_symmetric, properties_schema, description) VALUES
  ('part_of', 'context', 'context', 'part of', '属于', 'contains', false, NULL, 'Sub-event of a larger event (meeting within a trip)'),
  ('conflicts_with', 'context', 'context', 'conflicts with', '冲突', 'conflicts_with', true, '{"conflict_type":"string"}', 'Time conflict between events'),
  ('precedes', 'context', 'context', 'precedes', '在...之前', 'follows', false, '{"gap_minutes":"number","transit_needed":"boolean"}', 'Sequential ordering of events')
ON CONFLICT (id) DO NOTHING;

-- Commitment to Commitment (3 types)
INSERT INTO public.relation_types (id, from_type, to_type, label, label_zh, inverse, is_symmetric, properties_schema, description) VALUES
  ('blocks_commitment', 'commitment', 'commitment', 'blocks', '阻塞', 'blocked_by_commitment', false, NULL, 'This commitment blocks another'),
  ('depends_on_commitment', 'commitment', 'commitment', 'depends on', '依赖', NULL, false, NULL, 'This commitment depends on another'),
  ('replaces', 'commitment', 'commitment', 'replaces', '替代', 'replaced_by', false, '{"reason":"string"}', 'This commitment supersedes another')
ON CONFLICT (id) DO NOTHING;

-- Cross-entity dedup (any to same type)
INSERT INTO public.relation_types (id, from_type, to_type, label, label_zh, inverse, is_symmetric, properties_schema, description) VALUES
  ('same_as_person', 'person', 'person', 'same as', '同一人', 'same_as_person', true, '{"merge_confidence":"number","discovered_via":"string"}', 'Entity dedup: two records are the same person'),
  ('same_as_org', 'organization', 'organization', 'same as', '同一组织', 'same_as_org', true, '{"merge_confidence":"number","discovered_via":"string"}', 'Entity dedup: two records are the same organization')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 3. Relations (the unified graph)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.relations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  from_entity UUID NOT NULL,
  from_type   TEXT NOT NULL REFERENCES public.entity_types(type_name),
  relation    TEXT NOT NULL REFERENCES public.relation_types(id),
  to_entity   UUID NOT NULL,
  to_type     TEXT NOT NULL REFERENCES public.entity_types(type_name),

  properties  JSONB DEFAULT '{}',
  confidence  NUMERIC(3,2) DEFAULT 1.0,
  source      TEXT DEFAULT 'manual',

  -- Temporal dimension
  valid_from  TIMESTAMPTZ DEFAULT now(),
  valid_to    TIMESTAMPTZ,  -- NULL = currently active

  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own relations"
  ON public.relations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes (per CRM Expert's recommendation)
CREATE INDEX idx_relations_from ON public.relations(from_entity, is_active, relation);
CREATE INDEX idx_relations_to ON public.relations(to_entity, is_active, relation);
CREATE INDEX idx_relations_types ON public.relations(from_type, to_type, relation) WHERE is_active = true;
CREATE INDEX idx_relations_user ON public.relations(user_id, is_active);
CREATE INDEX idx_relations_temporal ON public.relations(valid_from, valid_to) WHERE valid_to IS NULL;

-- Updated_at trigger
CREATE TRIGGER relations_updated_at
  BEFORE UPDATE ON public.relations
  FOR EACH ROW EXECUTE FUNCTION update_commitments_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 4. Organizations table (new)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  alias           TEXT,
  industry        TEXT,
  size            TEXT CHECK (size IN ('startup', 'sme', 'enterprise', 'mnc', 'government')),
  hq_city         TEXT,
  hq_country      TEXT,
  website         TEXT,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'acquired', 'closed')),
  annual_revenue  TEXT,
  employee_count  TEXT,
  key_products    TEXT,
  recent_news     TEXT,
  news_updated_at TIMESTAMPTZ,
  stock_ticker    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own organizations"
  ON public.organizations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_organizations_user ON public.organizations(user_id);
CREATE INDEX idx_organizations_name ON public.organizations(user_id, name);

-- ═══════════════════════════════════════════════════════════════
-- 5. Deals table (new, with latent stage)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  stage           TEXT DEFAULT 'latent' CHECK (stage IN (
    'latent', 'prospect', 'qualification', 'proposal', 'negotiation', 'closing', 'won', 'lost'
  )),
  probability     INT DEFAULT 0,
  value           NUMERIC(15,2),
  currency        TEXT DEFAULT 'SGD',
  expected_close  DATE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'stalled', 'abandoned')),
  stall_reason    TEXT,
  loss_reason     TEXT,
  notes           TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own deals"
  ON public.deals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_deals_user_status ON public.deals(user_id, status);
CREATE INDEX idx_deals_stage ON public.deals(user_id, stage) WHERE status = 'active';

-- ═══════════════════════════════════════════════════════════════
-- 6. Entity modifications (per expert review)
-- ═══════════════════════════════════════════════════════════════

-- Person: add base_timezone
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS base_timezone TEXT;

-- Context: add priority, flexibility, outcome fields
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal'
  CHECK (priority IN ('critical', 'high', 'normal', 'low'));
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS flexibility TEXT DEFAULT 'flexible'
  CHECK (flexibility IN ('fixed', 'flexible', 'moveable', 'droppable'));
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS outcome_summary TEXT;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS action_items JSONB;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS mood TEXT
  CHECK (mood IN ('positive', 'neutral', 'tense', 'negative'));

-- Family calendar: add priority/flexibility too
ALTER TABLE public.family_calendar ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'high'
  CHECK (priority IN ('critical', 'high', 'normal', 'low'));
ALTER TABLE public.family_calendar ADD COLUMN IF NOT EXISTS flexibility TEXT DEFAULT 'fixed'
  CHECK (flexibility IN ('fixed', 'flexible', 'moveable', 'droppable'));

-- Trips: add priority/flexibility
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'high'
  CHECK (priority IN ('critical', 'high', 'normal', 'low'));
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS flexibility TEXT DEFAULT 'flexible'
  CHECK (flexibility IN ('fixed', 'flexible', 'moveable', 'droppable'));

-- Commitment: add relationship_impact, business_impact
ALTER TABLE public.commitments ADD COLUMN IF NOT EXISTS relationship_impact TEXT
  CHECK (relationship_impact IN ('critical', 'high', 'medium', 'low'));
ALTER TABLE public.commitments ADD COLUMN IF NOT EXISTS business_impact TEXT
  CHECK (business_impact IN ('critical', 'high', 'medium', 'low'));
ALTER TABLE public.commitments ADD COLUMN IF NOT EXISTS commitment_subtype TEXT
  CHECK (commitment_subtype IN ('deliverable', 'meeting', 'favor', 'introduction', 'family_promise', 'investment'));

-- Updated_at triggers for new tables
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_commitments_updated_at();

CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION update_commitments_updated_at();
