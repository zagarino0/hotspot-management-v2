BEGIN;

-- Permet de référencer un routeur avec son site.
ALTER TABLE router
    ADD CONSTRAINT uq_router_site_id
    UNIQUE (site_id, id);


-- Supprime l'ancienne relation qui ne vérifiait
-- que router.id.
ALTER TABLE access_point
    DROP CONSTRAINT fk_access_point_router;


-- Nouvelle relation :
-- access_point.site_id + access_point.router_id
-- doivent correspondre à router.site_id + router.id.
ALTER TABLE access_point
    ADD CONSTRAINT fk_access_point_router_same_site
    FOREIGN KEY (site_id, router_id)
    REFERENCES router (site_id, id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

COMMIT;