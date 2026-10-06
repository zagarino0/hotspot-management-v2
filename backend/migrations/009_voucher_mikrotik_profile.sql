-- Ajouter une colonne pour stocker directement le profil MikroTik dans les vouchers
-- Cela permet d'utiliser les profils réels du routeur sans créer de plans intermédiaires

ALTER TABLE voucher
ADD COLUMN mikrotik_profile VARCHAR(255);

-- Ajouter un index pour optimiser les recherches par profil
CREATE INDEX idx_voucher_mikrotik_profile ON voucher(mikrotik_profile);

-- Ajouter un commentaire pour documenter le champ
COMMENT ON COLUMN voucher.mikrotik_profile IS 'Nom du profil MikroTik utilisé pour ce voucher (ex: profil_1H, profil_24H)';
