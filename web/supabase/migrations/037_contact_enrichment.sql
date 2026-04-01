-- Migration 037: Contact Enrichment — 个人客户本体扩展
--
-- 从简单的 email+name 扩展为完整的个人档案
-- 支持多源融合：通讯录、邮件签名、名片OCR、LinkedIn、WhatsApp

-- ==========================================
-- 1. CONTACTS — 扩展字段
-- ==========================================

ALTER TABLE public.contacts
  -- 多标识符
  ADD COLUMN IF NOT EXISTS name_zh TEXT,
  ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS emails TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS phones TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS wechat_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,

  -- 职业信息
  ADD COLUMN IF NOT EXISTS current_title TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS seniority TEXT CHECK (seniority IN ('c_suite', 'vp', 'director', 'manager', 'ic', 'assistant', 'other')),
  ADD COLUMN IF NOT EXISTS career_history JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}',

  -- 关系深度
  ADD COLUMN IF NOT EXISTS warmth TEXT DEFAULT 'warm' CHECK (warmth IN ('hot', 'warm', 'cool', 'cold')),
  ADD COLUMN IF NOT EXISTS trust_level TEXT DEFAULT 'new' CHECK (trust_level IN ('new', 'building', 'established', 'deep')),
  ADD COLUMN IF NOT EXISTS interaction_trend TEXT DEFAULT 'stable' CHECK (interaction_trend IN ('increasing', 'stable', 'decreasing', 'dormant')),
  ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMPTZ,

  -- 互动统计
  ADD COLUMN IF NOT EXISTS whatsapp_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meeting_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_response_hours NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS followthrough_rate NUMERIC(3,2),

  -- 个人偏好
  ADD COLUMN IF NOT EXISTS preferred_language TEXT,
  ADD COLUMN IF NOT EXISTS communication_style TEXT CHECK (communication_style IN ('formal', 'casual', 'mixed')),
  ADD COLUMN IF NOT EXISTS dietary TEXT,
  ADD COLUMN IF NOT EXISTS alcohol_pref TEXT,
  ADD COLUMN IF NOT EXISTS hobbies TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS birthday DATE,
  ADD COLUMN IF NOT EXISTS spouse_name TEXT,
  ADD COLUMN IF NOT EXISTS children JSONB DEFAULT '[]',

  -- 送礼
  ADD COLUMN IF NOT EXISTS gift_history JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS gift_notes TEXT,

  -- 名片
  ADD COLUMN IF NOT EXISTS business_card_url TEXT,
  ADD COLUMN IF NOT EXISTS card_scanned_at TIMESTAMPTZ,

  -- 助理信息
  ADD COLUMN IF NOT EXISTS assistant_name TEXT,
  ADD COLUMN IF NOT EXISTS assistant_email TEXT,
  ADD COLUMN IF NOT EXISTS assistant_phone TEXT,
  ADD COLUMN IF NOT EXISTS assistant_notes TEXT,

  -- 数据来源
  ADD COLUMN IF NOT EXISTS data_sources TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_source TEXT;

-- ==========================================
-- 2. CONTACT_INTERACTIONS — 互动时间线
-- ==========================================

CREATE TABLE IF NOT EXISTS public.contact_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,

  -- 互动信息
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'meeting', 'call', 'linkedin', 'wechat', 'other')),
  direction TEXT CHECK (direction IN ('inbound', 'outbound', 'mutual')),
  interaction_at TIMESTAMPTZ NOT NULL,

  -- 内容
  summary TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  topics TEXT[] DEFAULT '{}',

  -- 来源
  signal_id UUID,
  signal_channel TEXT,
  meeting_id UUID,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.contact_interactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own contact_interactions' AND tablename = 'contact_interactions') THEN
    CREATE POLICY "Users can manage own contact_interactions"
      ON public.contact_interactions FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact ON public.contact_interactions(contact_id, interaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_user ON public.contact_interactions(user_id, interaction_at DESC);

-- ==========================================
-- 3. CONTACT_RELATIONSHIPS — 人与人关系图谱
-- ==========================================

CREATE TABLE IF NOT EXISTS public.contact_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  to_contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN (
    'colleague', 'manager', 'reports_to', 'spouse', 'family',
    'referred_by', 'introduced_by', 'classmate', 'friend',
    'board_member', 'advisor', 'investor', 'other'
  )),
  context TEXT,                       -- "DBS Digital Banking 同事"
  since TEXT,                         -- "2023"
  strength TEXT DEFAULT 'moderate' CHECK (strength IN ('strong', 'moderate', 'weak')),

  -- 传递价值
  intro_potential BOOLEAN DEFAULT false,
  intro_notes TEXT,                   -- "通过 Yamamoto 可以触达 DBS CEO"

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, from_contact_id, to_contact_id, type)
);

ALTER TABLE public.contact_relationships ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own contact_relationships' AND tablename = 'contact_relationships') THEN
    CREATE POLICY "Users can manage own contact_relationships"
      ON public.contact_relationships FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contact_relationships_from ON public.contact_relationships(from_contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_relationships_to ON public.contact_relationships(to_contact_id);

-- ==========================================
-- 4. Indexes for new contact fields
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_contacts_warmth ON public.contacts(user_id, warmth) WHERE warmth IN ('hot', 'warm');
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin ON public.contacts(linkedin_url) WHERE linkedin_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(user_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_birthday ON public.contacts(user_id, birthday) WHERE birthday IS NOT NULL;
