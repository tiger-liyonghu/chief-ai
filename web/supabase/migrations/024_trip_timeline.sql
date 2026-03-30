-- Migration 024: Trip Timeline Events (商旅层升级)
-- 活的出差时间线: 一变全变

-- 1. Add new fields to trips table
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS family_conflicts JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS total_expense NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'SGD',
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS city_card JSONB;  -- 落地时的城市卡信息

-- Update trips status check to include new statuses
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_status_check;
ALTER TABLE public.trips ADD CONSTRAINT trips_status_check
  CHECK (status IN ('planning', 'upcoming', 'pre_trip', 'active', 'post_trip', 'completed'));

-- 2. Trip timeline events table
CREATE TABLE IF NOT EXISTS public.trip_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- 时间
  event_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT false,

  -- 类型
  type TEXT NOT NULL CHECK (type IN (
    'flight', 'hotel_checkin', 'hotel_checkout',
    'meeting', 'meal', 'transport',
    'free_time', 'reminder', 'deadline'
  )),

  -- 内容
  title TEXT NOT NULL,
  details TEXT,
  location TEXT,
  location_lat NUMERIC(10,7),
  location_lng NUMERIC(10,7),

  -- 关联
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  commitment_id UUID REFERENCES public.commitments(id) ON DELETE SET NULL,
  calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,

  -- 元数据
  metadata JSONB DEFAULT '{}',
  -- flight: { airline, flight_no, seat, terminal, gate }
  -- hotel: { hotel_name, confirmation, address }
  -- meeting: { company, prep_notes, dress_code }
  -- transport: { mode, driver, phone, est_duration }
  -- meal: { restaurant, cuisine, dietary_notes, is_business }

  -- 状态
  is_auto_generated BOOLEAN DEFAULT false,
  is_confirmed BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'delayed')),
  delay_minutes INT,

  -- 排序
  sort_order INT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.trip_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own trip timeline events"
  ON public.trip_timeline_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_trip_timeline_trip ON public.trip_timeline_events(trip_id, event_time);
CREATE INDEX idx_trip_timeline_user ON public.trip_timeline_events(user_id, event_time);
CREATE INDEX idx_trip_timeline_type ON public.trip_timeline_events(trip_id, type);

-- Updated_at trigger
CREATE TRIGGER trip_timeline_updated_at
  BEFORE UPDATE ON public.trip_timeline_events
  FOR EACH ROW EXECUTE FUNCTION update_commitments_updated_at();
