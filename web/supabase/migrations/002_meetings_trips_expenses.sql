-- Chief v2 — Meeting Prep, Trips, Expenses

-- Meeting Briefs
CREATE TABLE IF NOT EXISTS public.meeting_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  attendee_email TEXT,
  attendee_name TEXT,
  interaction_summary TEXT,
  last_contact_date TIMESTAMPTZ,
  email_count INT DEFAULT 0,
  talking_points JSONB DEFAULT '[]',
  related_documents JSONB DEFAULT '[]',
  generated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_briefs_event ON public.meeting_briefs(event_id);

-- Trips
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  destination_city TEXT,
  destination_country TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  flight_info JSONB DEFAULT '[]',
  hotel_info JSONB DEFAULT '[]',
  source_email_ids UUID[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trips_user_date ON public.trips(user_id, start_date);

-- Trip Expenses
CREATE TABLE IF NOT EXISTS public.trip_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('flight', 'hotel', 'transport', 'meal', 'other')),
  merchant_name TEXT,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'SGD',
  amount_base DECIMAL(12,2),
  base_currency TEXT DEFAULT 'SGD',
  expense_date DATE NOT NULL,
  source_email_id UUID REFERENCES public.emails(id) ON DELETE SET NULL,
  receipt_url TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'exported')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_trip ON public.trip_expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON public.trip_expenses(user_id, expense_date DESC);

-- RLS
ALTER TABLE public.meeting_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefs_own" ON public.meeting_briefs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "trips_own" ON public.trips FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "expenses_own" ON public.trip_expenses FOR ALL USING (auth.uid() = user_id);
