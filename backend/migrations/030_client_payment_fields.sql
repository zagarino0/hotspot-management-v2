BEGIN;

ALTER TABLE client
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ;

ALTER TABLE client
  DROP CONSTRAINT IF EXISTS client_payment_status_check;

ALTER TABLE client
  ADD CONSTRAINT client_payment_status_check
  CHECK (
    payment_status IS NULL
    OR payment_status IN ('PAID', 'PENDING', 'CANCELLED', 'UNPAID')
  );

COMMIT;
