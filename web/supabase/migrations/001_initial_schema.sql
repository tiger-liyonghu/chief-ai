-- AI Chief of Staff — Initial Schema
-- Run this in Supabase SQL Editor

-- ==========================================
-- PROFILES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'Asia/Singapore',
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team')),
  daily_brief_time TIME DEFAULT '08:00',
  writing_style_notes TEXT,
  onboarding_completed_at TIMESTAMPTZ,
  gdpr_consent_at TIMESTAMPTZ,
  gdpr_data_retention_days INT DEFAULT 90,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- GOOGLE TOKENS (encrypted)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  gmail_history_id TEXT,
  calendar_sync_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- ==========================================
-- EMAILS (metadata only — no body storage)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  subject TEXT,
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses TEXT[],
  received_at TIMESTAMPTZ NOT NULL,
  snippet TEXT,
  body_processed BOOLEAN DEFAULT false,
  is_reply_needed BOOLEAN DEFAULT false,
  reply_urgency INT DEFAULT 0,
  labels TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emails_user_received ON public.emails(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_thread ON public.emails(user_id, thread_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_gmail_id ON public.emails(user_id, gmail_message_id);

-- ==========================================
-- CALENDAR EVENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  attendees JSONB DEFAULT '[]',
  location TEXT,
  meeting_link TEXT,
  is_recurring BOOLEAN DEFAULT false,
  prep_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_user_start ON public.calendar_events(user_id, start_time);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_google_id ON public.calendar_events(user_id, google_event_id);

-- ==========================================
-- TASKS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority INT DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'dismissed')),
  source_type TEXT NOT NULL CHECK (source_type IN ('email', 'calendar', 'manual')),
  source_email_id UUID REFERENCES public.emails(id) ON DELETE SET NULL,
  source_event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  due_date DATE,
  due_reason TEXT,
  ai_confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON public.tasks(user_id, status, priority);

-- ==========================================
-- FOLLOW-UPS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('waiting_on_them', 'i_promised', 'reply_needed')),
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  subject TEXT NOT NULL,
  commitment_text TEXT,
  source_email_id UUID REFERENCES public.emails(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'snoozed')),
  snoozed_until DATE,
  last_nudge_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_followups_user_status ON public.follow_ups(user_id, status, due_date);

-- ==========================================
-- REPLY DRAFTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.reply_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  draft_content TEXT NOT NULL,
  tone TEXT DEFAULT 'professional',
  ai_model TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'edited', 'sent', 'discarded')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- SYNC LOG
-- ==========================================
CREATE TABLE IF NOT EXISTS public.sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  messages_processed INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reply_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

-- Profiles: users see own data
CREATE POLICY "profiles_own" ON public.profiles FOR ALL USING (auth.uid() = id);

-- Google tokens: only service role (never expose to client)
CREATE POLICY "tokens_service_only" ON public.google_tokens FOR ALL USING (false);

-- Other tables: users see own data
CREATE POLICY "emails_own" ON public.emails FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "events_own" ON public.calendar_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "tasks_own" ON public.tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "followups_own" ON public.follow_ups FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "drafts_own" ON public.reply_drafts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "synclog_own" ON public.sync_log FOR ALL USING (auth.uid() = user_id);
