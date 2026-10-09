BEGIN;

-- Permissions explicites pour le registre de tickets externes et les clôtures.
INSERT INTO permission (name, code, resource, action, description)
VALUES
  ('Lire les événements de tickets externes', 'POS_TICKET_EVENTS_READ', 'POS_TICKET_EVENTS', 'READ', 'Consulter le registre des mouvements de tickets externes.'),
  ('Créer des événements de tickets externes', 'POS_TICKET_EVENTS_CREATE', 'POS_TICKET_EVENTS', 'CREATE', 'Enregistrer une vente, un rejet, un remboursement ou un remplacement.'),
  ('Lire les clôtures quotidiennes des points de vente', 'POS_DAILY_CLOSURES_READ', 'POS_DAILY_CLOSURES', 'READ', 'Consulter les clôtures quotidiennes.'),
  ('Clôturer les ventes quotidiennes des points de vente', 'POS_DAILY_CLOSURES_CLOSE', 'POS_DAILY_CLOSURES', 'CLOSE', 'Valider les quantités et la recette d’une journée.')
ON CONFLICT (code) DO NOTHING;

-- Le rôle système SUPER_ADMIN conserve l'accès complet; les autres rôles
-- reçoivent ces permissions via l'écran de gestion des rôles.
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
CROSS JOIN permission p
WHERE UPPER(r.code) = 'SUPER_ADMIN'
  AND p.code IN (
    'POS_TICKET_EVENTS_READ',
    'POS_TICKET_EVENTS_CREATE',
    'POS_DAILY_CLOSURES_READ',
    'POS_DAILY_CLOSURES_CLOSE'
  )
ON CONFLICT DO NOTHING;

-- Un remboursement peut légitimement dépasser la recette brute du jour
-- lorsqu'il concerne une vente d'une date antérieure.
ALTER TABLE point_of_sale_daily_closure
  DROP CONSTRAINT IF EXISTS chk_pos_daily_closure_amounts;

ALTER TABLE point_of_sale_daily_closure
  ADD CONSTRAINT chk_pos_daily_closure_amounts
  CHECK (gross_revenue >= 0 AND refunds >= 0);

COMMIT;
