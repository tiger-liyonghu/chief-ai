-- Migration 025: Insights Snapshots (洞察层)
-- Chief 的周报/月报数据

CREATE TABLE IF NOT EXISTS public.insights_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- 周期
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- 承诺统计
  commitment_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { total, completed, overdue, pending, compliance_rate,
  --   family_total, family_completed, family_compliance_rate,
  --   most_forgotten_type, avg_response_days }

  -- 关系统计
  relationship_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { active_contacts, new_contacts, cold_vips: [{name, days_since}],
  --   most_interacted: [{name, count}] }

  -- 出差统计
  travel_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { trips_count, total_days, total_expense, cities: [],
  --   meetings_per_trip_avg }

  -- 家庭统计
  family_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { estimated_family_hours, conflicts_detected, conflicts_avoided,
  --   family_commitments_kept, family_events_attended, missed_events: [] }

  -- 生成的文字报告
  content TEXT,

  -- 是否已推送给用户
  pushed_at TIMESTAMPTZ,
  push_channel TEXT,  -- 'whatsapp' | 'email' | 'dashboard'

  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.insights_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights"
  ON public.insights_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_insights_user_period ON public.insights_snapshots(user_id, period_type, period_start DESC);
CREATE UNIQUE INDEX idx_insights_unique_period ON public.insights_snapshots(user_id, period_type, period_start);
