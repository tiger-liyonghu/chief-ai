-- 041: Commitment context (family vs work)
-- Manifesto: "出差在外 → Sophia 记着你对家人的承诺"
-- Enables filtering family commitments separately from work commitments.

ALTER TABLE commitments ADD COLUMN IF NOT EXISTS context text DEFAULT 'work';
-- Values: 'work' (default), 'family'

CREATE INDEX IF NOT EXISTS idx_commitments_context ON commitments(context) WHERE context = 'family';
