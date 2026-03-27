-- Add body_text column to cache full email body from Gmail API
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS body_text TEXT;
