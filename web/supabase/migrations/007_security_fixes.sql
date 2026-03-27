-- Security fixes based on architecture audit

-- Fix google_accounts RLS: block client access to encrypted tokens
DROP POLICY IF EXISTS "accounts_own" ON public.google_accounts;
CREATE POLICY "accounts_service_only" ON public.google_accounts FOR ALL USING (false);

-- Add process_attempts to emails for retry limit
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS process_attempts INT DEFAULT 0;

-- Add expires_at for data cleanup
ALTER TABLE public.daily_briefings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days');
ALTER TABLE public.sync_log ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days');
