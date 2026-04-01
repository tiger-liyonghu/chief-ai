-- Strict binding rules: one channel = one owner
-- 1. Email: globally unique per (google_email, provider)
-- 2. Drop is_primary (no consumer)
-- 3. WhatsApp: globally unique per phone_number
-- 4. Cascade delete emails + calendar_events when account removed
-- 5. Max 3 email accounts per user (enforced at app level)

-- ==========================================
-- Step 1: Clean up duplicate email bindings
-- Keep the EARLIEST binding (by created_at), delete the rest
-- ==========================================
DELETE FROM public.google_accounts
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY google_email, provider
      ORDER BY created_at ASC
    ) AS rn
    FROM public.google_accounts
  ) ranked
  WHERE rn > 1
);

-- ==========================================
-- Step 2: Replace per-user unique with GLOBAL unique
-- ==========================================
-- Drop old per-user unique index
DROP INDEX IF EXISTS idx_email_accounts_unique;
ALTER TABLE public.google_accounts
  DROP CONSTRAINT IF EXISTS google_accounts_user_id_google_email_key;

-- Create global unique constraint
CREATE UNIQUE INDEX idx_email_accounts_global_unique
  ON public.google_accounts(google_email, provider);

-- ==========================================
-- Step 3: Drop is_primary column
-- ==========================================
ALTER TABLE public.google_accounts DROP COLUMN IF EXISTS is_primary;

-- ==========================================
-- Step 4: WhatsApp phone_number global unique
-- ==========================================
-- Clean up: keep latest active connection per phone_number
DELETE FROM public.whatsapp_connections
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY phone_number
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        created_at DESC
    ) AS rn
    FROM public.whatsapp_connections
  ) ranked
  WHERE rn > 1
);

-- Drop old per-user unique, add global unique
ALTER TABLE public.whatsapp_connections
  DROP CONSTRAINT IF EXISTS whatsapp_connections_user_id_phone_number_key;
CREATE UNIQUE INDEX idx_wa_phone_global_unique
  ON public.whatsapp_connections(phone_number);
