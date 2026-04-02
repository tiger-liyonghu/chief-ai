-- 040: Policy table — insurance vertical expansion layer
-- Manifesto: "保单 45 天后到期 → Sophia 提醒你该联系续保了"

CREATE TABLE IF NOT EXISTS policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Client link
  contact_id uuid REFERENCES contacts(id),
  contact_email text,
  contact_name text,

  -- Policy details
  product_type text NOT NULL,  -- medical, life, critical_illness, accident, investment, property, motor
  insurer text,                -- insurance company name
  policy_number text,
  plan_name text,              -- specific plan name

  -- Dates
  start_date date,
  expiry_date date,            -- key field for renewal reminders
  last_renewal_date date,

  -- Financials
  premium_amount numeric,
  premium_frequency text,      -- monthly, quarterly, annually
  coverage_amount numeric,
  currency text DEFAULT 'SGD',

  -- Status
  status text NOT NULL DEFAULT 'active',  -- active, expiring, expired, lapsed, cancelled

  -- Source tracking
  signal_id text,              -- email/signal that this was detected from
  source text DEFAULT 'email', -- email, manual, import

  -- Metadata
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_policies_user ON policies(user_id);
CREATE INDEX IF NOT EXISTS idx_policies_expiry ON policies(expiry_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_policies_contact ON policies(contact_id);
