BEGIN;

ALTER TABLE point_of_sale
  ADD COLUMN IF NOT EXISTS opening_time TIME NOT NULL DEFAULT TIME '08:00',
  ADD COLUMN IF NOT EXISTS closing_time TIME NOT NULL DEFAULT TIME '20:00';

ALTER TABLE point_of_sale
  ADD CONSTRAINT chk_point_of_sale_opening_time
    CHECK (opening_time >= TIME '00:00' AND opening_time < TIME '24:00'),
  ADD CONSTRAINT chk_point_of_sale_closing_time
    CHECK (closing_time >= TIME '00:00' AND closing_time < TIME '24:00');

COMMIT;
