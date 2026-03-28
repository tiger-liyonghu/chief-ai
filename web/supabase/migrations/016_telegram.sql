-- Telegram Bot integration
-- Migration 016

-- ==========================================
-- TELEGRAM CONNECTIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.telegram_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  username TEXT,
  first_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_tg_conn_user ON public.telegram_connections(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tg_conn_chat ON public.telegram_connections(chat_id) WHERE is_active = true;

-- ==========================================
-- TELEGRAM MESSAGES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.telegram_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  message_id BIGINT NOT NULL,
  from_username TEXT,
  from_first_name TEXT,
  text TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tg_msg_user ON public.telegram_messages(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_tg_msg_chat ON public.telegram_messages(chat_id, received_at DESC);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE public.telegram_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tg_conn_own" ON public.telegram_connections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "tg_msg_own" ON public.telegram_messages FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- EXTEND TASKS SOURCE TYPE
-- ==========================================
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_source_type_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_source_type_check
  CHECK (source_type IN ('email', 'calendar', 'manual', 'whatsapp', 'telegram'));
