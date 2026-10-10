BEGIN;

-- Extension additive : les clôtures historiques sont conservées telles quelles.
-- Pour les nouvelles clôtures, on distingue le stock théorique calculé du stock
-- physique compté et on conserve séparément l'écart du registre d'événements.
ALTER TABLE point_of_sale_daily_closure
    ADD COLUMN IF NOT EXISTS physical_stock_count INTEGER,
    ADD COLUMN IF NOT EXISTS theoretical_stock INTEGER,
    ADD COLUMN IF NOT EXISTS event_stock_discrepancy INTEGER,
    ADD COLUMN IF NOT EXISTS stock_review_required BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS stock_discrepancy_reason TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_pos_daily_closure_physical_stock'
    ) THEN
        ALTER TABLE point_of_sale_daily_closure
            ADD CONSTRAINT chk_pos_daily_closure_physical_stock
            CHECK (physical_stock_count IS NULL OR physical_stock_count >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_pos_daily_closure_theoretical_stock'
    ) THEN
        ALTER TABLE point_of_sale_daily_closure
            ADD CONSTRAINT chk_pos_daily_closure_theoretical_stock
            CHECK (theoretical_stock IS NULL OR theoretical_stock >= 0);
    END IF;
END $$;

COMMIT;
