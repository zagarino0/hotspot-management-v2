BEGIN;

-- ============================================================
-- SALE
-- ============================================================

CREATE TABLE sale (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    site_id UUID NOT NULL,

    voucher_id UUID,
    plan_id UUID NOT NULL,

    customer_name VARCHAR(150),
    customer_phone VARCHAR(50),

    quantity INTEGER NOT NULL DEFAULT 1,

    unit_price NUMERIC(14,2) NOT NULL,
    total_amount NUMERIC(14,2) NOT NULL,

    currency VARCHAR(3) NOT NULL DEFAULT 'MGA',

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_by UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_sale_site
        FOREIGN KEY (site_id)
        REFERENCES site(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_plan_same_site
        FOREIGN KEY (site_id, plan_id)
        REFERENCES plan(site_id, id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_voucher_same_site
        FOREIGN KEY (site_id, voucher_id)
        REFERENCES voucher(site_id, id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    -- Nécessaire pour les FK composites
    CONSTRAINT uq_sale_site_id
        UNIQUE (site_id, id),

    CONSTRAINT chk_sale_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_sale_unit_price
        CHECK (unit_price >= 0),

    CONSTRAINT chk_sale_total_amount
        CHECK (total_amount >= 0),

    CONSTRAINT chk_sale_currency
        CHECK (currency ~ '^[A-Z]{3}$'),

    CONSTRAINT chk_sale_status
        CHECK (
            status IN (
                'PENDING',
                'PAID',
                'PARTIALLY_PAID',
                'CANCELLED',
                'REFUNDED'
            )
        )
);


-- ============================================================
-- PAYMENT
-- ============================================================

CREATE TABLE payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    site_id UUID NOT NULL,
    sale_id UUID NOT NULL,

    amount NUMERIC(14,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'MGA',

    method VARCHAR(30) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    paid_at TIMESTAMPTZ,

    reference VARCHAR(150),

    customer_phone VARCHAR(50),

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_payment_site
        FOREIGN KEY (site_id)
        REFERENCES site(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_payment_sale_same_site
        FOREIGN KEY (site_id, sale_id)
        REFERENCES sale(site_id, id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    -- Nécessaire pour les FK composites
    CONSTRAINT uq_payment_site_id
        UNIQUE (site_id, id),

    CONSTRAINT chk_payment_amount
        CHECK (amount > 0),

    CONSTRAINT chk_payment_currency
        CHECK (currency ~ '^[A-Z]{3}$'),

    CONSTRAINT chk_payment_method
        CHECK (
            method IN (
                'CASH',
                'MVOLA',
                'ORANGE_MONEY',
                'AIRTEL_MONEY',
                'BANK',
                'OTHER'
            )
        ),

    CONSTRAINT chk_payment_status
        CHECK (
            status IN (
                'PENDING',
                'SUCCESS',
                'FAILED',
                'CANCELLED',
                'REFUNDED'
            )
        ),

    CONSTRAINT chk_payment_paid_at
        CHECK (
            status <> 'SUCCESS'
            OR paid_at IS NOT NULL
        )
);


-- ============================================================
-- PAYMENT TRANSACTION
-- ============================================================

CREATE TABLE payment_transaction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    site_id UUID NOT NULL,
    payment_id UUID NOT NULL,

    provider VARCHAR(50) NOT NULL,

    transaction_id VARCHAR(150),
    external_reference VARCHAR(150),

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    request_payload JSONB,
    response_payload JSONB,

    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    failure_code VARCHAR(100),
    failure_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_payment_transaction_site
        FOREIGN KEY (site_id)
        REFERENCES site(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_payment_transaction_payment_same_site
        FOREIGN KEY (site_id, payment_id)
        REFERENCES payment(site_id, id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_payment_transaction_provider
        CHECK (
            LENGTH(TRIM(provider)) > 0
        ),

    CONSTRAINT chk_payment_transaction_status
        CHECK (
            status IN (
                'PENDING',
                'SUCCESS',
                'FAILED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_payment_transaction_completed_at
        CHECK (
            status <> 'SUCCESS'
            OR completed_at IS NOT NULL
        ),

    CONSTRAINT uq_payment_provider_transaction
        UNIQUE (provider, transaction_id)
);


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_sale_site_id
    ON sale(site_id);

CREATE INDEX idx_sale_plan_id
    ON sale(site_id, plan_id);

CREATE INDEX idx_sale_voucher_id
    ON sale(site_id, voucher_id);

CREATE INDEX idx_sale_status
    ON sale(site_id, status);

CREATE INDEX idx_sale_sold_at
    ON sale(site_id, sold_at);


CREATE INDEX idx_payment_site_id
    ON payment(site_id);

CREATE INDEX idx_payment_sale_id
    ON payment(site_id, sale_id);

CREATE INDEX idx_payment_status
    ON payment(site_id, status);

CREATE INDEX idx_payment_method
    ON payment(site_id, method);

CREATE INDEX idx_payment_paid_at
    ON payment(site_id, paid_at);


CREATE INDEX idx_payment_transaction_site_id
    ON payment_transaction(site_id);

CREATE INDEX idx_payment_transaction_payment_id
    ON payment_transaction(site_id, payment_id);

CREATE INDEX idx_payment_transaction_status
    ON payment_transaction(site_id, status);

CREATE INDEX idx_payment_transaction_provider
    ON payment_transaction(provider);


COMMIT;