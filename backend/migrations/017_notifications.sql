BEGIN;

CREATE TABLE notification_setting (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    new_session_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    network_problem_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    router_offline_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    router_online_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sync_error_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    all_sites BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_notification_setting_user
        FOREIGN KEY (user_id) REFERENCES "user"(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE notification_setting_site (
    setting_id UUID NOT NULL,
    site_id UUID NOT NULL,
    PRIMARY KEY (setting_id, site_id),
    CONSTRAINT fk_notification_setting_site_setting
        FOREIGN KEY (setting_id) REFERENCES notification_setting(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_notification_setting_site_site
        FOREIGN KEY (site_id) REFERENCES site(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE notification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    site_id UUID,
    router_id UUID,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    event_key VARCHAR(255) NOT NULL,
    read_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id) REFERENCES "user"(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_notification_site
        FOREIGN KEY (site_id) REFERENCES site(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_notification_router
        FOREIGN KEY (router_id) REFERENCES router(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_notification_type CHECK (
        type IN ('NEW_SESSION','NETWORK_PROBLEM','ROUTER_OFFLINE','ROUTER_ONLINE','SYNC_ERROR')
    ),
    CONSTRAINT chk_notification_severity CHECK (
        severity IN ('INFO','WARNING','CRITICAL')
    )
);

CREATE INDEX idx_notification_user_created_at
    ON notification(user_id, created_at DESC);
CREATE INDEX idx_notification_user_unread
    ON notification(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notification_site_created_at
    ON notification(site_id, created_at DESC);
CREATE INDEX idx_notification_router_created_at
    ON notification(router_id, created_at DESC);
CREATE INDEX idx_notification_event_key
    ON notification(user_id, event_key);
CREATE UNIQUE INDEX uq_notification_active_event
    ON notification(user_id, event_key)
    WHERE resolved_at IS NULL;

COMMIT;
