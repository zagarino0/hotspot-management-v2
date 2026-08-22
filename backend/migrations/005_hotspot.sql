BEGIN;

-- ============================================================
-- PLAN
-- ============================================================

CREATE TABLE plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    site_id UUID NOT NULL,

    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,

    description TEXT,

    price NUMERIC(14,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'MGA',

    duration_seconds BIGINT,
    data_limit_bytes BIGINT,

    download_speed_bps BIGINT,
    upload_speed_bps BIGINT,

    simultaneous_sessions INTEGER NOT NULL DEFAULT 1,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_plan_site
        FOREIGN KEY (site_id)
        REFERENCES site(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_plan_site_code
        UNIQUE (site_id, code),

    -- Nécessaire pour les FK composites multi-site
    CONSTRAINT uq_plan_site_id
        UNIQUE (site_id, id),

    CONSTRAINT chk_plan_price
        CHECK (price >= 0),

    CONSTRAINT chk_plan_currency
        CHECK (currency ~ '^[A-Z]{3}$'),

    CONSTRAINT chk_plan_duration
        CHECK (
            duration_seconds IS NULL
            OR duration_seconds > 0
        ),

    CONSTRAINT chk_plan_data_limit
        CHECK (
            data_limit_bytes IS NULL
            OR data_limit_bytes > 0
        ),

    CONSTRAINT chk_plan_download_speed
        CHECK (
            download_speed_bps IS NULL
            OR download_speed_bps > 0
        ),

    CONSTRAINT chk_plan_upload_speed
        CHECK (
            upload_speed_bps IS NULL
            OR upload_speed_bps > 0
        ),

    CONSTRAINT chk_plan_sessions
        CHECK (
            simultaneous_sessions > 0
        ),

    CONSTRAINT chk_plan_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'ARCHIVED'
            )
        )
);


-- ============================================================
-- VOUCHER BATCH
-- ============================================================

CREATE TABLE voucher_batch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    site_id UUID NOT NULL,
    plan_id UUID NOT NULL,

    name VARCHAR(150) NOT NULL,
    prefix VARCHAR(30),

    quantity INTEGER NOT NULL,

    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_by UUID,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_voucher_batch_site
        FOREIGN KEY (site_id)
        REFERENCES site(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_voucher_batch_plan_same_site
        FOREIGN KEY (site_id, plan_id)
        REFERENCES plan(site_id, id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    -- Nécessaire pour que voucher puisse vérifier son site
    CONSTRAINT uq_voucher_batch_site_id
        UNIQUE (site_id, id),

    CONSTRAINT chk_voucher_batch_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_voucher_batch_status
        CHECK (
            status IN (
                'ACTIVE',
                'COMPLETED',
                'CANCELLED'
            )
        )
);


-- ============================================================
-- VOUCHER
-- ============================================================

CREATE TABLE voucher (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    site_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    batch_id UUID,

    code VARCHAR(100) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'UNUSED',

    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    duration_seconds BIGINT,
    data_limit_bytes BIGINT,

    download_speed_bps BIGINT,
    upload_speed_bps BIGINT,

    sold_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_voucher_site
        FOREIGN KEY (site_id)
        REFERENCES site(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_voucher_plan_same_site
        FOREIGN KEY (site_id, plan_id)
        REFERENCES plan(site_id, id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_voucher_batch_same_site
        FOREIGN KEY (site_id, batch_id)
        REFERENCES voucher_batch(site_id, id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT uq_voucher_code
        UNIQUE (code),

    -- Nécessaire pour les FK composites depuis session
    CONSTRAINT uq_voucher_site_id
        UNIQUE (site_id, id),

    CONSTRAINT chk_voucher_status
        CHECK (
            status IN (
                'UNUSED',
                'ACTIVE',
                'EXPIRED',
                'DISABLED',
                'REVOKED'
            )
        ),

    CONSTRAINT chk_voucher_duration
        CHECK (
            duration_seconds IS NULL
            OR duration_seconds > 0
        ),

    CONSTRAINT chk_voucher_data_limit
        CHECK (
            data_limit_bytes IS NULL
            OR data_limit_bytes > 0
        ),

    CONSTRAINT chk_voucher_download_speed
        CHECK (
            download_speed_bps IS NULL
            OR download_speed_bps > 0
        ),

    CONSTRAINT chk_voucher_upload_speed
        CHECK (
            upload_speed_bps IS NULL
            OR upload_speed_bps > 0
        ),

    CONSTRAINT chk_voucher_dates
        CHECK (
            expires_at IS NULL
            OR activated_at IS NULL
            OR expires_at >= activated_at
        )
);


-- ============================================================
-- CLIENT
-- ============================================================

CREATE TABLE client (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    site_id UUID NOT NULL,

    username VARCHAR(150),
    display_name VARCHAR(150),

    phone VARCHAR(50),
    email VARCHAR(255),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    first_seen_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_client_site
        FOREIGN KEY (site_id)
        REFERENCES site(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_client_site_username
        UNIQUE (site_id, username),

    -- Nécessaire pour les FK composites depuis device/session
    CONSTRAINT uq_client_site_id
        UNIQUE (site_id, id),

    CONSTRAINT chk_client_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'BLOCKED',
                'ARCHIVED'
            )
        )
);


-- ============================================================
-- DEVICE
-- ============================================================

CREATE TABLE device (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    site_id UUID NOT NULL,
    client_id UUID,

    mac_address VARCHAR(17) NOT NULL,

    hostname VARCHAR(150),
    ip_address INET,

    device_type VARCHAR(50),
    operating_system VARCHAR(100),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    first_seen_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_device_site
        FOREIGN KEY (site_id)
        REFERENCES site(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_device_client_same_site
        FOREIGN KEY (site_id, client_id)
        REFERENCES client(site_id, id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT uq_device_site_mac
        UNIQUE (site_id, mac_address),

    -- Nécessaire pour les FK composites depuis session
    CONSTRAINT uq_device_site_id
        UNIQUE (site_id, id),

    CONSTRAINT chk_device_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'BLOCKED',
                'UNKNOWN'
            )
        )
);


-- ============================================================
-- SESSION
-- ============================================================

CREATE TABLE session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    site_id UUID NOT NULL,

    router_id UUID NOT NULL,
    voucher_id UUID,
    client_id UUID,
    device_id UUID,

    username VARCHAR(150),

    mac_address VARCHAR(17),
    ip_address INET,

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,

    duration_seconds BIGINT,

    upload_bytes BIGINT NOT NULL DEFAULT 0,
    download_bytes BIGINT NOT NULL DEFAULT 0,

    termination_reason VARCHAR(100),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_session_site
        FOREIGN KEY (site_id)
        REFERENCES site(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_session_router_same_site
        FOREIGN KEY (site_id, router_id)
        REFERENCES router(site_id, id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_session_voucher_same_site
        FOREIGN KEY (site_id, voucher_id)
        REFERENCES voucher(site_id, id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_session_client_same_site
        FOREIGN KEY (site_id, client_id)
        REFERENCES client(site_id, id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_session_device_same_site
        FOREIGN KEY (site_id, device_id)
        REFERENCES device(site_id, id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT chk_session_status
        CHECK (
            status IN (
                'ACTIVE',
                'COMPLETED',
                'TERMINATED',
                'ERROR'
            )
        ),

    CONSTRAINT chk_session_duration
        CHECK (
            duration_seconds IS NULL
            OR duration_seconds >= 0
        ),

    CONSTRAINT chk_session_upload
        CHECK (
            upload_bytes >= 0
        ),

    CONSTRAINT chk_session_download
        CHECK (
            download_bytes >= 0
        ),

    CONSTRAINT chk_session_dates
        CHECK (
            ended_at IS NULL
            OR ended_at >= started_at
        )
);

COMMIT;