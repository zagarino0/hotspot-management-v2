BEGIN;

CREATE TABLE organization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,

    email VARCHAR(255),
    phone VARCHAR(50),

    address TEXT,
    country VARCHAR(100),
    timezone VARCHAR(100) NOT NULL DEFAULT 'Indian/Antananarivo',
    currency VARCHAR(3) NOT NULL DEFAULT 'MGA',

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_organization_code
        UNIQUE (code),

    CONSTRAINT chk_organization_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'SUSPENDED',
                'ARCHIVED'
            )
        ),

    CONSTRAINT chk_organization_currency
        CHECK (currency ~ '^[A-Z]{3}$')
);


CREATE TABLE site (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL,

    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,

    address TEXT,
    city VARCHAR(100),
    region VARCHAR(100),
    district VARCHAR(100),

    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),

    timezone VARCHAR(100),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_site_organization
        FOREIGN KEY (organization_id)
        REFERENCES organization(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT uq_site_organization_code
        UNIQUE (organization_id, code),

    CONSTRAINT chk_site_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'SUSPENDED',
                'ARCHIVED'
            )
        ),

    CONSTRAINT chk_site_latitude
        CHECK (
            latitude IS NULL
            OR latitude BETWEEN -90 AND 90
        ),

    CONSTRAINT chk_site_longitude
        CHECK (
            longitude IS NULL
            OR longitude BETWEEN -180 AND 180
        )
);

COMMIT;