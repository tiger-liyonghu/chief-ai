-- Assistant personalization: custom name, human assistant support, task assignment
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assistant_name TEXT DEFAULT 'Chief';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_human_assistant BOOLEAN DEFAULT false;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to TEXT DEFAULT 'me';

CREATE TABLE IF NOT EXISTS human_assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'assistant',
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_human_assistants_user_id ON human_assistants(user_id);

-- RLS
ALTER TABLE human_assistants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own human assistants"
  ON human_assistants
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
