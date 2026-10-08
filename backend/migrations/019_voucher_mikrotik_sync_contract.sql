BEGIN;

-- ============================================================
-- VOUCHER / MIKROTIK SOURCE-OF-TRUTH CONTRACT
--
-- Additive migration only:
-- - no existing rows are deleted
-- - existing application-generated vouchers keep their data
-- - MikroTik-originated vouchers may exist without a commercial plan
-- ============================================================

ALTER TABLE plan
    ADD COLUMN IF NOT EXISTS mikrotik_profile_code VARCHAR(50);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_plan_mikrotik_profile'
          AND conrelid = 'plan'::regclass
    ) THEN
        ALTER TABLE plan
            ADD CONSTRAINT fk_plan_mikrotik_profile
            FOREIGN KEY (mikrotik_profile_code)
            REFERENCES hotspot_profile(code)
            ON UPDATE CASCADE
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_plan_mikrotik_profile_code
    ON plan(mikrotik_profile_code);

ALTER TABLE voucher
    ALTER COLUMN plan_id DROP NOT NULL;

ALTER TABLE voucher
    ADD COLUMN IF NOT EXISTS router_id UUID,
    ADD COLUMN IF NOT EXISTS mikrotik_username VARCHAR(150),
    ADD COLUMN IF NOT EXISTS mikrotik_comment TEXT,
    ADD COLUMN IF NOT EXISTS mikrotik_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS mikrotik_last_seen_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS point_of_sale_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_voucher_router_same_site'
          AND conrelid = 'voucher'::regclass
    ) THEN
        ALTER TABLE voucher
            ADD CONSTRAINT fk_voucher_router_same_site
            FOREIGN KEY (site_id, router_id)
            REFERENCES router(site_id, id)
            ON UPDATE CASCADE
            ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_voucher_point_of_sale'
          AND conrelid = 'voucher'::regclass
    ) THEN
        ALTER TABLE voucher
            ADD CONSTRAINT fk_voucher_point_of_sale
            FOREIGN KEY (point_of_sale_id)
            REFERENCES point_of_sale(id)
            ON UPDATE CASCADE
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_voucher_mikrotik_identity
    ON voucher(router_id, mikrotik_username)
    WHERE router_id IS NOT NULL
      AND mikrotik_username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_voucher_mikrotik_username
    ON voucher(mikrotik_username);

CREATE INDEX IF NOT EXISTS idx_voucher_router_last_seen
    ON voucher(router_id, mikrotik_last_seen_at);

CREATE INDEX IF NOT EXISTS idx_voucher_point_of_sale
    ON voucher(point_of_sale_id);

CREATE TABLE IF NOT EXISTS voucher_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id UUID,
    site_id UUID NOT NULL,
    router_id UUID,
    username VARCHAR(150),
    voucher_code VARCHAR(100),
    point_of_sale_id UUID,
    point_of_sale_code VARCHAR(80),
    event_type VARCHAR(50) NOT NULL,
    source VARCHAR(20) NOT NULL,
    actor_user_id UUID,
    event_key VARCHAR(255) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_voucher_event_voucher
        FOREIGN KEY (voucher_id)
        REFERENCES voucher(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_voucher_event_site
        FOREIGN KEY (site_id)
        REFERENCES site(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_voucher_event_router
        FOREIGN KEY (router_id)
        REFERENCES router(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_voucher_event_point_of_sale
        FOREIGN KEY (point_of_sale_id)
        REFERENCES point_of_sale(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT chk_voucher_event_type
        CHECK (event_type IN (
            'DISCOVERED',
            'POS_IDENTIFIED',
            'SOLD',
            'SESSION_STARTED',
            'SESSION_ENDED',
            'DISABLED',
            'ENABLED',
            'DELETED_FROM_MIKROTIK',
            'SYNC_ANOMALY'
        )),

    CONSTRAINT chk_voucher_event_source
        CHECK (source IN (
            'MIKROTIK',
            'SYNCHRONIZER',
            'APPLICATION',
            'SYSTEM'
        )),

    CONSTRAINT chk_voucher_event_key
        CHECK (LENGTH(TRIM(event_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_voucher_event_key
    ON voucher_event(event_key);

CREATE INDEX IF NOT EXISTS idx_voucher_event_voucher
    ON voucher_event(voucher_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_voucher_event_router_username
    ON voucher_event(router_id, username, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_voucher_event_pos
    ON voucher_event(point_of_sale_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_voucher_event_type
    ON voucher_event(event_type, occurred_at DESC);

COMMENT ON TABLE voucher_event IS
    'Journal immuable des événements voucher. Les événements survivent à la suppression du voucher opérationnel.';

COMMIT;