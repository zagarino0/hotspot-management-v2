BEGIN;

-- ============================================================
-- PERMISSIONS
-- Granularité volontairement simple pour cette application :
-- READ (consultation) + MANAGE (créer/modifier/supprimer) par
-- ressource, plutôt que CREATE/UPDATE/DELETE séparés — plus
-- lisible pour un petit outil d'administration hotspot.
-- ============================================================

INSERT INTO permission (name, code, resource, action, description) VALUES
  ('Gérer l''organisation', 'ORGANIZATION_MANAGE', 'ORGANIZATION', 'MANAGE', 'Modifier les paramètres de l''organisation'),

  ('Voir les sites', 'SITE_READ', 'SITE', 'READ', 'Consulter les sites'),
  ('Gérer les sites', 'SITE_MANAGE', 'SITE', 'MANAGE', 'Créer, modifier, supprimer des sites'),

  ('Voir les utilisateurs', 'USER_READ', 'USER', 'READ', 'Consulter les utilisateurs'),
  ('Gérer les utilisateurs', 'USER_MANAGE', 'USER', 'MANAGE', 'Créer, modifier, supprimer des utilisateurs'),

  ('Voir les rôles', 'ROLE_READ', 'ROLE', 'READ', 'Consulter les rôles et permissions'),
  ('Gérer les rôles', 'ROLE_MANAGE', 'ROLE', 'MANAGE', 'Créer, modifier, supprimer des rôles'),

  ('Voir les routeurs', 'ROUTER_READ', 'ROUTER', 'READ', 'Consulter les routeurs'),
  ('Gérer les routeurs', 'ROUTER_MANAGE', 'ROUTER', 'MANAGE', 'Créer, modifier, supprimer des routeurs'),

  ('Voir les points d''accès', 'ACCESS_POINT_READ', 'ACCESS_POINT', 'READ', 'Consulter les points d''accès'),
  ('Gérer les points d''accès', 'ACCESS_POINT_MANAGE', 'ACCESS_POINT', 'MANAGE', 'Créer, modifier, supprimer des points d''accès'),

  ('Voir les forfaits', 'PLAN_READ', 'PLAN', 'READ', 'Consulter les forfaits'),
  ('Gérer les forfaits', 'PLAN_MANAGE', 'PLAN', 'MANAGE', 'Créer, modifier des forfaits'),

  ('Voir les vouchers', 'VOUCHER_READ', 'VOUCHER', 'READ', 'Consulter les vouchers'),
  ('Gérer les vouchers', 'VOUCHER_MANAGE', 'VOUCHER', 'MANAGE', 'Générer, désactiver, supprimer des vouchers'),

  ('Voir les clients', 'CLIENT_READ', 'CLIENT', 'READ', 'Consulter les clients'),
  ('Gérer les clients', 'CLIENT_MANAGE', 'CLIENT', 'MANAGE', 'Créer, modifier, supprimer des clients'),

  ('Voir les sessions', 'SESSION_READ', 'SESSION', 'READ', 'Consulter les sessions actives et l''historique'),
  ('Gérer les sessions', 'SESSION_MANAGE', 'SESSION', 'MANAGE', 'Déconnecter des utilisateurs en direct'),

  ('Voir les ventes', 'SALE_READ', 'SALE', 'READ', 'Consulter les ventes'),
  ('Gérer les ventes', 'SALE_MANAGE', 'SALE', 'MANAGE', 'Créer, annuler, supprimer des ventes'),

  ('Voir les paiements', 'PAYMENT_READ', 'PAYMENT', 'READ', 'Consulter les paiements'),
  ('Gérer les paiements', 'PAYMENT_MANAGE', 'PAYMENT', 'MANAGE', 'Enregistrer des paiements');


-- ============================================================
-- RÔLES SYSTÈME
-- organization_id = NULL : rôles globaux, disponibles pour
-- toutes les organisations (protégés, is_system = true —
-- ni modifiables ni supprimables depuis l'UI, voir role.service.ts).
-- ============================================================

INSERT INTO role (organization_id, name, code, description, is_system) VALUES
  (NULL, 'Super Admin', 'SUPER_ADMIN', 'Accès complet à l''ensemble de la plateforme.', true),
  (NULL, 'Administrateur', 'ADMIN', 'Gestion de l''infrastructure et des utilisateurs.', true),
  (NULL, 'Technicien', 'TECHNICIAN', 'Gestion technique des routeurs et points d''accès.', true),
  (NULL, 'Opérateur', 'OPERATOR', 'Gestion des clients, vouchers et ventes.', true);


-- SUPER_ADMIN : toutes les permissions
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r, permission p
WHERE r.code = 'SUPER_ADMIN';

-- ADMIN : tout sauf la gestion de l'organisation elle-même
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r, permission p
WHERE r.code = 'ADMIN'
  AND p.code <> 'ORGANIZATION_MANAGE';

-- TECHNICIEN : infrastructure réseau
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r, permission p
WHERE r.code = 'TECHNICIAN'
  AND p.code IN (
    'SITE_READ',
    'ROUTER_READ', 'ROUTER_MANAGE',
    'ACCESS_POINT_READ', 'ACCESS_POINT_MANAGE',
    'SESSION_READ', 'SESSION_MANAGE',
    'CLIENT_READ'
  );

-- OPÉRATEUR : clients, vouchers, ventes
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r, permission p
WHERE r.code = 'OPERATOR'
  AND p.code IN (
    'SITE_READ',
    'CLIENT_READ', 'CLIENT_MANAGE',
    'PLAN_READ',
    'VOUCHER_READ', 'VOUCHER_MANAGE',
    'SALE_READ', 'SALE_MANAGE',
    'PAYMENT_READ', 'PAYMENT_MANAGE',
    'SESSION_READ'
  );

COMMIT;
