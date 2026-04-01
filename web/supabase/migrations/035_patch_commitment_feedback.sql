-- Patch: add missing columns to commitment_feedback (table was pre-existing with different schema)

ALTER TABLE public.commitment_feedback
  ADD COLUMN IF NOT EXISTS signal_channel TEXT,
  ADD COLUMN IF NOT EXISTS signal_id UUID,
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS original_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS corrected_title TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
