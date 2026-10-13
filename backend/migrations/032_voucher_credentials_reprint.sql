BEGIN;

-- Keep voucher credentials recoverable only for controlled reprint.
-- AES-256-GCM encrypted by the application's existing CREDENTIALS_ENCRYPTION_KEY.
ALTER TABLE voucher
  ADD COLUMN IF NOT EXISTS mikrotik_password_encrypted TEXT;

CREATE INDEX IF NOT EXISTS idx_voucher_pos_batch
  ON voucher(point_of_sale_id, batch_id);

COMMENT ON COLUMN voucher.mikrotik_password_encrypted IS
  'Mot de passe Hotspot chiffré pour permettre une réimpression autorisée. Ne jamais exposer ce champ brut via API.';

COMMIT;
