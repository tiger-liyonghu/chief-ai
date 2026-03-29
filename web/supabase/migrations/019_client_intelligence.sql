-- Client Intelligence: company profiles, executive profiles, taste profiles
-- Migration 019

-- ==========================================
-- COMPANY PROFILES (公司档案)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,
  headquarters TEXT,
  size TEXT, -- startup/smb/enterprise
  website TEXT,
  description TEXT,
  recent_news JSONB DEFAULT '[]', -- [{date, headline, source}]
  org_structure JSONB, -- key departments, reporting lines
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_own" ON public.company_profiles FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- TASTE PROFILES (品味档案)
-- ==========================================
-- Attached to contacts — each contact can have taste/preference data
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS company_profile_id UUID REFERENCES public.company_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS taste_profile JSONB DEFAULT '{}';
-- taste_profile: { diet: "清真", alcohol: "不喝酒", hobbies: ["高尔夫"], spouse: "Fatimah", gift_notes: "送过茶叶" }

-- ==========================================
-- BOSS PREFERENCES (老板偏好档案)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.boss_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- dining, accommodation, travel, communication, energy, gifting
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  learned_from TEXT, -- 'explicit' | 'observed' | 'confirmed'
  confidence REAL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, category, key)
);

ALTER TABLE public.boss_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boss_pref_own" ON public.boss_preferences FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- NEWS TRACKING (新闻追踪)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.news_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL, -- company name, industry keyword, person name
  keyword_type TEXT DEFAULT 'company' CHECK (keyword_type IN ('company', 'industry', 'person')),
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, keyword, keyword_type)
);

ALTER TABLE public.news_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_own" ON public.news_tracking FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- TRAVEL POLICIES (差旅政策)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.travel_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  policy_name TEXT NOT NULL,
  policy_content TEXT NOT NULL, -- Full text of the policy
  parsed_rules JSONB DEFAULT '[]', -- [{rule, category, limit_amount, limit_currency}]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.travel_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "policy_own" ON public.travel_policies FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- CUSTOM AGENTS (自定义Agent)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.custom_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  schedule TEXT, -- cron expression or 'on_demand'
  data_sources JSONB DEFAULT '[]', -- what data the agent can access
  output_channel TEXT DEFAULT 'whatsapp', -- where to send results
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.custom_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_own" ON public.custom_agents FOR ALL USING (auth.uid() = user_id);
