BEGIN;

-- ============================================================
-- VOUCHER STATE TRANSITION AUDIT
--
-- Additive migration only:
-- - preserves all existing voucher rows
-- - gives each MikroTik disabled/enabled transition its own
--   deterministic occurrence timestamp
-- ============================================================

ALTER TABLE voucher
    ADD COLUMN IF NOT EXISTS mikrotik_state_changed_at TIMESTAMPTZ;

UPDATE voucher
   SET mikrotik_state_changed_at = COALESCE(
       mikrotik_state_changed_at,
       updated_at,
       created_at,
       NOW()
   )
 WHERE mikrotik_state_changed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_voucher_mikrotik_state_changed_at
    ON voucher(mikrotik_state_changed_at);

COMMIT;
