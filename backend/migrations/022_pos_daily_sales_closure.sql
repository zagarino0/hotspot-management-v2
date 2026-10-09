BEGIN;

-- Registre commercial des mouvements de tickets externes.
-- Cette table est indépendante du synchroniseur MikroTik.
CREATE TABLE IF NOT EXISTS point_of_sale_ticket_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_of_sale_id UUID NOT NULL REFERENCES point_of_sale(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    site_id UUID NOT NULL REFERENCES site(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    voucher_id UUID REFERENCES voucher(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    replacement_voucher_id UUID REFERENCES voucher(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    voucher_code VARCHAR(100) NOT NULL,
    replacement_voucher_code VARCHAR(100),
    event_type VARCHAR(40) NOT NULL,
    reason_code VARCHAR(60),
    reason TEXT,
    unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'MGA',
    source VARCHAR(20) NOT NULL DEFAULT 'APPLICATION',
    actor_user_id UUID REFERENCES "user"(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    event_key VARCHAR(255) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_pos_ticket_event_type CHECK (event_type IN (
        'STOCK_ASSIGNED',
        'SOLD',
        'UNSOLD_CONFIRMED',
        'REJECTED',
        'RETURN_REQUESTED',
        'RETURNED_TO_STOCK',
        'REPLACED',
        'UNUSABLE',
        'MISSING',
        'REFUNDED'
    )),
    CONSTRAINT chk_pos_ticket_event_price CHECK (unit_price >= 0),
    CONSTRAINT chk_pos_ticket_event_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_pos_ticket_event_source CHECK (source IN (
        'APPLICATION', 'ADMIN_IMPORT', 'SYSTEM'
    )),
    CONSTRAINT chk_pos_ticket_event_key CHECK (LENGTH(TRIM(event_key)) > 0),
    CONSTRAINT chk_pos_ticket_replacement_free CHECK (event_type <> 'REPLACED' OR unit_price = 0),
    CONSTRAINT chk_pos_ticket_replacement_pair CHECK (
        (event_type = 'REPLACED' AND replacement_voucher_code IS NOT NULL)
        OR (event_type <> 'REPLACED')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_ticket_event_key
    ON point_of_sale_ticket_event(event_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_ticket_sold_once
    ON point_of_sale_ticket_event(point_of_sale_id, LOWER(voucher_code))
    WHERE event_type = 'SOLD';

CREATE INDEX IF NOT EXISTS idx_pos_ticket_event_pos_date
    ON point_of_sale_ticket_event(point_of_sale_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_ticket_event_voucher_date
    ON point_of_sale_ticket_event(voucher_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_ticket_event_type_date
    ON point_of_sale_ticket_event(event_type, occurred_at DESC);

-- Instantané de clôture quotidienne. Les chiffres sont persistés à la clôture;
-- ils ne doivent pas être recalculés silencieusement après validation.
CREATE TABLE IF NOT EXISTS point_of_sale_daily_closure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_of_sale_id UUID NOT NULL REFERENCES point_of_sale(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    business_date DATE NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'MGA',

    opening_stock INTEGER NOT NULL DEFAULT 0,
    tickets_received INTEGER NOT NULL DEFAULT 0,
    tickets_sold INTEGER NOT NULL DEFAULT 0,
    unsold_in_stock INTEGER NOT NULL DEFAULT 0,
    rejected_pending INTEGER NOT NULL DEFAULT 0,
    unusable_or_replaced INTEGER NOT NULL DEFAULT 0,
    missing_tickets INTEGER NOT NULL DEFAULT 0,
    free_replacements INTEGER NOT NULL DEFAULT 0,
    replacement_tickets_issued INTEGER NOT NULL DEFAULT 0,

    gross_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
    refunds NUMERIC(14,2) NOT NULL DEFAULT 0,
    net_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
    stock_discrepancy INTEGER NOT NULL DEFAULT 0,

    status VARCHAR(12) NOT NULL DEFAULT 'OPEN',
    notes TEXT,
    created_by UUID REFERENCES "user"(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    closed_by UUID REFERENCES "user"(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_pos_daily_closure_date UNIQUE(point_of_sale_id, business_date),
    CONSTRAINT chk_pos_daily_closure_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_pos_daily_closure_status CHECK (status IN ('OPEN', 'CLOSED')),
    CONSTRAINT chk_pos_daily_closure_counts CHECK (
        opening_stock >= 0 AND tickets_received >= 0 AND tickets_sold >= 0
        AND unsold_in_stock >= 0 AND rejected_pending >= 0
        AND unusable_or_replaced >= 0 AND missing_tickets >= 0
        AND free_replacements >= 0 AND replacement_tickets_issued >= 0
    ),
    CONSTRAINT chk_pos_daily_closure_amounts CHECK (
        gross_revenue >= 0 AND refunds >= 0 AND net_revenue >= 0
    ),
    CONSTRAINT chk_pos_daily_closure_closed_at CHECK (
        (status = 'OPEN' AND closed_at IS NULL)
        OR (status = 'CLOSED' AND closed_at IS NOT NULL AND closed_by IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_pos_daily_closure_date
    ON point_of_sale_daily_closure(business_date DESC, point_of_sale_id);

COMMIT;
