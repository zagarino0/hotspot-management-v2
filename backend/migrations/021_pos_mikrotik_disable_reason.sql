BEGIN;

-- ============================================================
-- RAISON DE BLOCAGE MIKROTIK
-- Permet de distinguer un voucher désactivé par la gestion POS
-- d'un voucher désactivé pour une autre raison.
-- ============================================================

ALTER TABLE voucher
    ADD COLUMN IF NOT EXISTS mikrotik_disabled_reason VARCHAR(40);

ALTER TABLE voucher
    DROP CONSTRAINT IF EXISTS chk_voucher_mikrotik_disabled_reason;

ALTER TABLE voucher
    ADD CONSTRAINT chk_voucher_mikrotik_disabled_reason
    CHECK (
      mikrotik_disabled_reason IS NULL
      OR mikrotik_disabled_reason IN ('POINT_OF_SALE_DISABLED')
    );

CREATE INDEX IF NOT EXISTS idx_voucher_mikrotik_disabled_reason
    ON voucher(mikrotik_disabled_reason)
    WHERE mikrotik_disabled_reason IS NOT NULL;

COMMIT;
