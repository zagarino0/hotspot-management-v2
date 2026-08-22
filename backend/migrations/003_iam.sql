BEGIN;

CREATE TABLE permission (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,
    code VARCHAR(100) NOT NULL,

    resource VARCHAR(50) NOT NULL,
    action VARCHAR(30) NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_permission_code
        UNIQUE (code)
);


CREATE TABLE role (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID,

    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,

    description TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    is_system BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_role_organization
        FOREIGN KEY (organization_id)
        REFERENCES organization(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_role_organization_code
        UNIQUE (organization_id, code),

    CONSTRAINT chk_role_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'ARCHIVED'
            )
        )
);


CREATE TABLE "user" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL,

    username VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),

    first_name VARCHAR(100),
    last_name VARCHAR(100),

    password_hash TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'INVITED',

    email_verified BOOLEAN NOT NULL DEFAULT FALSE,

    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_user_organization
        FOREIGN KEY (organization_id)
        REFERENCES organization(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_user_organization_username
        UNIQUE (organization_id, username),

    CONSTRAINT chk_user_status
        CHECK (
            status IN (
                'ACTIVE',
                'INVITED',
                'SUSPENDED',
                'DISABLED',
                'ARCHIVED'
            )
        )
);


CREATE TABLE user_role (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,
    role_id UUID NOT NULL,

    scope VARCHAR(20) NOT NULL,

    site_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_user_role_user
        FOREIGN KEY (user_id)
        REFERENCES "user"(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_user_role_role
        FOREIGN KEY (role_id)
        REFERENCES role(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_user_role_site
        FOREIGN KEY (site_id)
        REFERENCES site(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_user_role_scope
        CHECK (
            scope IN (
                'ORGANIZATION',
                'SITE'
            )
        ),

    CONSTRAINT chk_user_role_site_scope
        CHECK (
            (scope = 'SITE' AND site_id IS NOT NULL)
            OR
            (scope = 'ORGANIZATION' AND site_id IS NULL)
        ),

    CONSTRAINT uq_user_role
        UNIQUE (user_id, role_id, site_id)
);


CREATE TABLE role_permission (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    role_id UUID NOT NULL,
    permission_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_role_permission_role
        FOREIGN KEY (role_id)
        REFERENCES role(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_role_permission_permission
        FOREIGN KEY (permission_id)
        REFERENCES permission(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_role_permission
        UNIQUE (role_id, permission_id)
);

COMMIT;