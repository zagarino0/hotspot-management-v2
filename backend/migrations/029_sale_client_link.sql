BEGIN;

ALTER TABLE sale
  ADD COLUMN IF NOT EXISTS client_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_sale_client_same_site'
      AND conrelid = 'sale'::regclass
  ) THEN
    ALTER TABLE sale
      ADD CONSTRAINT fk_sale_client_same_site
      FOREIGN KEY (site_id, client_id)
      REFERENCES client(site_id, id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sale_site_client_sold_at
  ON sale (site_id, client_id, sold_at DESC)
  WHERE client_id IS NOT NULL;

-- Backfill only when the existing voucher can be linked to a sale
-- that already contains customer contact details. No guessed identities.
UPDATE sale sa
SET client_id = c.id
FROM client c
WHERE sa.client_id IS NULL
  AND c.site_id = sa.site_id
  AND sa.voucher_id IS NOT NULL
  AND (
    (sa.customer_phone IS NOT NULL
      AND regexp_replace(sa.customer_phone, '\\D', '', 'g') <> ''
      AND regexp_replace(c.phone, '\\D', '', 'g') =
          regexp_replace(sa.customer_phone, '\\D', '', 'g'))
  );

-- Existing sessions inherit the client only through a known voucher sale.
UPDATE session se
SET client_id = sa.client_id
FROM sale sa
WHERE se.client_id IS NULL
  AND se.voucher_id IS NOT NULL
  AND sa.voucher_id = se.voucher_id
  AND sa.site_id = se.site_id
  AND sa.client_id IS NOT NULL;

COMMIT;
