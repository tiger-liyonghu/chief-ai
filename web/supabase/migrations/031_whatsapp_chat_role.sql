-- Add chat_role to whatsapp_messages for reliable history role assignment.
-- Previously role was inferred from from_name='Apple', which broke when
-- Sophia's own briefings/alerts were misidentified as user messages.

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS chat_role TEXT
  CHECK (chat_role IN ('user', 'assistant'));

-- Backfill existing rows based on from_name
UPDATE whatsapp_messages SET chat_role = 'assistant'
  WHERE from_name IN ('Apple', 'Sophia') AND chat_role IS NULL;

UPDATE whatsapp_messages SET chat_role = 'user'
  WHERE (from_name IS NULL OR from_name NOT IN ('Apple', 'Sophia')) AND chat_role IS NULL;

-- Index for efficient history queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat_role
  ON whatsapp_messages (user_id, chat_role, received_at DESC);
