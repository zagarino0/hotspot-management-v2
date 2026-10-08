BEGIN;

-- ============================================================
-- POINT OF SALE
-- Une entité commerciale indépendante du site réseau.
-- Un même point de vente peut donc être utilisé sur plusieurs sites.
-- ============================================================

CREATE TABLE point_of_sale (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL,

    code VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,

    type VARCHAR(20) NOT NULL DEFAULT 'EXTERNAL',

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_point_of_sale_organization
        FOREIGN KEY (organization_id)
        REFERENCES organization(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_point_of_sale_organization_code
        UNIQUE (organization_id, code),

    CONSTRAINT chk_point_of_sale_code
        CHECK (LENGTH(TRIM(code)) > 0),

    CONSTRAINT chk_point_of_sale_name
        CHECK (LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_point_of_sale_type
        CHECK (type IN ('INTERNAL', 'EXTERNAL')),

    CONSTRAINT chk_point_of_sale_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX idx_point_of_sale_organization
    ON point_of_sale(organization_id);

CREATE INDEX idx_point_of_sale_status
    ON point_of_sale(organization_id, status);

-- Point de vente interne par organisation.
INSERT INTO point_of_sale (
    organization_id,
    code,
    name,
    type
)
SELECT
    o.id,
    'INTERNAL',
    'Notre application',
    'INTERNAL'
FROM organization o
ON CONFLICT (organization_id, code) DO NOTHING;

-- Point de vente externe actuellement identifié.
INSERT INTO point_of_sale (
    organization_id,
    code,
    name,
    type
)
SELECT
    o.id,
    'CASHPOINTWIFI',
    'CASHPOINTWIFI',
    'EXTERNAL'
FROM organization o
ON CONFLICT (organization_id, code) DO NOTHING;

-- ============================================================
-- SALE -> POINT OF SALE
-- ============================================================

ALTER TABLE sale
    ADD COLUMN point_of_sale_id UUID;

UPDATE sale sa
SET point_of_sale_id = pos.id
FROM site s
JOIN point_of_sale pos
  ON pos.organization_id = s.organization_id
 AND pos.code = 'INTERNAL'
WHERE s.id = sa.site_id
  AND sa.point_of_sale_id IS NULL;

ALTER TABLE sale
    ALTER COLUMN point_of_sale_id SET NOT NULL;

ALTER TABLE sale
    ADD CONSTRAINT fk_sale_point_of_sale
    FOREIGN KEY (point_of_sale_id)
    REFERENCES point_of_sale(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

CREATE INDEX idx_sale_point_of_sale
    ON sale(point_of_sale_id);

CREATE INDEX idx_sale_point_of_sale_sold_at
    ON sale(point_of_sale_id, sold_at);

COMMIT;
