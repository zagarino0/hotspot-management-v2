BEGIN;

CREATE TABLE router (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    site_id UUID NOT NULL,

    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,

    vendor VARCHAR(100) NOT NULL DEFAULT 'MikroTik',
    model VARCHAR(100),

    serial_number VARCHAR(150),
    mac_address VARCHAR(17),

    management_ip INET,
    api_port INTEGER NOT NULL DEFAULT 8728,
    api_protocol VARCHAR(20) NOT NULL DEFAULT 'API',

    identity VARCHAR(150),
    router_os_version VARCHAR(100),

    status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',

    last_seen_at TIMESTAMPTZ,
    last_check_at TIMESTAMPTZ,

    uptime_seconds BIGINT,

    cpu_usage NUMERIC(5,2),
    memory_usage NUMERIC(5,2),

    last_error TEXT,

    sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    sync_status VARCHAR(20) NOT NULL DEFAULT 'NEVER',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_router_site
        FOREIGN KEY (site_id)
        REFERENCES site(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_router_site_code
        UNIQUE (site_id, code),

    CONSTRAINT uq_router_site_id
        UNIQUE (site_id, id),

    CONSTRAINT uq_router_serial_number
        UNIQUE (serial_number),

    CONSTRAINT chk_router_status
        CHECK (
            status IN (
                'ONLINE',
                'OFFLINE',
                'UNKNOWN',
                'DISABLED'
            )
        ),

    CONSTRAINT chk_router_api_port
        CHECK (
            api_port BETWEEN 1 AND 65535
        ),

    CONSTRAINT chk_router_cpu_usage
        CHECK (
            cpu_usage IS NULL
            OR cpu_usage BETWEEN 0 AND 100
        ),

    CONSTRAINT chk_router_memory_usage
        CHECK (
            memory_usage IS NULL
            OR memory_usage BETWEEN 0 AND 100
        ),

    CONSTRAINT chk_router_uptime
        CHECK (
            uptime_seconds IS NULL
            OR uptime_seconds >= 0
        ),

    CONSTRAINT chk_router_sync_status
        CHECK (
            sync_status IN (
                'NEVER',
                'PENDING',
                'RUNNING',
                'SUCCESS',
                'FAILED'
            )
        )
);


CREATE TABLE router_credential (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    router_id UUID NOT NULL,

    username VARCHAR(100) NOT NULL,
    encrypted_secret TEXT NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,

    CONSTRAINT fk_router_credential_router
        FOREIGN KEY (router_id)
        REFERENCES router(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


CREATE TABLE access_point (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    site_id UUID NOT NULL,
    router_id UUID,

    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,

    vendor VARCHAR(100),
    model VARCHAR(100),

    serial_number VARCHAR(150),
    mac_address VARCHAR(17),

    management_ip INET,
    management_vlan INTEGER,
    gateway INET,

    dhcp_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_access_point_site
        FOREIGN KEY (site_id)
        REFERENCES site(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_access_point_router_same_site
        FOREIGN KEY (site_id, router_id)
        REFERENCES router(site_id, id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT uq_access_point_site_code
        UNIQUE (site_id, code),

    CONSTRAINT chk_access_point_status
        CHECK (
            status IN (
                'ONLINE',
                'OFFLINE',
                'UNKNOWN',
                'DISABLED'
            )
        ),

    CONSTRAINT chk_access_point_vlan
        CHECK (
            management_vlan IS NULL
            OR management_vlan BETWEEN 1 AND 4094
        )
);


CREATE TABLE ap_radio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    access_point_id UUID NOT NULL,

    name VARCHAR(100) NOT NULL,

    band VARCHAR(20) NOT NULL,
    frequency INTEGER,

    channel VARCHAR(20),
    channel_width VARCHAR(20),

    ssid VARCHAR(100),

    security_mode VARCHAR(50),

    tx_power NUMERIC(7,2),

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_ap_radio_access_point
        FOREIGN KEY (access_point_id)
        REFERENCES access_point(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_ap_radio_band
        CHECK (
            band IN (
                '2.4GHZ',
                '5GHZ',
                '6GHZ',
                'OTHER'
            )
        ),

    CONSTRAINT chk_ap_radio_frequency
        CHECK (
            frequency IS NULL
            OR frequency > 0
        ),

    CONSTRAINT chk_ap_radio_status
        CHECK (
            status IN (
                'ONLINE',
                'OFFLINE',
                'UNKNOWN',
                'DISABLED'
            )
        )
);

COMMIT;