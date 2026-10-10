BEGIN;

-- Paramètres de clôture et de détection par organisation.
-- L'heure est administrable; le fuseau reste explicite et indépendant du serveur.
CREATE TABLE IF NOT EXISTS pos_sales_settings (
    organization_id UUID PRIMARY KEY REFERENCES organization(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    auto_closure_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    closure_time TIME NOT NULL DEFAULT TIME '20:00',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Indian/Antananarivo',
    detect_sale_on_first_use BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID REFERENCES "user"(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_pos_sales_settings_timezone
        CHECK (timezone = 'Indian/Antananarivo')
);

INSERT INTO pos_sales_settings (organization_id)
SELECT id FROM organization
ON CONFLICT (organization_id) DO NOTHING;

-- La première utilisation persistée et le prix snapshot restent distincts de la
-- date réelle de vente, qui ne peut pas être déduite de la connexion seule.
ALTER TABLE voucher
    ADD COLUMN IF NOT EXISTS first_use_detected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS first_use_detection_issue TEXT,
    ADD COLUMN IF NOT EXISTS price_snapshot NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS currency_snapshot VARCHAR(3);

ALTER TABLE voucher
    DROP CONSTRAINT IF EXISTS chk_voucher_price_snapshot,
    DROP CONSTRAINT IF EXISTS chk_voucher_currency_snapshot;

ALTER TABLE voucher
    ADD CONSTRAINT chk_voucher_price_snapshot
        CHECK (price_snapshot IS NULL OR price_snapshot >= 0),
    ADD CONSTRAINT chk_voucher_currency_snapshot
        CHECK (currency_snapshot IS NULL OR currency_snapshot ~ '^[A-Z]{3}$');

CREATE INDEX IF NOT EXISTS idx_voucher_first_use_pending
    ON voucher(point_of_sale_id, id)
    WHERE first_use_detected_at IS NULL;

-- Un versement est une remise physique d'argent; il ne constitue pas une vente.
CREATE TABLE IF NOT EXISTS point_of_sale_remittance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_of_sale_id UUID NOT NULL REFERENCES point_of_sale(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    business_date DATE NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'MGA',
    expected_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    remitted_amount NUMERIC(14,2) NOT NULL,
    difference NUMERIC(14,2) GENERATED ALWAYS AS (remitted_amount - expected_amount) STORED,
    remitted_by UUID REFERENCES "user"(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    recorded_by UUID REFERENCES "user"(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    remitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_pos_remittance_currency CHECK (currency = 'MGA'),
    CONSTRAINT chk_pos_remittance_amounts CHECK (expected_amount >= 0 AND remitted_amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_remittance_pos_business_date
    ON point_of_sale_remittance(point_of_sale_id, business_date);

CREATE INDEX IF NOT EXISTS idx_pos_remittance_pos_date
    ON point_of_sale_remittance(point_of_sale_id, business_date DESC);

-- Historique immuable des changements de clôture, notamment après détection tardive.
CREATE TABLE IF NOT EXISTS point_of_sale_closure_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    closure_id UUID NOT NULL REFERENCES point_of_sale_daily_closure(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    action VARCHAR(30) NOT NULL,
    previous_snapshot JSONB,
    new_snapshot JSONB NOT NULL,
    reason TEXT NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    actor_user_id UUID REFERENCES "user"(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_pos_closure_audit_action CHECK (
        action IN ('AUTO_CLOSED', 'REOPENED', 'RECALCULATED', 'MANUAL_UPDATE')
    ),
    CONSTRAINT chk_pos_closure_audit_source CHECK (
        source IN ('APPLICATION', 'SYSTEM')
    )
);

-- Une clôture automatique n'a pas d'utilisateur humain comme auteur.
ALTER TABLE point_of_sale_daily_closure
    DROP CONSTRAINT IF EXISTS chk_pos_daily_closure_closed_by,
    DROP CONSTRAINT IF EXISTS chk_pos_daily_closure_closed_at;

ALTER TABLE point_of_sale_daily_closure
    ADD CONSTRAINT chk_pos_daily_closure_closed_by
    CHECK (status <> 'CLOSED' OR closed_at IS NOT NULL);

-- Permissions administratives et financières.
INSERT INTO permission (name, code, resource, action, description)
VALUES
 ('Lire les paramètres de clôture POS', 'POS_SALES_SETTINGS_READ', 'POS_SALES_SETTINGS', 'READ', 'Consulter l’heure et les options de clôture automatique.'),
 ('Modifier les paramètres de clôture POS', 'POS_SALES_SETTINGS_UPDATE', 'POS_SALES_SETTINGS', 'UPDATE', 'Modifier les options de détection et de clôture automatique.'),
 ('Lire les versements POS', 'POS_REMITTANCES_READ', 'POS_REMITTANCES', 'READ', 'Consulter les remises d’argent et leurs écarts.'),
 ('Enregistrer un versement POS', 'POS_REMITTANCES_CREATE', 'POS_REMITTANCES', 'CREATE', 'Enregistrer un versement physique d’un point de vente.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
CROSS JOIN permission p
WHERE UPPER(r.code) = 'SUPER_ADMIN'
  AND p.code IN (
    'POS_SALES_SETTINGS_READ',
    'POS_SALES_SETTINGS_UPDATE',
    'POS_REMITTANCES_READ',
    'POS_REMITTANCES_CREATE'
  )
ON CONFLICT DO NOTHING;

COMMIT;
