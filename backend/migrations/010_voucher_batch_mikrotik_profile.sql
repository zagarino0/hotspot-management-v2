-- Ajouter une colonne pour stocker le profil MikroTik dans les lots de vouchers
ALTER TABLE voucher_batch
ADD COLUMN mikrotik_profile VARCHAR(255);

-- Ajouter un index pour optimiser les recherches par profil
CREATE INDEX idx_voucher_batch_mikrotik_profile ON voucher_batch(mikrotik_profile);

-- Ajouter un commentaire pour documenter le champ
COMMENT ON COLUMN voucher_batch.mikrotik_profile IS 'Nom du profil MikroTik utilisé pour ce lot de vouchers (ex: profil_1H, profil_24H)';
