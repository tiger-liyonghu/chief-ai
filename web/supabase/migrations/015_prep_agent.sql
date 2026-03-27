-- Add Prep Agent briefing fields to meeting_briefs
ALTER TABLE public.meeting_briefs
  ADD COLUMN IF NOT EXISTS briefing TEXT,
  ADD COLUMN IF NOT EXISTS context_snapshot JSONB DEFAULT '{}';

-- Unique constraint for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_briefs_user_event
  ON public.meeting_briefs(user_id, event_id);
