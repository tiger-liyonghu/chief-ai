-- Multi-account Google integration
-- One user can bind multiple Gmail/Google Workspace accounts

-- ==========================================
-- GOOGLE ACCOUNTS (replaces single google_tokens for multi-account)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.google_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  google_name TEXT,
  google_avatar TEXT,
  is_primary BOOLEAN DEFAULT false,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  gmail_history_id TEXT,
  calendar_sync_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, google_email)
);

CREATE INDEX IF NOT EXISTS idx_google_accounts_user ON public.google_accounts(user_id);

ALTER TABLE public.google_accounts ENABLE ROW LEVEL SECURITY;

-- RLS: user can read own accounts (for settings UI), but token fields are excluded at query level
CREATE POLICY "accounts_own" ON public.google_accounts FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- Add source_account_email to emails and calendar_events
-- ==========================================
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS source_account_email TEXT;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS source_account_email TEXT;

-- Index for filtering emails by source account
CREATE INDEX IF NOT EXISTS idx_emails_source_account ON public.emails(user_id, source_account_email);

-- ==========================================
-- Migrate existing google_tokens data into google_accounts
-- ==========================================
-- For existing users, copy their single token row into the new table
-- Mark it as primary and use the profile email as google_email
INSERT INTO public.google_accounts (
  user_id, google_email, google_name, is_primary,
  access_token_encrypted, refresh_token_encrypted,
  token_expires_at, gmail_history_id, calendar_sync_token,
  created_at, updated_at
)
SELECT
  gt.user_id,
  p.email,
  p.full_name,
  true,
  gt.access_token_encrypted,
  gt.refresh_token_encrypted,
  gt.token_expires_at,
  gt.gmail_history_id,
  gt.calendar_sync_token,
  gt.created_at,
  gt.updated_at
FROM public.google_tokens gt
JOIN public.profiles p ON p.id = gt.user_id
ON CONFLICT (user_id, google_email) DO NOTHING;

-- Backfill source_account_email on existing emails
UPDATE public.emails e
SET source_account_email = p.email
FROM public.profiles p
WHERE e.user_id = p.id AND e.source_account_email IS NULL;

-- Backfill source_account_email on existing calendar_events
UPDATE public.calendar_events ce
SET source_account_email = p.email
FROM public.profiles p
WHERE ce.user_id = p.id AND ce.source_account_email IS NULL;
