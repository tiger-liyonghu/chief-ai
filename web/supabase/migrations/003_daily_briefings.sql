-- Daily Briefings cache table
-- Stores AI-generated daily briefings to avoid regenerating on every page load

CREATE TABLE IF NOT EXISTS public.daily_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  briefing TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context_snapshot JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_briefings_user_date
  ON public.daily_briefings(user_id, generated_at DESC);

-- RLS
ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "briefings_own" ON public.daily_briefings FOR ALL USING (auth.uid() = user_id);

-- Add daily_brief_enabled to profiles (daily_brief_time already exists)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_brief_enabled BOOLEAN DEFAULT false;
