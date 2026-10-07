BEGIN;

CREATE TABLE IF NOT EXISTS hotspot_profile (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    duration_seconds BIGINT,
    default_price NUMERIC(14,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'MGA',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT chk_hotspot_profile_price
        CHECK (default_price >= 0),

    CONSTRAINT chk_hotspot_profile_currency
        CHECK (currency ~ '^[A-Z]{3}$'),

    CONSTRAINT chk_hotspot_profile_duration
        CHECK (
            duration_seconds IS NULL
            OR duration_seconds > 0
        ),

    CONSTRAINT chk_hotspot_profile_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

INSERT INTO hotspot_profile (
    code,
    name,
    duration_seconds,
    default_price,
    currency
)
VALUES
    ('profil_1h', '1 heure', 3600, 500, 'MGA'),
    ('profil_3h', '3 heures', 10800, 1000, 'MGA'),
    ('profil_24h', '24 heures', 86400, 2500, 'MGA'),
    ('profil_week', '7 jours', 604800, 7000, 'MGA'),
    ('profil_mothe_1', '30 jours', 2592000, 35000, 'MGA')
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    duration_seconds = EXCLUDED.duration_seconds,
    default_price = EXCLUDED.default_price,
    currency = EXCLUDED.currency;

CREATE TABLE IF NOT EXISTS site_hotspot_profile_price (
    site_id UUID NOT NULL,
    profile_code VARCHAR(50) NOT NULL,
    price NUMERIC(14,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'MGA',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (site_id, profile_code),

    CONSTRAINT fk_site_hotspot_profile_price_site
        FOREIGN KEY (site_id)
        REFERENCES site(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_site_hotspot_profile_price_profile
        FOREIGN KEY (profile_code)
        REFERENCES hotspot_profile(code)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_site_hotspot_profile_price
        CHECK (price >= 0),

    CONSTRAINT chk_site_hotspot_profile_currency
        CHECK (currency ~ '^[A-Z]{3}$')
);

INSERT INTO site_hotspot_profile_price (
    site_id,
    profile_code,
    price,
    currency
)
SELECT
    s.id,
    p.code,
    p.default_price,
    p.currency
FROM site s
CROSS JOIN hotspot_profile p
WHERE p.status = 'ACTIVE'
ON CONFLICT (site_id, profile_code) DO NOTHING;

ALTER TABLE sale
    ALTER COLUMN plan_id DROP NOT NULL;

ALTER TABLE sale
    ADD COLUMN IF NOT EXISTS profile_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS profile_name VARCHAR(150);

UPDATE sale sa
SET
    profile_code = COALESCE(sa.profile_code, p.code),
    profile_name = COALESCE(sa.profile_name, p.name)
FROM plan p
WHERE p.id = sa.plan_id;

CREATE INDEX IF NOT EXISTS idx_sale_profile_code
    ON sale(profile_code);

COMMIT;
