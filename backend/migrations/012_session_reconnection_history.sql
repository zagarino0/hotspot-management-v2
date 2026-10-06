BEGIN;

ALTER TABLE session
    ADD COLUMN IF NOT EXISTS voucher_remaining_seconds_at_end BIGINT;

COMMENT ON COLUMN session.voucher_remaining_seconds_at_end IS
    'Temps restant sur le voucher au moment exact de la déconnexion de cette session.';

CREATE INDEX IF NOT EXISTS idx_session_voucher_ended_at
    ON session(voucher_id, ended_at);

COMMIT;
