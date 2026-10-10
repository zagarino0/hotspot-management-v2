BEGIN;

-- Les échecs de connexion sont suivis séparément des erreurs de synchronisation
-- (identifiants absents, déchiffrement, traitement des données).
ALTER TABLE router
    ADD COLUMN IF NOT EXISTS consecutive_connection_failures INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS offline_since TIMESTAMPTZ;

ALTER TABLE router
    DROP CONSTRAINT IF EXISTS chk_router_consecutive_connection_failures;

ALTER TABLE router
    ADD CONSTRAINT chk_router_consecutive_connection_failures
        CHECK (consecutive_connection_failures >= 0);

-- Initialise les routeurs déjà hors ligne sans les faire entrer artificiellement
-- dans la fenêtre de détection des nouvelles pannes.
UPDATE router
SET offline_since = NULL,
    consecutive_connection_failures = 0
WHERE offline_since IS NULL;

CREATE INDEX IF NOT EXISTS idx_router_site_offline_since
    ON router(site_id, offline_since)
    WHERE status = 'OFFLINE' AND offline_since IS NOT NULL;

COMMIT;
