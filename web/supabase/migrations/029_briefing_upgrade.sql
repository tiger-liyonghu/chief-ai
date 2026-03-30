-- Briefing engine upgrade: window support + score tracking
ALTER TABLE daily_briefings ADD COLUMN IF NOT EXISTS window_key TEXT DEFAULT 'morning';
ALTER TABLE daily_briefings ADD COLUMN IF NOT EXISTS score JSONB;

-- Behavioral signals for briefing personalization
CREATE TABLE IF NOT EXISTS briefing_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  briefing_date DATE NOT NULL,
  item_type TEXT NOT NULL,
  item_ref TEXT,
  signal_type TEXT NOT NULL,
  response_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefing_signals_user_date ON briefing_signals(user_id, briefing_date);
