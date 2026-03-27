-- WhatsApp Business Cloud API integration
-- Migration 005

-- ==========================================
-- WHATSAPP CONNECTIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  whatsapp_business_id TEXT,
  phone_number_id TEXT,
  access_token_encrypted TEXT,
  webhook_verify_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disconnected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, phone_number)
);

-- ==========================================
-- WHATSAPP MESSAGES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wa_message_id TEXT NOT NULL,
  from_number TEXT NOT NULL,
  from_name TEXT,
  to_number TEXT NOT NULL,
  body TEXT,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio', 'video')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  is_task_extracted BOOLEAN DEFAULT false,
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_user ON public.whatsapp_messages(user_id, received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_messages_id ON public.whatsapp_messages(user_id, wa_message_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_from ON public.whatsapp_messages(user_id, from_number, received_at DESC);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_conn_own" ON public.whatsapp_connections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "wa_msg_own" ON public.whatsapp_messages FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- ADD WHATSAPP TO TASKS SOURCE TYPE
-- ==========================================
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_source_type_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_source_type_check
  CHECK (source_type IN ('email', 'calendar', 'manual', 'whatsapp'));

-- Optional: add source_wa_message_id to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS source_wa_message_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL;
