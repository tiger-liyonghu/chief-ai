-- Sophia Brain: Memory + Behavior + Interventions
-- Part of the Sophia Organ System (Brain, Heart, Ears)

-- 1. Episodic Memory — Sophia remembers important events and outcomes
CREATE TABLE IF NOT EXISTS sophia_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('event', 'lesson', 'preference', 'pattern')),
  content TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  importance INT DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  confidence NUMERIC(3,2) DEFAULT 0.70,
  source TEXT CHECK (source IN ('observed', 'user_stated', 'inferred')),
  related_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  related_commitment_id UUID REFERENCES commitments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ DEFAULT now(),
  access_count INT DEFAULT 0
);

CREATE INDEX idx_sophia_memories_user ON sophia_memories(user_id, importance DESC);
CREATE INDEX idx_sophia_memories_contact ON sophia_memories(related_contact_id) WHERE related_contact_id IS NOT NULL;

-- 2. Behavior Profile — Sophia learns how the user works
CREATE TABLE IF NOT EXISTS user_behavior_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  response_time_avg_hours FLOAT,
  peak_hours INT[] DEFAULT '{}',
  commitment_delay_avg_days FLOAT,
  family_priority_score NUMERIC(3,2),
  communication_style JSONB DEFAULT '{}',
  energy_pattern JSONB DEFAULT '{}',
  data_points INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Interventions — Track when Sophia proactively intervenes
CREATE TABLE IF NOT EXISTS sophia_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  intervention_type TEXT NOT NULL,
  trigger_reason TEXT NOT NULL,
  message_sent TEXT NOT NULL,
  channel TEXT CHECK (channel IN ('whatsapp', 'dashboard', 'briefing')),
  user_action TEXT DEFAULT 'pending' CHECK (user_action IN ('accepted', 'ignored', 'rejected', 'pending')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sophia_interventions_user ON sophia_interventions(user_id, created_at DESC);

-- 4. Chat Sessions — Working memory across messages
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel TEXT DEFAULT 'dashboard' CHECK (channel IN ('dashboard', 'whatsapp')),
  summary TEXT,
  message_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, updated_at DESC);

-- RLS policies
ALTER TABLE sophia_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behavior_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE sophia_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sophia_memories_user ON sophia_memories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY user_behavior_profile_user ON user_behavior_profile FOR ALL USING (auth.uid() = user_id);
CREATE POLICY sophia_interventions_user ON sophia_interventions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY chat_sessions_user ON chat_sessions FOR ALL USING (auth.uid() = user_id);
