-- Migration 022: Commitments system (升级 follow_ups → commitments)
-- Core of Chief's 承诺层

-- 1. Create commitments table
CREATE TABLE IF NOT EXISTS public.commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- 承诺类型: 我承诺的 / 别人承诺的 / 家庭承诺
  type TEXT NOT NULL CHECK (type IN ('i_promised', 'they_promised', 'family')),

  -- 关联联系人（商业承诺）或家人名称（家庭承诺）
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  contact_name TEXT,
  contact_email TEXT,
  family_member TEXT,  -- 家庭承诺时使用: "Emily", "老婆", "儿子"

  -- 承诺内容
  title TEXT NOT NULL,
  description TEXT,

  -- 来源追踪
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN (
    'email', 'whatsapp', 'voice', 'calendar', 'manual'
  )),
  source_ref TEXT,          -- 邮件ID / 消息ID / 事件ID
  source_email_id UUID REFERENCES public.emails(id) ON DELETE SET NULL,

  -- 时间
  deadline DATE,
  deadline_fuzzy TEXT,      -- "下周", "尽快", "暑假前"

  -- AI 智能分级
  urgency_score INT DEFAULT 0,  -- Chief 计算: -3 到 +10
  confidence NUMERIC(3,2),      -- 提取置信度 0-1

  -- 状态
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'waiting', 'done', 'overdue', 'cancelled'
  )),

  -- 跟进
  last_nudge_at TIMESTAMPTZ,
  snoozed_until DATE,
  completed_at TIMESTAMPTZ,

  -- 关联
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own commitments"
  ON public.commitments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_commitments_user_status ON public.commitments(user_id, status);
CREATE INDEX idx_commitments_user_type ON public.commitments(user_id, type);
CREATE INDEX idx_commitments_deadline ON public.commitments(user_id, deadline) WHERE status IN ('pending', 'in_progress');
CREATE INDEX idx_commitments_contact ON public.commitments(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_commitments_overdue ON public.commitments(user_id, deadline) WHERE status = 'overdue';

-- 2. Migrate data from follow_ups → commitments
INSERT INTO public.commitments (
  user_id, type, contact_email, contact_name, title, description,
  source_type, source_email_id, deadline, status,
  last_nudge_at, snoozed_until, created_at
)
SELECT
  user_id,
  CASE
    WHEN type = 'reply_needed' THEN 'i_promised'
    WHEN type = 'waiting_on_them' THEN 'they_promised'
    ELSE type
  END,
  contact_email,
  contact_name,
  subject,
  commitment_text,
  'email',
  source_email_id,
  due_date,
  CASE
    WHEN status = 'resolved' THEN 'done'
    WHEN status = 'snoozed' THEN 'pending'
    ELSE 'pending'
  END,
  last_nudge_at,
  snoozed_until,
  created_at
FROM public.follow_ups;

-- 3. Create view for backward compatibility
CREATE OR REPLACE VIEW public.follow_ups_compat AS
SELECT
  id,
  user_id,
  CASE WHEN type = 'family' THEN 'i_promised' ELSE type END AS type,
  contact_email,
  contact_name,
  title AS subject,
  description AS commitment_text,
  source_email_id,
  deadline AS due_date,
  CASE
    WHEN status = 'done' THEN 'resolved'
    WHEN snoozed_until IS NOT NULL AND snoozed_until > CURRENT_DATE THEN 'snoozed'
    ELSE 'active'
  END AS status,
  snoozed_until,
  last_nudge_at,
  created_at
FROM public.commitments;

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION update_commitments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER commitments_updated_at
  BEFORE UPDATE ON public.commitments
  FOR EACH ROW EXECUTE FUNCTION update_commitments_updated_at();
