-- Migration 028: Contact Channels
-- One person, many contact methods (email, phone, WhatsApp, Telegram, WeChat, LinkedIn)

CREATE TABLE IF NOT EXISTS public.contact_channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,

  channel_type TEXT NOT NULL CHECK (channel_type IN (
    'email', 'phone', 'whatsapp', 'telegram', 'wechat',
    'linkedin', 'twitter', 'line', 'slack', 'teams', 'other'
  )),
  channel_value TEXT NOT NULL,     -- the actual address/number/handle
  label        TEXT,               -- 'work', 'personal', 'assistant'
  is_primary   BOOLEAN DEFAULT false,
  is_preferred BOOLEAN DEFAULT false,  -- preferred channel for this person
  notes        TEXT,

  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.contact_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own contact channels"
  ON public.contact_channels FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_contact_channels_contact ON public.contact_channels(contact_id);
CREATE INDEX idx_contact_channels_lookup ON public.contact_channels(user_id, channel_type, channel_value);
CREATE UNIQUE INDEX idx_contact_channels_unique ON public.contact_channels(user_id, contact_id, channel_type, channel_value);

CREATE TRIGGER contact_channels_updated_at
  BEFORE UPDATE ON public.contact_channels
  FOR EACH ROW EXECUTE FUNCTION update_commitments_updated_at();
