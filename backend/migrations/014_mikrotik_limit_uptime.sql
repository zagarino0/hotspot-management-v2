BEGIN;

ALTER TABLE session
    ADD COLUMN IF NOT EXISTS mikrotik_limit_uptime_seconds BIGINT;

COMMENT ON COLUMN session.mikrotik_limit_uptime_seconds IS
    'Quota totale de temps configure sur le compte HotSpot MikroTik via limit-uptime.';

CREATE INDEX IF NOT EXISTS idx_session_router_username_status
    ON session(router_id, username, status);

COMMIT;
