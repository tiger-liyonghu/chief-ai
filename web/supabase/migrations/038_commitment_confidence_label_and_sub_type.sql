-- Gap 8: 4-level confidence labels (confirmed/likely/tentative/unlikely)
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS confidence_label TEXT DEFAULT 'likely';
COMMENT ON COLUMN commitments.confidence_label IS 'confirmed(>0.9) | likely(0.7-0.9) | tentative(0.4-0.7) | unlikely(<0.4). Per-person calibrated.';

-- Gap 5: Commitment type expansion (debt/investment/signal)
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS sub_type TEXT DEFAULT 'promise';
COMMENT ON COLUMN commitments.sub_type IS 'promise=承诺, debt=人情债, investment=关系投资, signal=优先级信号';
