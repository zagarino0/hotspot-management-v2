BEGIN;

ALTER TABLE session
    ADD COLUMN IF NOT EXISTS mikrotik_profile VARCHAR(255),
    ADD COLUMN IF NOT EXISTS session_time_left_seconds BIGINT,
    ADD COLUMN IF NOT EXISTS login_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS cookie_present BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_session_voucher_id
    ON session(voucher_id);

CREATE INDEX IF NOT EXISTS idx_session_router_mac_status
    ON session(router_id, mac_address, status);

CREATE INDEX IF NOT EXISTS idx_session_voucher_status
    ON session(voucher_id, status);

COMMENT ON COLUMN session.mikrotik_profile IS
    'Profil HotSpot MikroTik réellement appliqué à cette connexion.';

COMMENT ON COLUMN session.session_time_left_seconds IS
    'Temps de session restant retourné par MikroTik Active.';

COMMENT ON COLUMN session.login_method IS
    'Méthode d authentification MikroTik Active login-by.';

COMMENT ON COLUMN session.cookie_present IS
    'Indique si un cookie HotSpot correspondant est présent sur le routeur.';

COMMIT;
