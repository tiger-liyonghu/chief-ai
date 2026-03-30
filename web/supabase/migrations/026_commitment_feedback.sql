-- Migration 026: Commitment feedback for precision tracking
-- Tracks user corrections to LLM-extracted commitments for few-shot learning.

CREATE TABLE IF NOT EXISTS public.commitment_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  commitment_id UUID REFERENCES public.commitments(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('confirmed', 'rejected', 'manual_add', 'modified')),
  original_title TEXT,
  original_type TEXT,
  modified_title TEXT,
  source_email_snippet TEXT,
  source_type TEXT,
  llm_confidence NUMERIC(3,2),
  llm_rejected_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.commitment_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own feedback"
  ON public.commitment_feedback FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_feedback_user ON public.commitment_feedback(user_id, feedback_type);
CREATE INDEX idx_feedback_user_created ON public.commitment_feedback(user_id, created_at DESC);
CREATE INDEX idx_feedback_commitment ON public.commitment_feedback(commitment_id) WHERE commitment_id IS NOT NULL;
