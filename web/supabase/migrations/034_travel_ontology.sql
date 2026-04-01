-- Migration 034: Travel Ontology — Sophie 的商旅世界模型
--
-- 扩展现有 trips + trip_expenses 表，新增 flights/hotels/transports/meetings/dinners/forums

-- ==========================================
-- 1. TRIPS — 扩展现有表
-- ==========================================

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'business',
  ADD COLUMN IF NOT EXISTS cities TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS origin_city TEXT,
  ADD COLUMN IF NOT EXISTS travelers TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS budget_sgd NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS trip_summary TEXT,
  ADD COLUMN IF NOT EXISTS roi_notes TEXT;

-- 添加缺失的 status 值（原表只有 upcoming/active/completed）
-- 不能直接 ALTER CHECK，用新列的方式不破坏现有数据
-- 只在原表基础上添加字段即可

CREATE INDEX IF NOT EXISTS idx_trips_user_status ON public.trips(user_id, status);

-- ==========================================
-- 2. TRIP_FLIGHTS — 航班（新表）
-- ==========================================

CREATE TABLE IF NOT EXISTS public.trip_flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  airline TEXT,
  flight_number TEXT,
  origin_airport TEXT,
  dest_airport TEXT,
  departure_at TIMESTAMPTZ,
  arrival_at TIMESTAMPTZ,
  terminal_departure TEXT,
  terminal_arrival TEXT,
  booking_ref TEXT,
  ticket_number TEXT,
  status TEXT DEFAULT 'booked' CHECK (status IN (
    'booked', 'checked_in', 'boarded', 'completed', 'cancelled', 'delayed'
  )),

  cabin_class TEXT CHECK (cabin_class IN ('economy', 'premium_economy', 'business', 'first')),
  seat_number TEXT,
  seat_pref TEXT CHECK (seat_pref IN ('window', 'aisle', 'middle', 'bulkhead', 'exit_row')),
  meal_pref TEXT,

  ff_program TEXT,
  ff_number TEXT,
  lounge_access TEXT,
  baggage_allowance TEXT,

  signal_id UUID,
  signal_channel TEXT,
  leg_order INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trip_flights ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own trip_flights' AND tablename = 'trip_flights') THEN
    CREATE POLICY "Users can manage own trip_flights"
      ON public.trip_flights FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_trip_flights_trip ON public.trip_flights(trip_id, leg_order);

-- ==========================================
-- 3. TRIP_HOTELS — 酒店（新表）
-- ==========================================

CREATE TABLE IF NOT EXISTS public.trip_hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  checkin_at TIMESTAMPTZ,
  checkout_at TIMESTAMPTZ,
  booking_ref TEXT,
  booking_source TEXT,
  status TEXT DEFAULT 'booked' CHECK (status IN (
    'booked', 'checked_in', 'checked_out', 'cancelled'
  )),

  room_type TEXT,
  bed_type TEXT CHECK (bed_type IN ('king', 'twin', 'queen', 'single')),
  floor_pref TEXT,
  smoking BOOLEAN DEFAULT false,
  view_pref TEXT,

  late_checkout TEXT DEFAULT 'not_requested' CHECK (late_checkout IN ('not_requested', 'requested', 'confirmed', 'denied')),
  early_checkin TEXT DEFAULT 'not_requested' CHECK (early_checkin IN ('not_requested', 'requested', 'confirmed', 'denied')),
  breakfast_included BOOLEAN DEFAULT false,
  wifi_info TEXT,

  loyalty_program TEXT,
  member_number TEXT,
  cancellation_policy TEXT,
  notes TEXT,

  signal_id UUID,
  signal_channel TEXT,
  leg_order INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trip_hotels ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own trip_hotels' AND tablename = 'trip_hotels') THEN
    CREATE POLICY "Users can manage own trip_hotels"
      ON public.trip_hotels FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_trip_hotels_trip ON public.trip_hotels(trip_id, leg_order);

-- ==========================================
-- 4. TRIP_TRANSPORTS — 地面交通（新表）
-- ==========================================

CREATE TABLE IF NOT EXISTS public.trip_transports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  mode TEXT DEFAULT 'car' CHECK (mode IN (
    'airport_transfer', 'city_car', 'train', 'rental', 'ride_hail', 'ferry', 'bus', 'other'
  )),
  provider TEXT,
  pickup_at TIMESTAMPTZ,
  pickup_location TEXT,
  dropoff_location TEXT,
  driver_name TEXT,
  driver_phone TEXT,
  vehicle_info TEXT,
  booking_ref TEXT,
  estimated_duration TEXT,
  estimated_cost TEXT,
  notes TEXT,

  signal_id UUID,
  signal_channel TEXT,
  leg_order INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trip_transports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own trip_transports' AND tablename = 'trip_transports') THEN
    CREATE POLICY "Users can manage own trip_transports"
      ON public.trip_transports FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_trip_transports_trip ON public.trip_transports(trip_id, leg_order);

-- ==========================================
-- 5. TRIP_MEETINGS — 会议（新表）
-- ==========================================

CREATE TABLE IF NOT EXISTS public.trip_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  meeting_type TEXT DEFAULT 'client' CHECK (meeting_type IN (
    'client', 'partner', 'internal', 'board', 'government', 'networking', 'other'
  )),
  status TEXT DEFAULT 'tentative' CHECK (status IN (
    'tentative', 'confirmed', 'completed', 'cancelled', 'rescheduled'
  )),

  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  duration_min INT,
  location TEXT,
  location_notes TEXT,

  host_name TEXT,
  host_title TEXT,
  host_email TEXT,
  host_ea TEXT,
  attendees JSONB DEFAULT '[]',

  brief TEXT,
  objectives TEXT,
  materials TEXT[] DEFAULT '{}',
  dress_code TEXT,
  cultural_notes TEXT,
  gift TEXT,

  notes TEXT,
  decisions TEXT[] DEFAULT '{}',
  follow_up_notes TEXT,

  signal_id UUID,
  signal_channel TEXT,
  calendar_event_id UUID,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trip_meetings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own trip_meetings' AND tablename = 'trip_meetings') THEN
    CREATE POLICY "Users can manage own trip_meetings"
      ON public.trip_meetings FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_trip_meetings_trip ON public.trip_meetings(trip_id, start_at);

-- ==========================================
-- 6. TRIP_DINNERS — 商务餐（新表）
-- ==========================================

CREATE TABLE IF NOT EXISTS public.trip_dinners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  purpose TEXT DEFAULT 'relationship' CHECK (purpose IN (
    'relationship', 'celebration', 'negotiation', 'team', 'casual'
  )),
  formality TEXT DEFAULT 'semi_formal' CHECK (formality IN (
    'casual', 'semi_formal', 'formal'
  )),
  status TEXT DEFAULT 'planning' CHECK (status IN (
    'planning', 'reserved', 'confirmed', 'completed', 'cancelled'
  )),

  start_at TIMESTAMPTZ,
  restaurant_name TEXT,
  cuisine TEXT,
  address TEXT,
  reservation_ref TEXT,
  reserved_by TEXT,
  private_room BOOLEAN DEFAULT false,
  price_range TEXT,

  host TEXT,
  guests JSONB DEFAULT '[]',
  seating_notes TEXT,

  dietary_notes TEXT,
  alcohol_notes TEXT,
  etiquette_notes TEXT,
  conversation_topics TEXT,

  expense_split TEXT CHECK (expense_split IN ('we_host', 'they_host', 'split', 'tbd')),
  follow_up_notes TEXT,

  signal_id UUID,
  signal_channel TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trip_dinners ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own trip_dinners' AND tablename = 'trip_dinners') THEN
    CREATE POLICY "Users can manage own trip_dinners"
      ON public.trip_dinners FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_trip_dinners_trip ON public.trip_dinners(trip_id, start_at);

-- ==========================================
-- 7. TRIP_FORUMS — 论坛 / 峰会（新表）
-- ==========================================

CREATE TABLE IF NOT EXISTS public.trip_forums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  venue TEXT,
  start_date DATE,
  end_date DATE,
  registration_ref TEXT,
  badge_type TEXT CHECK (badge_type IN (
    'speaker', 'attendee', 'exhibitor', 'vip', 'sponsor', 'media', 'other'
  )),
  status TEXT DEFAULT 'registered' CHECK (status IN (
    'interested', 'registered', 'attending', 'completed', 'cancelled'
  )),

  agenda JSONB DEFAULT '[]',

  talk_title TEXT,
  talk_slides TEXT,
  talk_duration_min INT,
  av_requirements TEXT,

  target_contacts JSONB DEFAULT '[]',
  booth_visits TEXT[] DEFAULT '{}',

  booth_number TEXT,
  booth_setup_at TIMESTAMPTZ,
  booth_materials TEXT[] DEFAULT '{}',
  booth_staff TEXT[] DEFAULT '{}',

  contacts_made JSONB DEFAULT '[]',
  learnings TEXT,
  follow_up_notes TEXT,

  signal_id UUID,
  signal_channel TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trip_forums ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own trip_forums' AND tablename = 'trip_forums') THEN
    CREATE POLICY "Users can manage own trip_forums"
      ON public.trip_forums FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_trip_forums_trip ON public.trip_forums(trip_id, start_date);

-- ==========================================
-- 8. TRIP_EXPENSES — 扩展现有表
-- ==========================================

ALTER TABLE public.trip_expenses
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS client_code TEXT,
  ADD COLUMN IF NOT EXISTS project_code TEXT,
  ADD COLUMN IF NOT EXISTS receipt_ocr JSONB,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS card_last4 TEXT,
  ADD COLUMN IF NOT EXISTS reimbursable BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS flight_id UUID REFERENCES public.trip_flights(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES public.trip_hotels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transport_id UUID REFERENCES public.trip_transports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES public.trip_meetings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dinner_id UUID REFERENCES public.trip_dinners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forum_id UUID REFERENCES public.trip_forums(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signal_id UUID,
  ADD COLUMN IF NOT EXISTS signal_channel TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ==========================================
-- 9. Updated_at triggers
-- ==========================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trips_updated_at') THEN
    CREATE TRIGGER trips_updated_at BEFORE UPDATE ON public.trips
      FOR EACH ROW EXECUTE FUNCTION update_commitments_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trip_flights_updated_at') THEN
    CREATE TRIGGER trip_flights_updated_at BEFORE UPDATE ON public.trip_flights
      FOR EACH ROW EXECUTE FUNCTION update_commitments_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trip_hotels_updated_at') THEN
    CREATE TRIGGER trip_hotels_updated_at BEFORE UPDATE ON public.trip_hotels
      FOR EACH ROW EXECUTE FUNCTION update_commitments_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trip_transports_updated_at') THEN
    CREATE TRIGGER trip_transports_updated_at BEFORE UPDATE ON public.trip_transports
      FOR EACH ROW EXECUTE FUNCTION update_commitments_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trip_meetings_updated_at') THEN
    CREATE TRIGGER trip_meetings_updated_at BEFORE UPDATE ON public.trip_meetings
      FOR EACH ROW EXECUTE FUNCTION update_commitments_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trip_dinners_updated_at') THEN
    CREATE TRIGGER trip_dinners_updated_at BEFORE UPDATE ON public.trip_dinners
      FOR EACH ROW EXECUTE FUNCTION update_commitments_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trip_forums_updated_at') THEN
    CREATE TRIGGER trip_forums_updated_at BEFORE UPDATE ON public.trip_forums
      FOR EACH ROW EXECUTE FUNCTION update_commitments_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trip_expenses_updated_at') THEN
    CREATE TRIGGER trip_expenses_updated_at BEFORE UPDATE ON public.trip_expenses
      FOR EACH ROW EXECUTE FUNCTION update_commitments_updated_at();
  END IF;
END $$;
