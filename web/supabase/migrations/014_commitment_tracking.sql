-- Add commitment scanning support to emails table
ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS commitment_scanned BOOLEAN DEFAULT NULL;

-- Index for finding unscanned sent emails
CREATE INDEX IF NOT EXISTS idx_emails_commitment_scan
  ON public.emails(user_id, commitment_scanned)
  WHERE commitment_scanned IS NULL;
