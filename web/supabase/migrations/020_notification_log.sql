-- Notification dedup log — prevents duplicate sends on service restart
-- Migration 020

CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'briefing', 'overdue_reminder', 'pre_trip', 'landing', 'expense_summary'
  reference_id TEXT, -- trip_id or date string for dedup
  sent_date TEXT NOT NULL, -- YYYY-MM-DD in user's timezone
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, notification_type, reference_id, sent_date)
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user ON public.notification_log(user_id, notification_type, sent_date);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_own" ON public.notification_log FOR ALL USING (auth.uid() = user_id);

-- LLM usage tracking
CREATE TABLE IF NOT EXISTS public.llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  tool_calls INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  task_type TEXT, -- 'chat', 'briefing', 'tool_call', 'vision', 'agent'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_user ON public.llm_usage(user_id, created_at DESC);

ALTER TABLE public.llm_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "llm_own" ON public.llm_usage FOR ALL USING (auth.uid() = user_id);
