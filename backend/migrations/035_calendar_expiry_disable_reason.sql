BEGIN;

-- Keep the POS lock reason and allow the calendar-expiry lock used by
-- voucher synchronization for the four calendar-validity profiles.
ALTER TABLE voucher
    DROP CONSTRAINT IF EXISTS chk_voucher_mikrotik_disabled_reason;

ALTER TABLE voucher
    ADD CONSTRAINT chk_voucher_mikrotik_disabled_reason
    CHECK (
      mikrotik_disabled_reason IS NULL
      OR mikrotik_disabled_reason IN (
        'POINT_OF_SALE_DISABLED',
        'CALENDAR_EXPIRY'
      )
    );

COMMIT;
