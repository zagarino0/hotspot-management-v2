BEGIN;

-- Ajouter une colonne pour le nom de domaine (optionnel pour routeurs distants)
ALTER TABLE router ADD COLUMN domain_name VARCHAR(255);

-- Ajouter un commentaire
COMMENT ON COLUMN router.domain_name IS 'Nom de domaine pour les routeurs distants (optionnel)';

COMMIT;
