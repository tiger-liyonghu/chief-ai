-- Add Outlook/Microsoft account support
-- Extend google_accounts → email_accounts (multi-provider)

-- Step 1: Add provider column to google_accounts
ALTER TABLE public.google_accounts
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'google'
    CHECK (provider IN ('google', 'microsoft'));

-- Step 2: Add Microsoft-specific fields
-- Microsoft uses different token fields but we reuse encrypted columns
ALTER TABLE public.google_accounts
  ADD COLUMN IF NOT EXISTS ms_tenant_id TEXT;

-- Step 3: Rename table for clarity (google_accounts → email_accounts)
-- NOTE: We keep google_accounts name for backward compatibility with existing code.
-- All new code should treat it as a multi-provider table.
-- The google_email column stores the email regardless of provider.

-- Step 4: Update unique constraint to include provider
ALTER TABLE public.google_accounts
  DROP CONSTRAINT IF EXISTS google_accounts_user_id_google_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_unique
  ON public.google_accounts(user_id, google_email, provider);

-- Step 5: Add IMAP sync tracking fields (for future IMAP providers)
ALTER TABLE public.google_accounts
  ADD COLUMN IF NOT EXISTS imap_uid_validity TEXT,
  ADD COLUMN IF NOT EXISTS imap_last_uid TEXT;

-- Step 6: Index for provider-based queries
CREATE INDEX IF NOT EXISTS idx_email_accounts_provider
  ON public.google_accounts(user_id, provider);
