-- Migration 033: Ontology — Signals + Topics + Signal Chain
-- Sophie 的统一世界模型：Actor + Signal + Topic + Commitment + Occasion
--
-- Signal = 邮件/WhatsApp/日历的统一抽象（Sophie 的眼睛）
-- Topic  = 跨渠道事项聚合（"跟 Lisa 谈的报价单"这件事）

-- ==========================================
-- 1. SIGNALS — 统一视图
-- ==========================================
-- 不建新表，用 view 统一三个渠道。下游功能读 signals，不直接读 emails/whatsapp/calendar。

CREATE OR REPLACE VIEW public.signals AS

-- Email signals
SELECT
  e.id,
  e.user_id,
  'email'::text AS channel,
  e.from_address AS sender_id,
  e.from_name AS sender_name,
  COALESCE(e.to_addresses[1], '') AS recipient_id,
  e.subject AS title,
  COALESCE(e.snippet, '') AS preview,
  e.received_at AS timestamp,
  CASE
    WHEN e.labels @> ARRAY['SENT'] THEN 'outbound'
    ELSE 'inbound'
  END AS direction,
  e.is_reply_needed,
  e.reply_urgency,
  e.thread_id,
  e.body_text,
  e.commitment_scanned,
  e.body_processed,
  e.source_account_email
FROM public.emails e

UNION ALL

-- WhatsApp signals
SELECT
  w.id,
  w.user_id,
  'whatsapp'::text AS channel,
  w.from_number AS sender_id,
  w.from_name AS sender_name,
  w.to_number AS recipient_id,
  NULL AS title,
  COALESCE(w.body, '[' || w.message_type || ']') AS preview,
  w.received_at AS timestamp,
  w.direction::text,
  false AS is_reply_needed,
  0 AS reply_urgency,
  NULL AS thread_id,
  w.body AS body_text,
  w.is_task_extracted AS commitment_scanned,
  w.is_task_extracted AS body_processed,
  NULL AS source_account_email
FROM public.whatsapp_messages w

UNION ALL

-- Calendar signals
SELECT
  ce.id,
  ce.user_id,
  'calendar'::text AS channel,
  NULL AS sender_id,
  NULL AS sender_name,
  NULL AS recipient_id,
  ce.title,
  COALESCE(ce.description, '') AS preview,
  ce.start_time AS timestamp,
  'shared'::text AS direction,
  false AS is_reply_needed,
  0 AS reply_urgency,
  NULL AS thread_id,
  ce.description AS body_text,
  true AS commitment_scanned,
  true AS body_processed,
  ce.source_account_email
FROM public.calendar_events ce;

COMMENT ON VIEW public.signals IS 'Unified signal view across email, WhatsApp, and calendar. Sophie 的眼睛。';

-- ==========================================
-- 2. TOPICS — 跨渠道事项聚合
-- ==========================================

CREATE TABLE IF NOT EXISTS public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  primary_actor_email TEXT,
  primary_actor_name TEXT,
  actor_ids TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'stale', 'archived')),
  urgency_score INT DEFAULT 0,
  signal_count INT DEFAULT 0,
  commitment_count INT DEFAULT 0,
  last_signal_at TIMESTAMPTZ,
  first_signal_at TIMESTAMPTZ,
  source_thread_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own topics' AND tablename = 'topics') THEN
    CREATE POLICY "Users can manage own topics"
      ON public.topics FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_topics_user_status ON public.topics(user_id, status);
CREATE INDEX IF NOT EXISTS idx_topics_user_urgency ON public.topics(user_id, urgency_score DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_topics_thread ON public.topics(user_id, source_thread_id) WHERE source_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_topics_actor ON public.topics(user_id, primary_actor_email) WHERE primary_actor_email IS NOT NULL;

-- Updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'topics_updated_at') THEN
    CREATE TRIGGER topics_updated_at
      BEFORE UPDATE ON public.topics
      FOR EACH ROW EXECUTE FUNCTION update_commitments_updated_at();
  END IF;
END $$;

-- ==========================================
-- 3. TOPIC_SIGNALS — 关联表
-- ==========================================

CREATE TABLE IF NOT EXISTS public.topic_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_channel TEXT NOT NULL CHECK (signal_channel IN ('email', 'whatsapp', 'calendar')),
  signal_id UUID NOT NULL,
  role TEXT DEFAULT 'context' CHECK (role IN (
    'origin', 'commitment', 'follow_up', 'resolution', 'context'
  )),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(topic_id, signal_channel, signal_id)
);

ALTER TABLE public.topic_signals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own topic_signals' AND tablename = 'topic_signals') THEN
    CREATE POLICY "Users can manage own topic_signals"
      ON public.topic_signals FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_topic_signals_topic ON public.topic_signals(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_signals_signal ON public.topic_signals(signal_channel, signal_id);

-- ==========================================
-- 4. COMMITMENTS — 添加 signal_id 和 signal_chain
-- ==========================================

ALTER TABLE public.commitments
  ADD COLUMN IF NOT EXISTS signal_id UUID,
  ADD COLUMN IF NOT EXISTS signal_channel TEXT CHECK (signal_channel IN ('email', 'whatsapp', 'calendar')),
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signal_chain JSONB DEFAULT '[]';

-- 回填 signal_id：现有承诺的 source_email_id → signal_id
UPDATE public.commitments
SET signal_id = source_email_id,
    signal_channel = 'email'
WHERE source_email_id IS NOT NULL
  AND signal_id IS NULL;

-- 从 source_type 推断 signal_channel
UPDATE public.commitments
SET signal_channel = CASE
  WHEN source_type = 'email' THEN 'email'
  WHEN source_type = 'whatsapp' THEN 'whatsapp'
  WHEN source_type = 'calendar' THEN 'calendar'
  ELSE NULL
END
WHERE signal_channel IS NULL AND source_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commitments_signal ON public.commitments(signal_channel, signal_id) WHERE signal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commitments_topic ON public.commitments(topic_id) WHERE topic_id IS NOT NULL;

-- ==========================================
-- 5. COMMITMENT_FEEDBACK — 用户反馈表
-- ==========================================

CREATE TABLE IF NOT EXISTS public.commitment_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  commitment_id UUID REFERENCES public.commitments(id) ON DELETE SET NULL,
  signal_channel TEXT,
  signal_id UUID,
  action TEXT NOT NULL CHECK (action IN ('confirmed', 'rejected', 'corrected')),
  original_confidence NUMERIC(3,2),
  original_title TEXT,
  corrected_title TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.commitment_feedback ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own feedback' AND tablename = 'commitment_feedback') THEN
    CREATE POLICY "Users can manage own feedback"
      ON public.commitment_feedback FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_feedback_user ON public.commitment_feedback(user_id, created_at DESC);
