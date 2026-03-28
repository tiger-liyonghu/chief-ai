-- Add IMAP provider support to google_accounts table
-- Extends the provider CHECK constraint to include 'imap'

-- Drop existing constraint and recreate with 'imap' option
ALTER TABLE public.google_accounts DROP CONSTRAINT IF EXISTS google_accounts_provider_check;
ALTER TABLE public.google_accounts ADD CONSTRAINT google_accounts_provider_check
  CHECK (provider IN ('google', 'microsoft', 'imap'));
