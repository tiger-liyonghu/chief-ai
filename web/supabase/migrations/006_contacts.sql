-- Contact Intelligence & Relationship Grouping
-- Auto-categorizes contacts by relationship type and importance

-- ==========================================
-- CONTACTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  role TEXT,
  relationship TEXT DEFAULT 'other' CHECK (relationship IN ('boss', 'team', 'client', 'investor', 'partner', 'vendor', 'recruiter', 'personal', 'other')),
  importance TEXT DEFAULT 'normal' CHECK (importance IN ('vip', 'high', 'normal', 'low')),
  avatar_url TEXT,
  last_contact_at TIMESTAMPTZ,
  email_count INT DEFAULT 0,
  notes TEXT,
  auto_detected BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON public.contacts(user_id, relationship);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(user_id, email);
CREATE INDEX IF NOT EXISTS idx_contacts_importance ON public.contacts(user_id, importance) WHERE importance IN ('vip', 'high');

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_own" ON public.contacts FOR ALL USING (auth.uid() = user_id);
