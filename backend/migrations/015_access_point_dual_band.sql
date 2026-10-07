BEGIN;

ALTER TABLE ap_radio
  DROP CONSTRAINT IF EXISTS chk_ap_radio_band;

ALTER TABLE ap_radio
  ADD CONSTRAINT chk_ap_radio_band
  CHECK (
    band IN (
      '2.4GHZ',
      '5GHZ',
      '2.4GHZ_5GHZ',
      '6GHZ',
      'OTHER'
    )
  );

COMMIT;
