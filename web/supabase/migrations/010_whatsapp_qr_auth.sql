-- Migration 010: WhatsApp QR code auth (Baileys)
-- Removes Meta Business API columns from whatsapp_connections.
-- Sessions are now stored on disk, not in the database.

-- Drop columns that were only needed for Meta Business API
ALTER TABLE public.whatsapp_connections
  DROP COLUMN IF EXISTS whatsapp_business_id,
  DROP COLUMN IF EXISTS phone_number_id,
  DROP COLUMN IF EXISTS access_token_encrypted,
  DROP COLUMN IF EXISTS webhook_verify_token;

-- Drop the old unique constraint and recreate without phone_number
-- (one connection per user is sufficient for QR-based auth)
ALTER TABLE public.whatsapp_connections DROP CONSTRAINT IF EXISTS whatsapp_connections_user_id_phone_number_key;
-- Allow upsert by user_id + phone_number (kept for backwards compat)
ALTER TABLE public.whatsapp_connections ADD CONSTRAINT whatsapp_connections_user_id_phone_number_key UNIQUE (user_id, phone_number);

-- Update status check constraint to remove 'pending' (no longer a valid state)
ALTER TABLE public.whatsapp_connections DROP CONSTRAINT IF EXISTS whatsapp_connections_status_check;
ALTER TABLE public.whatsapp_connections ADD CONSTRAINT whatsapp_connections_status_check
  CHECK (status IN ('active', 'disconnected'));

-- Set any existing 'pending' rows to 'disconnected'
UPDATE public.whatsapp_connections SET status = 'disconnected' WHERE status = 'pending';
