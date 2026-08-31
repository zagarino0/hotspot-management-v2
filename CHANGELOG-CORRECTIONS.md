# Corrections apportées — Audit du 18/08/2026

Ce document liste tous les correctifs appliqués suite à l'audit du projet.
Chaque section peut être relue et comparée indépendamment.

---

## 🔴 Sécurité

### 1. Middleware d'authentification (absent auparavant)

**Nouveau fichier :** `backend/src/middleware/auth.ts`

Aucun code ne vérifiait jamais le JWT délivré au login. Toutes les routes
`/api/routers` et `/api/clients` étaient donc accessibles sans authentification.

Le middleware `authenticate` :
- extrait le token du header `Authorization: Bearer <token>`
- le vérifie avec `jsonwebtoken`
- attache le payload décodé à `req.auth`
- renvoie `401` si le token est absent, invalide ou expiré

Branché dans `backend/src/app.ts` :

```ts
app.use("/api/auth", authRoutes);                    // public
app.use("/api/clients", authenticate, clientRoutes);  // protégé
app.use("/api/routers", authenticate, routerRoutes);  // protégé
```

### 2. Chiffrement réel du mot de passe MikroTik

**Nouveau fichier :** `backend/src/lib/crypto.ts`

Le mot de passe MikroTik était stocké **en clair** dans
`router_credential.encrypted_secret` (le code le disait lui-même en
commentaire). Ajout d'un chiffrement AES-256-GCM :

- `encryptSecret(plainText)` / `decryptSecret(payload)`
- clé dérivée de `CREDENTIALS_ENCRYPTION_KEY` (nouvelle variable d'env,
  32 octets hex — générer avec `openssl rand -hex 32`)

Appliqué dans `backend/src/modules/routers/router.repository.ts` :
`insertRouter()` chiffre désormais le mot de passe avant l'INSERT.

⚠️ **Toute donnée déjà en base avec l'ancien système (mot de passe en
clair) doit être re-saisie** — elle n'est pas automatiquement migrée.

### 3. Ordre de vérification login (nouveau bug trouvé en corrigeant l'auth)

**Fichier :** `backend/src/services/auth.service.ts`

Le statut du compte (`ACTIVE`/`INACTIVE`/`BLOCKED`...) était vérifié
**avant** le mot de passe. Un attaquant pouvait donc déterminer si un
compte existe et son statut sans connaître le mot de passe
(énumération de comptes). Le mot de passe est maintenant vérifié en
premier ; le message d'erreur reste générique (« Identifiants
invalides. ») dans les deux cas d'échec d'authentification.

### 4. Frontend : le token n'était jamais envoyé

**Fichiers :** `frontend/src/services/api.ts`, `frontend/src/lib/authStorage.ts`

Ajout d'un intercepteur axios qui attache
`Authorization: Bearer <token>` sur chaque requête, et d'un intercepteur
de réponse qui, sur un `401`, nettoie la session locale et redirige
vers `/login`. Sans ça, le point 1 ci-dessus aurait cassé toute l'app.

---

## 🟠 Fiabilité / cohérence API

### 5. Toutes les erreurs renvoyaient HTTP 500

**Fichiers :** `backend/src/lib/errors.ts` (nouveau), `backend/src/middleware/errorHandler.ts`

Nouvelle classe `AppError` (avec `statusCode`) et helpers
(`badRequest`, `unauthorized`, `forbidden`, `notFoundError`, `conflict`).
`errorHandler` renvoie maintenant le vrai code HTTP et le vrai message
pour les erreurs "attendues" (401, 400...), et ne masque en 500 générique
que les erreurs réellement inattendues (bug, crash BDD...).

### 6. Enveloppe de réponse API incohérente entre modules

Avant : `auth.routes.ts` utilisait `{status:"ok"/"error", ...}` alors
que `router.controller.ts` / `client.controller.ts` utilisaient
`{success, data, message}`, et `errorHandler`/`notFound` utilisaient
`{success, error}`. Tout est maintenant unifié sur :

```json
// succès
{ "success": true, "data": {...} }

// échec
{ "success": false, "message": "..." }
```

Fichiers touchés : `auth.routes.ts`, `errorHandler.ts`, `notFound.ts`,
et côté frontend `contexts/AuthContext.tsx` (mis à jour pour lire
`success`/`message` au lieu de `status`/`error`).

---

## 🟡 Nettoyage

| Élément supprimé | Raison |
|---|---|
| `backend/src/mikrotik/router.ts`, `hotspot.ts`, `profiles.ts`, `types.ts` | Fichiers vides (0 ligne), jamais importés nulle part |
| Interface `InsertRouterData` dupliquée dans `router.repository.ts` | Copié-collé identique deux fois de suite |
| `frontend/src/app/router.tsx` | Fichier de routage mort, jamais importé (le vrai routeur utilisé est `app/App.tsx`, monté depuis `main.tsx`) |
| `backend/dist/` | Build obsolète : contenait un module `websocket` qui n'existe plus dans `src/` — risque de faire tourner du code périmé avec `npm start` sans rebuild |
| `frontend/dist/` | Build précédent, à régénérer |

### Ajouts de documentation

- `backend/.env.example`, `frontend/.env.example` (absents du projet, ajoutés)
- Ce fichier

---

## ⚠️ Problèmes identifiés mais non corrigés (hors code)

- **`node_modules` livré avec des binaires natifs Windows uniquement**
  (`oxlint`, `rolldown`/vite). Le typecheck (`tsc`) passe, mais
  `npm run build` côté frontend échoue dans un environnement Linux tel
  que celui utilisé pour cet audit. Ce n'est pas un bug de code : lancez
  `rm -rf node_modules && npm install` sur votre machine cible pour que
  npm récupère les bons binaires natifs. `node_modules` a été exclu de
  cette archive pour cette raison (et parce qu'il est déjà gitignoré).

- **Page "Revenus" (`frontend/src/pages/Billing/Sales.tsx`)** reste une
  maquette statique (chiffres codés en dur, aucun appel API). Le backend
  n'a aucune route/service `finance` derrière — seuls les types
  TypeScript existent (`domain/finance/*.types.ts`). C'est un vrai
  chantier fonctionnel, pas une "erreur" à corriger en l'état ; à
  traiter comme une nouvelle fonctionnalité si tu veux qu'on l'attaque.

- **`tsc --noEmit` ne suffisait pas à vérifier le frontend** (project
  references) — utiliser `npx tsc -b` a révélé une vraie erreur de
  compilation (`TOKEN_KEY`/`USER_KEY` indéfinis dans `AuthContext.tsx`)
  qui était invisible avec la commande simple. Corrigé, mais à garder en
  tête pour le CI/les prochains checks.

---

## Comment vérifier après extraction

```bash
# Backend
cd backend
npm install
cp .env.example .env   # puis remplir les vraies valeurs
npm run typecheck      # doit passer sans erreur
npm run build
npm run dev

# Frontend
cd frontend
npm install
cp .env.example .env
npx tsc -b --force      # doit passer sans erreur (PAS tsc --noEmit seul)
npm run build
npm run dev
```

---

# Corrections apportées — 19/08/2026 : données réelles

Suite de l'audit précédent. Objectif : éliminer les données simulées
et brancher les pages sur de vraies données (base PostgreSQL +
MikroTik en direct).

## 1. `Routers.tsx` branché sur l'API

La page listait 3 routeurs codés en dur. Le backend
(`GET /api/routers`) et le service frontend (`getRouters()`)
existaient déjà, sans être utilisés. Réécrit selon le même pattern
que `Clients.tsx` (chargement / erreur / vide / recherche), avec
gestion correcte des 4 statuts réels (`ONLINE`/`OFFLINE`/`UNKNOWN`/
`DISABLED`) au lieu d'un simple binaire ON/OFF.

## 2. Module Sessions + synchronisation live MikroTik (nouveau)

Le dossier `backend/src/modules/sessions/` existait mais était vide.
Construit entièrement :

- **`mikrotik/hotspotActive.ts`** (nouveau) — lit
  `/ip/hotspot/active/print` sur un routeur MikroTik via
  `node-routeros`, normalise les champs bruts (`.id`, `user`,
  `address`, `mac-address`, `bytes-in`, `bytes-out`).

- **`session.repository.ts`** — lecture des sessions en base
  (jointure avec `router` pour le nom), et logique d'upsert :
  chaque cycle de sync met à jour les sessions actives existantes
  (clé : `router_id` + `mac_address`), crée les nouvelles, et
  **clôture automatiquement** (`status = COMPLETED`) celles qui ne
  sont plus dans la liste live du routeur.

- **`session.service.ts`** — orchestre un cycle de sync complet :
  récupère l'identifiant chiffré du routeur, le déchiffre
  (`lib/crypto.ts`), se connecte via `node-routeros`, lit les
  utilisateurs actifs, synchronise la base. **Un routeur injoignable
  n'interrompt jamais la synchronisation des autres** (erreurs
  capturées individuellement).

- **`session.controller.ts` / `session.routes.ts`** —
  `GET /api/sessions` (liste, filtre `?status=`),
  `POST /api/sessions/sync` (déclenche un cycle de sync sur tous les
  routeurs éligibles), `POST /api/sessions/sync/:routerId` (un seul
  routeur). Routes protégées par `authenticate`, montées dans
  `app.ts`.

- **`router.repository.ts`** — ajout de `findRoutersForSync()`,
  `findRouterCredential()`, `updateRouterHealth()` (met à jour
  `status`/`last_seen_at`/`last_error`/`sync_status` du routeur après
  chaque tentative de connexion réelle — le statut ONLINE/OFFLINE
  reflète maintenant la réalité, pas juste l'état au moment de la
  création).

- **`server.ts`** — boucle de synchronisation automatique en tâche
  de fond (`setInterval`, toutes les `LIVE_SYNC_INTERVAL_SECONDS`
  secondes, 30 par défaut). Un cycle en cours n'en chevauche jamais
  un autre (`syncInFlight`). Arrêt propre sur `SIGINT`/`SIGTERM`.

- **Bug corrigé au passage** : `domain/hotspot/session.types.ts`
  déclarait des statuts `EXPIRED`/`LOST` qui n'existent pas dans la
  contrainte `CHECK` SQL de la table `session` (qui n'accepte que
  `ACTIVE`/`COMPLETED`/`TERMINATED`/`ERROR`). Une insertion avec ces
  valeurs aurait échoué en base malgré un typage TypeScript qui
  semblait correct. Type aligné sur la vraie contrainte.

### Frontend

- **`services/sessionService.ts`** (nouveau) — `fetchSessions()`,
  `syncSessions()`.
- **`pages/Sessions/Sessions.tsx`** — entièrement réécrite : données
  réelles, bouton « Synchroniser maintenant » (déclenche une vraie
  lecture MikroTik), rafraîchissement automatique léger toutes les
  15s (relit juste la base, ne sollicite pas les routeurs), affichage
  des routeurs injoignables lors de la dernière synchronisation.

### Limite connue

Le rattachement `client_id`/`device_id`/`voucher_id` d'une session
reste `NULL` pour l'instant : ces liens dépendent des modules
Clients-avancé/Vouchers qui ne sont pas encore construits. La session
est identifiée par MAC + IP + username bruts remontés par MikroTik,
ce qui suffit pour un suivi live fonctionnel dès maintenant.

---

# Corrections apportées — 19/08/2026 (suite) : module Sites + pages manquantes

## Constat sur les "pages manquantes"

Audit des 13 pages de la sidebar : toutes ont une route et un
composant (aucune page n'était structurellement absente). Le vrai
problème : les boutons « Ajouter » de Clients, Sites, Vouchers,
Users, Rôles et Points d'accès ne faisaient **rien** au clic (pas de
`navigate()`, pas de page de formulaire derrière). Seul `AddRouter.tsx`
fonctionnait. Chaque module construit à partir de maintenant inclut
donc systématiquement : liste branchée + page/formulaire d'ajout
fonctionnel + bouton câblé.

## Module Sites (nouveau, complet)

- **Backend** : `modules/sites/` (repository, service, controller,
  routes). `GET /api/sites` renvoie chaque site avec des agrégats
  **calculés en direct** (`COUNT` sur les tables liées, pas des
  compteurs stockés qui pourraient se désynchroniser) : nombre de
  routeurs, routeurs en ligne, points d'accès, clients.
  `POST /api/sites` crée un site — `organization_id` est **toujours**
  dérivé du JWT de l'utilisateur connecté (`req.auth.organizationId`),
  jamais du corps de la requête, pour éviter qu'un utilisateur ne
  crée un site pour une autre organisation.

- **Bug corrigé au passage** : `domain/site/site.types.ts` déclarait
  `SiteStatus` avec `MAINTENANCE`, alors que la contrainte `CHECK` SQL
  réelle attend `SUSPENDED`. Même famille de bug que celui trouvé sur
  `session.types.ts` — les deux fichiers de types domaine avaient été
  écrits sans être vérifiés contre le schéma SQL final.

- **Frontend** : `services/siteService.ts` (nouveau),
  `pages/Sites/Sites.tsx` réécrite avec les vraies données et
  agrégats, **`pages/Sites/AddSite.tsx` (nouvelle page)** — formulaire
  de création, route `/sites/new` ajoutée dans `App.tsx`, bouton
  « Ajouter un site » câblé.

## Corrections dérivées

- **`AddRouter.tsx`** : le champ site était un champ texte libre où
  il fallait coller un UUID PostgreSQL à la main — inutilisable en
  pratique pour un vrai utilisateur. Remplacé par une vraie liste
  déroulante des sites existants (avec message d'aide + lien direct
  vers « Créer un site » si aucun site n'existe encore).

- **`Routers.tsx`** : affichait l'UUID brut du site dans la colonne
  « Site ». Récupère maintenant la liste des sites en parallèle des
  routeurs et affiche le vrai nom. La recherche filtre aussi sur ce
  nom résolu.

- **Contrainte d'environnement notée** : `Promise.prototype.finally`
  n'est pas disponible avec la cible `ES6` configurée dans
  `tsconfig.app.json` du frontend — utiliser `async/await` avec
  `try/catch/finally` classique, pas de chaînage `.then().finally()`.

## Reste à construire

Points d'accès, Vouchers/Forfaits, Ventes & Paiements (Revenus),
Utilisateurs, Rôles, Dashboard/Statistiques — chacun avec son propre
backend complet + page liste + page d'ajout.

---

# Corrections apportées — 19/08/2026 (suite 2) : module Points d'accès

## Module Access Points (nouveau, complet)

- **Backend** : `modules/access-points/` (repository, service,
  controller, routes). `GET /api/access-points` renvoie chaque AP
  avec le nom du site et du routeur résolus par jointure, plus sa
  « radio principale » (SSID + bande) via un
  `LEFT JOIN LATERAL` sur `ap_radio` — pas de duplication de données,
  la radio reste stockée dans sa propre table normalisée.
  `POST /api/access-points` crée l'AP et, si un SSID est fourni,
  crée aussi sa première radio dans la même transaction (rollback
  si l'un des deux échoue).

- **Frontend** : `services/accessPointService.ts` (nouveau),
  `pages/AccessPoints/AccessPoints.tsx` réécrite avec les vraies
  données, **`pages/AccessPoints/AddAccessPoint.tsx` (nouvelle
  page)** — site et routeur choisis dans de vraies listes déroulantes
  (le routeur proposé est filtré pour n'afficher que ceux du site
  sélectionné), SSID/bande facultatifs. Route `/access-points/new`
  ajoutée, bouton câblé.

### Limite connue

Un AP ne peut avoir qu'une seule radio à la création via ce
formulaire (la table `ap_radio` supporte pourtant plusieurs radios
par AP, ex. 2.4 GHz + 5 GHz simultanément). Ajouter/éditer des radios
supplémentaires après coup nécessite une page de détail AP, pas
encore construite. Aucun test de connexion live n'est fait sur les AP
(contrairement aux routeurs) : la plupart des AP WiFi grand public
n'exposent pas d'API de gestion à distance comme RouterOS.

## Reste à construire

Vouchers/Forfaits, Ventes & Paiements (Revenus), Utilisateurs, Rôles,
Dashboard/Statistiques.

---

# Corrections apportées — 19/08/2026 (suite 3) : modules Forfaits + Vouchers

## Module Plans / Forfaits (nouveau, complet)

- **Backend** : `modules/plans/` (repository, service, controller,
  routes). `GET /api/plans` renvoie chaque forfait avec le nom du
  site et le nombre de vouchers déjà générés à partir de lui.
  Validation : prix négatif refusé, durée nulle/négative refusée.
- Pas de page de navigation dédiée (aucun lien "Forfaits" dans la
  sidebar) : la gestion des forfaits est intégrée directement dans le
  flux de génération de vouchers (voir plus bas), qui permet de créer
  un forfait à la volée si besoin.

## Module Vouchers (nouveau, complet)

- **Backend** : `modules/vouchers/` (repository, service, controller,
  routes). `GET /api/vouchers` (filtre `?status=`),
  `POST /api/vouchers/generate` (génère un lot).

- **Génération de code** (`lib/voucherCode.ts`, nouveau) : format
  `PREFIX-XXXX-XXXX`, alphabet volontairement privé des caractères
  ambigus à lire sur un ticket imprimé (`0`/`O`, `1`/`I`/`L`). Un code
  en collision (extrêmement rare vu l'espace de génération) déclenche
  une nouvelle tentative automatique (jusqu'à 5 essais) plutôt que de
  faire échouer tout le lot.

- **Snapshot du forfait à la génération** : chaque voucher copie la
  durée/quota/débit du forfait au moment où il est créé (colonnes
  propres à `voucher`, indépendantes de `plan`). Si le forfait est
  modifié plus tard, les vouchers déjà émis ne changent pas
  rétroactivement — comportement volontaire et cohérent avec le
  schéma SQL existant.

- **Lot atomique** : `voucher_batch` + tous ses `voucher` sont créés
  dans une seule transaction ; en cas d'erreur sur un voucher
  individuel (après épuisement des tentatives), tout le lot est
  annulé (`ROLLBACK`), jamais de lot à moitié généré.

### Frontend

- **`services/planService.ts`**, **`services/voucherService.ts`**
  (nouveaux).
- **`pages/Vouchers/Vouchers.tsx`** réécrite avec les vraies données
  (statuts réels `UNUSED`/`ACTIVE`/`EXPIRED`/`DISABLED`/`REVOKED` au
  lieu du triplet `AVAILABLE`/`USED`/`EXPIRED` inventé). Le bouton
  « Copier » fonctionne réellement (`navigator.clipboard`). Le bouton
  « Exporter », qui ne faisait rien, a été retiré plutôt que laissé
  décoratif.
- **`pages/Vouchers/GenerateVouchers.tsx` (nouvelle page)** — site et
  forfait choisis dans de vraies listes déroulantes, bascule
  « Forfait existant / Nouveau forfait » (crée le forfait à la volée
  si nécessaire), génère le lot, puis affiche tous les codes générés
  avec un bouton « Copier tous les codes ». Route `/vouchers/new`
  ajoutée, bouton câblé.

### Limite connue

Aucune page de détail/édition de forfait n'existe encore (impossible
de modifier le prix d'un forfait existant depuis l'UI, seulement à la
création). Le cycle de vie complet d'un voucher après génération
(activation, expiration réelle, désactivation manuelle) dépend du
portail captif, qui reste hors du périmètre actuel de ce projet.

## Reste à construire

Ventes & Paiements (Revenus), Utilisateurs, Rôles,
Dashboard/Statistiques.

---

# Corrections apportées — 22/08/2026 : module Revenus (Ventes & Paiements)

C'est le module explicitement demandé dès le tout premier message de
cet audit ("elle capable de gestionner les revenus"). La page
`Billing/Sales.tsx` était 100 % statique (428 ventes et 1 284 000 Ar
codés en dur) ; aucune route/service/repository derrière malgré des
tables `sale`/`payment`/`payment_transaction` déjà prêtes en base.

## Bug de cohérence type/BDD trouvé (même famille que les précédents)

`domain/finance/sale.types.ts` et `payment.types.ts` référençaient des
colonnes qui n'existent pas en base : `organizationId`, `sellerId`,
`saleNumber` sur `Sale`, et surtout `paymentMethodId` sur `Payment`
— supposant une table `payment_method` qui **n'a jamais été créée**
dans les migrations (`method` est en réalité un simple champ texte
direct sur `payment`). Statuts également désynchronisés
(`COMPLETED` inventé au lieu de `PAID`/`SUCCESS` réels). Types
corrigés pour refléter le schéma SQL réel.
`domain/finance/paymentMethod.types.ts` reste orphelin (décrit une
table inexistante) — non supprimé pour l'instant, juste signalé ici.

## Module Sales (nouveau, complet)

- **Backend** : `modules/sales/` — `sale.repository.ts`,
  `payment.repository.ts`, `sale.service.ts`, `sale.controller.ts`,
  `sale.routes.ts`.

- **Snapshot du prix à la vente** : `unit_price`/`total_amount` sont
  toujours calculés depuis le prix réel du forfait au moment de la
  vente côté serveur — jamais une valeur envoyée par le client de
  l'API. Même principe que pour les vouchers.

- **Statut de vente recalculé depuis les vrais paiements**, jamais
  incrémenté à l'aveugle : à chaque paiement `SUCCESS` enregistré, on
  resomme tous les paiements réussis de la vente et on compare au
  montant total pour déterminer `PENDING` → `PARTIALLY_PAID` → `PAID`.
  Reste correct même avec plusieurs paiements partiels.

- **Lien Ventes ⇄ Vouchers** : quand une vente liée à un voucher passe
  à `PAID`, le voucher correspondant voit son `sold_at` renseigné
  automatiquement (`UPDATE voucher SET sold_at = COALESCE(sold_at, NOW())`).

- **Annulation vs suppression** : "Annuler" (statut `CANCELLED`)
  n'est possible que si aucun paiement n'a encore été reçu ; sinon
  message clair invitant à utiliser un remboursement. "Supprimer"
  (suppression physique) réservé aux ventes `PENDING` sans aucun
  paiement — au-delà, la vente fait partie de l'historique
  comptable.

- **`GET /api/sales/summary`** : chiffre d'affaires réel (somme des
  paiements `SUCCESS`), nombre de ventes payées, panier moyen, part
  des paiements mobile money (MVola/Orange Money/Airtel Money) —
  tout calculé en direct depuis les tables `sale`/`payment`, plus
  aucun chiffre inventé.

### Frontend

- **`services/saleService.ts`** (nouveau) — CRUD complet + résumé.
- **`pages/Billing/Sales.tsx`** réécrite : KPI réels, recherche,
  filtre par statut, menu d'actions (Enregistrer un paiement /
  Annuler / Supprimer, chacun activé selon l'état réel de la vente).
- **`pages/Billing/RecordSale.tsx` (nouvelle page)** — "Nouvelle
  vente" : site → forfait → voucher (facultatif, filtré sur les
  vouchers `UNUSED` du forfait choisi) en vraies listes déroulantes,
  total calculé en direct. Route `/billing/sales/new` ajoutée
  (attention : le préfixe est `/billing/sales`, pas `/sales`).
- Modal "Enregistrer un paiement" avec montant pré-rempli au reste dû
  et choix de la méthode de paiement.

### Limite connue

`payment_transaction` (table pour les callbacks asynchrones des
passerelles mobile money) n'est pas exploitée : ce module suppose un
enregistrement manuel du paiement par l'opérateur (cash immédiat ou
mobile money déjà confirmé de vive voix), pas une intégration API
réelle avec MVola/Orange Money — ce serait un chantier à part entière
nécessitant les identifiants d'API de chaque opérateur.

## Reste à construire

Utilisateurs, Rôles, Dashboard/Statistiques.

---

# Modules Utilisateurs + Rôles (backend) — 23/08/2026

## Constat de départ

Contrairement aux Revenus, rien n'existait pour Utilisateurs, Rôles,
Dashboard et Statistiques : les 4 pages étaient à 100% des maquettes
statiques (0 appel API). `modules/statistics/` existait en tant que
dossier vide, et `routes/role.types.ts` existait déjà (bien conçu,
avec `permissionCount`/`userCount` agrégés plutôt que le détail
complet des permissions dans la liste), mais aucun repository/
service/contrôleur derrière.

## Module Utilisateurs (nouveau, complet)

`modules/users/` — `GET/POST /api/users`, `GET/PATCH/DELETE
/api/users/:id`, `PATCH /api/users/:id/roles`.

- Mot de passe haché avec `bcryptjs` (12 rounds), jamais stocké/
  renvoyé en clair.
- **Un utilisateur ne peut pas se supprimer lui-même, ni changer son
  propre statut** — protection contre l'auto-verrouillage (on
  compare `req.auth.sub` à l'id ciblé).
- Attribution des rôles (scope `ORGANIZATION` uniquement pour cette
  version — le scope `SITE` par utilisateur existe dans le schéma
  mais n'est pas encore exposé dans l'UI, à faire dans une itération
  future si besoin).
- Suppression : nettoyage transactionnel de `user_role` (contrainte
  `RESTRICT`) avant suppression de l'utilisateur.

## Module Rôles (nouveau, complet)

`modules/roles/` — `GET /api/roles`, `GET /api/roles/permissions`
(catalogue), `POST /api/roles`, `GET/PATCH/DELETE /api/roles/:id`.

- **Rôles système protégés** (`is_system = true` : SUPER_ADMIN, ADMIN,
  TECHNICIAN, OPERATOR, seedés par la migration) : ni modifiables ni
  supprimables depuis l'API — `403 Forbidden` explicite.
- Suppression d'un rôle personnalisé bloquée s'il est **encore
  attribué à au moins un utilisateur** (message clair demandant de
  retirer le rôle d'abord, plutôt que de le désassigner
  silencieusement).
- Remplacement complet des permissions d'un rôle en une transaction
  (`DELETE` puis réinsertion), jamais d'ajout/retrait partiel
  incohérent.

## Bug corrigé : double seed des permissions/rôles

**`scripts/seed-admin.ts` recréait sa propre copie des permissions et
du rôle ADMIN**, avec une convention de code différente
(`site:write`, minuscules avec `:`) de celle de la migration
`migrations/007_iam_seed.sql` (`SITE_MANAGE`, majuscules avec `_`,
celle qui correspond aussi au type de domaine
`PermissionAction`/`PermissionResource`). En exécutant successivement
les migrations puis ce script, la base se serait retrouvée avec deux
jeux de permissions redondants et un rôle "ADMIN" dupliqué
(un global `is_system` de la migration, un par-organisation du
script) — ce qui serait apparu immédiatement comme une liste de
permissions à moitié dupliquée dans l'interface Rôles.

**Corrigé** : `seed-admin.ts` ne crée plus aucune permission ni rôle.
Il crée seulement l'organisation et l'utilisateur admin, puis
recherche et attribue le rôle système `ADMIN` déjà seedé par la
migration. Une erreur explicite est levée si ce rôle est introuvable
(migrations non appliquées).

**Ajout** : script npm `seed` (`tsx scripts/seed-admin.ts`) — n'existait
pas, il fallait invoquer `tsx` manuellement pour lancer ce script.

## Reste à construire (frontend)

- `services/userService.ts`, `services/roleService.ts`
- `pages/Users/Users.tsx` réécrite + `AddUser.tsx` (page manquante)
- `pages/Roles/Roles.tsx` réécrite + interface d'attribution des
  permissions (case à cocher groupées par ressource)
- Dashboard / Statistiques (rien construit encore, ni backend ni
  frontend)

---

# Frontend Utilisateurs + Rôles — 23/08/2026 (suite)

## Utilisateurs

- `services/userService.ts` (nouveau).
- `pages/Users/Users.tsx` réécrite : données réelles, KPI calculés
  (actifs/inactifs/administrateurs), `ActionMenu`
  (Modifier/Supprimer), modal d'édition (nom/prénom/email/téléphone/
  statut — les rôles se gèrent séparément, un renvoi vers la page
  Rôles est affiché dans le modal).
- **`pages/Users/AddUser.tsx` créée** (page manquante) : identifiant,
  mot de passe (8 caractères min.), infos de contact, et attribution
  des rôles via de vraies cases à cocher peuplées depuis
  `GET /api/roles`.

## Rôles & permissions

- `services/roleService.ts` (nouveau).
- `pages/Roles/Roles.tsx` réécrite : données réelles, rôles système
  visuellement distingués (icône cadenas, badge "Système"), actions
  Modifier/Supprimer **automatiquement grisées** pour les rôles
  système ou encore attribués à des utilisateurs (cohérent avec les
  règles déjà en place côté backend).
- Modal d'édition : nom/description **+ les permissions du rôle**,
  regroupées par ressource (Sites, Routeurs, Clients...) avec
  traduction française des noms techniques (`SITE` → "Sites",
  `ACCESS_POINT` → "Points d'accès", etc.).
- **`pages/Roles/AddRole.tsx` créée** (page manquante) : même
  interface de sélection des permissions par ressource.

## Contrainte d'environnement (rappel)

Même limitation `ES6` que documentée précédemment pour
`Promise.finally` : **`Array.prototype.includes` n'est pas non plus
disponible** avec cette cible (nécessite ES2016+). Utilisé
`array.indexOf(x) !== -1` à la place partout dans ces nouvelles
pages — à garder en tête pour tout code futur sur ce projet.

## Vérifications

- `tsc --noEmit` backend : 0 erreur
- `tsc` (build réel) backend : 0 erreur
- `tsc -b --force` frontend : 0 erreur
- Recherche de résidus `MoreHorizontal` sur `pages/Users/` et
  `pages/Roles/` : aucun

## Reste à construire

Dashboard / Statistiques — dernier module, rien construit encore ni
backend ni frontend.

---

# Module Revenus (Ventes & Paiements) — vérifié le 22/08/2026

Ce module (backend `modules/sales/`, service frontend
`saleService.ts`, pages `Billing/Sales.tsx` et `Billing/RecordSale.tsx`)
était déjà entièrement construit à ce stade du projet. Ce qui suit est
le résultat de l'audit de vérification, pas un travail de zéro.

## Ce qui existe et fonctionne

- **Vente** : création (`RecordSale.tsx`) avec site → forfait →
  voucher (facultatif) en cascade de listes déroulantes réelles,
  montant calculé automatiquement à partir du **prix du forfait au
  moment de la vente** (snapshot, jamais une valeur envoyée par le
  client de l'API).
- **Paiement** : encaissement partiel ou total. Le statut de la vente
  (`PENDING`/`PARTIALLY_PAID`/`PAID`) est **recalculé à chaque fois à
  partir de la somme réelle des paiements `SUCCESS`** — jamais un
  simple compteur incrémenté, ce qui reste correct même en cas de
  paiements multiples. Quand une vente devient `PAID` et qu'un voucher
  y est rattaché, ce voucher est automatiquement marqué comme vendu.
- **Annulation** : refusée si un paiement a déjà été reçu (redirige
  vers un remboursement, plus approprié).
- **Suppression** : réservée aux ventes `PENDING` sans le moindre
  paiement — au-delà, c'est une pièce comptable, pas une ligne à
  effacer.
- **KPI du tableau de bord Ventes** : chiffre d'affaires, nombre de
  ventes payées, panier moyen, part des paiements mobile money —
  **tous calculés en direct depuis PostgreSQL** (agrégats SQL dans
  `getSalesSummary()`), zéro chiffre codé en dur.
- Menu d'actions (`ActionMenu`) avec "Enregistrer un paiement" /
  "Annuler" / "Supprimer", chacun grisé automatiquement selon le vrai
  statut de la vente et le montant déjà payé.

## Nettoyage effectué

- **`domain/finance/paymentMethod.types.ts` supprimé** : décrivait une
  table `payment_method` qui n'existe pas dans le schéma SQL réel
  (`payment.method` est une colonne directe avec une contrainte
  `CHECK`, pas une clé étrangère vers une table séparée). Fichier
  jamais importé nulle part — mort et trompeur.
- Confirmé : `domain/finance/sale.types.ts` et `payment.types.ts`
  étaient déjà correctement alignés sur le schéma SQL réel (un
  commentaire dans le code documente d'ailleurs les erreurs qu'une
  version antérieure contenait — `COMPLETED` au lieu de `PAID`,
  colonnes inventées comme `organizationId`/`sellerId` — signe qu'un
  audit similaire à celui de ce projet avait déjà eu lieu sur ces
  fichiers précis).

## Vérifications

- `tsc --noEmit` backend : 0 erreur
- `tsc` (build réel) backend : 0 erreur
- `tsc -b --force` frontend : 0 erreur
- Recherche de données codées en dur dans `pages/Billing/` : aucune
- Cohérence sidebar ⇄ routes : `/billing/sales` et
  `/billing/sales/new` correctement enregistrées des deux côtés

---

# Corrections apportées — 20-21/08/2026 : Modifier / Supprimer sur tous les modules

## Fondations partagées (nouveau)

- **`components/ui/ActionMenu.tsx`** — menu contextuel réutilisé sur
  toutes les lignes de tableau de l'app. Remplace le bouton "..."
  qui n'ouvrait rien nulle part.
- **`components/ui/ConfirmDialog.tsx`** — dialogue de confirmation
  générique pour toute action destructrice.
- **`components/ui/Modal.tsx`** — coquille de modal générique pour
  les formulaires d'édition rapide (tailles `md`/`lg`).
- **`lib/dbErrors.ts`** (backend) — `isUniqueViolation` /
  `isForeignKeyViolation`, pour ne plus dupliquer
  `"code" in error && ...` dans chaque service.

## Par module

**Sites** — Modifier (nom, **code**, ville, région, district,
adresse, description — étoffé sur demande explicite) + Supprimer.
Le code du site n'était modifiable qu'à la création jusqu'ici ; ajout
du support complet (repository, gestion du conflit d'unicité si le
nouveau code est déjà pris, contrôleur). Erreur claire si des
routeurs/clients sont encore rattachés au site.

**Routeurs** — Modifier (nom, IP de gestion) + Supprimer. La
suppression retire d'abord les identifiants liés (contrainte
`RESTRICT`) dans la même transaction que la suppression du routeur.

**Points d'accès** — Modifier (nom, fabricant, modèle, MAC, IP) +
Supprimer. La suppression retire d'abord les radios liées
(`ap_radio`, contrainte `RESTRICT`) dans la même transaction.

**Vouchers** — Pas de "Modifier" (instrument financier). "Désactiver"
et "Révoquer" : autorisés uniquement depuis `UNUSED`/`ACTIVE`, jamais
depuis un statut déjà terminal. "Supprimer" : autorisé uniquement si
le voucher n'a **jamais** été utilisé (`UNUSED`) — sinon il fait
partie de l'historique/l'audit et l'action est grisée dans le menu.

**Sessions** — Pas de "Modifier"/"Supprimer" (ça n'a pas de sens pour
une session). Action **"Déconnecter"** : se reconnecte réellement au
routeur MikroTik concerné, retire l'utilisateur actif
(`/ip/hotspot/active/remove`) s'il est encore présent, puis clôture
la session en base dans tous les cas. Grisée si la session n'est déjà
plus active.

**Clients** — Modifier (nom affiché, téléphone, email, statut) +
Supprimer. **`services/clientService.ts` complété** : `createClient`,
`updateClient`, `deleteClient` n'existaient pas du tout avant ce
chantier. **`pages/Clients/AddClient.tsx` créée** — c'était la
dernière page "manquante" identifiée dès le tout premier audit et
jamais construite depuis (site en vraie liste déroulante). Bouton
"Ajouter un client" enfin câblé vers `/clients/new`.

## Incident de synchronisation archive ⇄ environnement de travail

Une archive avait été livrée **avant** ce chantier ; le travail a
continué dans l'environnement de travail sans regénération immédiate,
ce qui a produit un état incohérent côté utilisateur (fichiers d'une
ancienne livraison mélangés à du code décrit en chat mais jamais
livré — imports introuvables, parfois circulaires). Résolu en
régénérant une archive fraîche et complète, avec consigne de
remplacer entièrement le dossier local plutôt que d'extraire
par-dessus. Depuis, l'archive est regénérée à chaque étape validée.

## Vérifications avant cette livraison

- `tsc --noEmit` backend : 0 erreur
- `tsc` (build réel) backend : 0 erreur, `dist/` généré puis retiré
  de l'archive
- `tsc -b --force` frontend : 0 erreur
- Recherche de résidus `MoreHorizontal` (bouton mort) sur tout
  `frontend/src/pages` : seuls les modules pas encore construits
  (Utilisateurs, Rôles, Infrastructure, Revenus/Sales) en contiennent
  encore — cohérent avec la feuille de route, rien d'oublié sur les
  modules déjà livrés.
