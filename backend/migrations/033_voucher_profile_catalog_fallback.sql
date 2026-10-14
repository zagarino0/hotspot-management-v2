-- Allow voucher batches to use a MikroTik profile backed by hotspot_profile
-- when no commercial plan exists. Price/currency/duration remain snapshotted on each voucher.
BEGIN;

ALTER TABLE voucher_batch ALTER COLUMN plan_id DROP NOT NULL;
ALTER TABLE voucher ALTER COLUMN plan_id DROP NOT NULL;

COMMIT;
