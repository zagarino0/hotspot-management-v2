BEGIN;

-- The composite foreign key includes site_id only to enforce that a session
-- and its voucher belong to the same site. Deleting a voucher must clear
-- voucher_id only; setting site_id to NULL violates session.site_id NOT NULL.
ALTER TABLE session
    DROP CONSTRAINT IF EXISTS fk_session_voucher_same_site;

ALTER TABLE session
    ADD CONSTRAINT fk_session_voucher_same_site
    FOREIGN KEY (site_id, voucher_id)
    REFERENCES voucher(site_id, id)
    ON UPDATE CASCADE
    ON DELETE SET NULL (voucher_id);

COMMIT;
