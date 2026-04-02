-- 039: Contact roles and city
-- Supports manifesto's three directions:
--   roles @> '["client"]'  → 客户不丢
--   roles @> '["family"]'  → 家庭不忘
--   city = trip.destination → 差旅不乱（联系人激活）

-- Role tags: a contact can have multiple roles simultaneously
-- e.g., ["client", "vip"] or ["family"] or ["client", "referrer"]
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS roles jsonb DEFAULT '[]';

-- City: for travel contact activation ("KL has 3 clients you can visit")
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS city text;

-- Initialize: VIP and high-importance contacts are likely clients
UPDATE contacts
SET roles = '["client"]'
WHERE importance IN ('vip', 'high')
  AND (roles IS NULL OR roles = '[]');

-- GIN index for fast role filtering
CREATE INDEX IF NOT EXISTS idx_contacts_roles ON contacts USING gin(roles);

-- B-tree index for city matching
CREATE INDEX IF NOT EXISTS idx_contacts_city ON contacts(city) WHERE city IS NOT NULL;
