-- Add AI auto-reply toggle to WhatsApp connections
ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.whatsapp_connections.ai_enabled IS
  'When true, Chief AI automatically replies to inbound WhatsApp messages';
