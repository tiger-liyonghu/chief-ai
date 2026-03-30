-- Migration 023: Family Calendar (家庭层)
-- 双通道输入: Google Calendar 自动读取 + 口头告诉 Chief

CREATE TABLE IF NOT EXISTS public.family_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- 事件类型
  event_type TEXT NOT NULL CHECK (event_type IN (
    'hard_constraint',    -- 不可侵犯: 每周三接Emily钢琴课
    'important_date',     -- 重要日期: 纪念日、生日、节日
    'school_cycle',       -- 学校周期: 寒暑假、考试周
    'family_commitment'   -- 对家人的承诺: 答应带孩子去动物园
  )),

  title TEXT NOT NULL,
  description TEXT,

  -- 时间
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,        -- 具体时间（如15:30接钢琴课）
  end_time TIME,

  -- 重复规则
  recurrence TEXT CHECK (recurrence IN (
    'none', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly'
  )) DEFAULT 'none',
  recurrence_day INT,     -- 0=Sun..6=Sat (weekly时用)
  recurrence_month INT,   -- 1-12 (yearly时用)
  recurrence_until DATE,  -- 重复截止日

  -- 关联的家人
  family_member TEXT,      -- "Emily", "老婆", "全家"

  -- 数据来源
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('google_calendar', 'manual')),
  google_event_id TEXT,    -- 从GCal同步时保留原始ID
  google_calendar_id TEXT, -- 哪个GCal日历

  -- 状态
  is_active BOOLEAN DEFAULT true,

  -- 提醒设置
  remind_days_before INT DEFAULT 1,  -- 提前几天提醒

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.family_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own family calendar"
  ON public.family_calendar FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_family_cal_user_active ON public.family_calendar(user_id, is_active);
CREATE INDEX idx_family_cal_dates ON public.family_calendar(user_id, start_date, end_date) WHERE is_active = true;
CREATE INDEX idx_family_cal_type ON public.family_calendar(user_id, event_type) WHERE is_active = true;
CREATE INDEX idx_family_cal_recurrence ON public.family_calendar(user_id, recurrence) WHERE recurrence != 'none' AND is_active = true;

-- Updated_at trigger
CREATE TRIGGER family_calendar_updated_at
  BEFORE UPDATE ON public.family_calendar
  FOR EACH ROW EXECUTE FUNCTION update_commitments_updated_at();
