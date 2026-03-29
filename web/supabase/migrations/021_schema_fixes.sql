-- Schema fixes from comprehensive audit
-- Migration 021

-- travel_policies: enable upsert by user_id
ALTER TABLE public.travel_policies ADD CONSTRAINT travel_policies_user_id_unique UNIQUE (user_id);

-- Missing indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_from_name ON public.whatsapp_messages(user_id, from_name);
CREATE INDEX IF NOT EXISTS idx_custom_agents_user_active ON public.custom_agents(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_boss_preferences_user ON public.boss_preferences(user_id);
