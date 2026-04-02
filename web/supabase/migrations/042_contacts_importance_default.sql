-- 042: Set default importance for contacts
-- Without importance, temperature algorithm / cooling detection / Weaver all return empty results.
-- Production test found: 0 contacts returned because all importance was NULL.

-- Set default for existing contacts
UPDATE contacts SET importance = 'normal' WHERE importance IS NULL;

-- Set column default for new contacts
ALTER TABLE contacts ALTER COLUMN importance SET DEFAULT 'normal';

-- Auto-promote: contacts with 10+ emails are at least 'high'
UPDATE contacts SET importance = 'high'
WHERE email_count >= 10 AND importance = 'normal';

-- Auto-promote: contacts with 20+ emails are VIP
UPDATE contacts SET importance = 'vip'
WHERE email_count >= 20 AND importance IN ('normal', 'high');
