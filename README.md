# HOTSPOT MANAGEMENT V2

Plateforme moderne de gestion de réseaux Hotspot MikroTik, conçue pour administrer les utilisateurs, forfaits, tickets, sessions, routeurs, statistiques et connexions en temps réel.

---

## 🎯 Vision du projet

**HOTSPOT MANAGEMENT V2** est une refonte complète du système de gestion Hotspot.

La V2 est conçue autour d'une séparation claire entre :

* **MikroTik** : source de vérité du réseau et des connexions LIVE.
* **PostgreSQL** : source de vérité des données métier et historiques.
* **Backend Node.js** : logique métier, synchronisation et API.
* **WebSocket** : transmission des événements temps réel.
* **Frontend React** : interface d'administration.
* **Captive Portal** : interface utilisateur du Hotspot.

L'objectif principal est d'obtenir un système fiable, extensible et capable de gérer plusieurs routeurs et plusieurs sites.

---

# 🏗️ Architecture générale

```text
                         INTERNET
                            │
                         Starlink
                            │
                            ▼
                    ┌───────────────┐
                    │    MikroTik   │
                    │    RouterOS   │
                    │               │
                    │    Hotspot    │
                    └───────┬───────┘
                            │
                       RouterOS API
                            │
                            ▼
                 ┌─────────────────────┐
                 │      BACKEND V2     │
                 │     Node.js/API     │
                 │                     │
                 │ MikroTik Service    │
                 │ Live Service        │
                 │ Session Service     │
                 │ Subscriber Service  │
                 │ Plan Service        │
                 │ Ticket Service      │
                 └──────────┬──────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
       ┌──────────────┐            ┌──────────────┐
       │  PostgreSQL  │            │  WebSocket   │
       │              │            │              │
       │ Historique   │            │ Temps réel   │
       │ Utilisateurs │            │              │
       │ Forfaits     │            └──────┬───────┘
       │ Tickets      │                   │
       │ Sessions     │                   ▼
       └──────────────┘            ┌──────────────┐
                                   │ React V2     │
                                   │ Dashboard    │
                                   └──────────────┘
```

---

# 🔑 Principes fondamentaux

## 1. MikroTik est la source de vérité LIVE

Pour savoir si un utilisateur est actuellement connecté, le système utilise :

```text
/ip/hotspot/active/print
```

MikroTik fournit notamment :

* username
* adresse IP
* adresse MAC
* uptime
* bytes reçus
* bytes envoyés
* packets
* méthode de connexion
* serveur Hotspot

Le dashboard ne doit jamais déterminer lui-même qu'un utilisateur est connecté à partir d'une ancienne donnée PostgreSQL.

---

## 2. PostgreSQL est la source de vérité métier

PostgreSQL conserve :

* clients
* routeurs
* utilisateurs
* forfaits
* tickets
* paiements
* sessions historiques
* statistiques
* journaux

PostgreSQL ne doit pas être utilisé seul pour déterminer le nombre d'utilisateurs actuellement connectés.

---

## 3. Une session = une connexion réelle

Chaque connexion doit être considérée comme une session indépendante.

Exemple :

```text
Utilisateur : wckk

Session 1
06:46 → 12:35

Déconnexion

Session 2
13:10 → 14:20

Déconnexion

Session 3
15:00 → ...
```

Les sessions précédentes ne doivent pas être réutilisées comme session LIVE.

---

# 📦 Fonctionnalités prévues

## Gestion des routeurs

* Ajouter un MikroTik
* Modifier un MikroTik
* Tester la connexion
* Activer/désactiver un routeur
* Afficher son identité
* Afficher RouterOS
* Afficher CPU
* Afficher RAM
* Afficher uptime
* Afficher l'état de connexion
* Gérer plusieurs routeurs

---

## Gestion LIVE

Le dashboard doit afficher en temps réel :

* nombre d'utilisateurs connectés
* username
* IP
* MAC
* uptime
* trafic entrant
* trafic sortant
* état de connexion
* forfait associé
* temps début de connexion (date et heur)
* temps fin de la connexion (date et heur)

Exemple :

```text
┌────────────────────────────────────────────────────────────┐
│ UTILISATEURS CONNECTÉS — LIVE                              │
├──────────┬────────────────┬────────────────┬───────────────┤
│ User     │ IP             │ Uptime         │ Trafic        │
├──────────┼────────────────┼────────────────┼───────────────┤
│ admin    │ 192.168.88.23  │ 04:19:44       │ 3.7 MB        │
│ sito     │ 192.168.88.17  │ 04:12:01       │ 1.2 MB        │
│ angela   │ 192.168.88.12  │ 00:44:16       │ 2.8 MB        │
│ wckk     │ 192.168.88.10  │ 05:45:13       │ 4.1 MB        │
└──────────┴────────────────┴────────────────┴───────────────┘
```

---

# 👤 Gestion des abonnés

Un abonné peut posséder :

* username
* MAC
* téléphone
* statut
* historique de sessions
* forfaits
* tickets
* historique de consommation

---

# 💳 Gestion des forfaits

Les forfaits sont configurables depuis l'administration.

Exemples :

```text
500 Ar
1 000 Ar
3 000 Ar
10 000 Ar
```

Un forfait peut définir :

```text
Nom
Code
Prix
Durée de connexion
Durée de validité
Profil MikroTik
Quota éventuel
Statut
```

Les prix ne doivent pas être codés directement dans le frontend.

---

# 🎫 Gestion des tickets

Un ticket représente une autorisation d'accès au réseau.

Exemple :

```text
Code       : MKX-8F4K2P
Forfait    : 3 000 Ar
Utilisateur: wckk
Créé       : 14/08/2026
Activé     : 14/08/2026 06:46
Expiration : 21/08/2026
Statut     : ACTIVE
```

Statuts prévus :

```text
CREATED
ACTIVE
EXPIRED
USED
CANCELLED
```

---

# ⏱️ Gestion du temps

Le système distingue deux notions :

### Validité

Période pendant laquelle le forfait peut être utilisé.

```text
14/08/2026 06:46
        ↓
21/08/2026 06:46
```

### Temps consommé

Temps réellement passé en connexion.

```text
Session 1 : 05h43
Session 2 : 01h22
Session 3 : 00h31

Total : 07h36
```

Le système ne doit jamais confondre :

```text
uptime MikroTik
```

avec :

```text
temps total consommé du forfait
```

---

# 🔄 Synchronisation MikroTik

Le système possède un service dédié :

```text
LiveSyncService
```

Processus :

```text
MikroTik
   │
   ▼
/ip/hotspot/active/print
   │
   ▼
LiveSyncService
   │
   ├── NEW
   ├── ACTIVE
   └── DISCONNECTED
   │
   ▼
Session Service
   │
   ├── PostgreSQL
   └── WebSocket
             │
             ▼
         Dashboard
```

La synchronisation doit être idempotente.

Une même information reçue plusieurs fois ne doit pas créer plusieurs sessions.

---

# ⚡ Temps réel

Le système utilise WebSocket pour transmettre les changements au frontend.

Exemple :

```text
12:30:00 → 5 utilisateurs

12:30:05 → 5 utilisateurs

12:30:10 → wckk déconnecté

12:30:10 → 4 utilisateurs

12:30:15 → angela reconnectée

12:30:15 → 5 utilisateurs
```

Le dashboard ne doit pas nécessiter un rechargement manuel de la page.

---

# 🗄️ Base de données

Structure initiale prévue :

```text
clients
routers
subscribers
plans
subscriber_plans
tickets
sessions
payments
admin_users
audit_logs
```

Relations principales :

```text
CLIENT
 │
 ├── ROUTERS
 │
 ├── SUBSCRIBERS
 │       │
 │       └── SUBSCRIBER_PLANS
 │                 │
 │                 └── PLANS
 │
 ├── TICKETS
 │
 ├── SESSIONS
 │
 └── PAYMENTS
```

---

# 🔌 API

Base :

```text
/api/v2
```

Modules :

```text
/api/v2/auth
/api/v2/routers
/api/v2/live
/api/v2/subscribers
/api/v2/plans
/api/v2/tickets
/api/v2/sessions
/api/v2/statistics
/api/v2/settings
```

Exemple :

```text
GET /api/v2/routers/:routerId/live
```

Réponse :

```json
{
  "router": {
    "id": 1,
    "name": "MikroTik Mahavoky",
    "online": true
  },
  "summary": {
    "connected": 4
  },
  "users": []
}
```

---

# 📁 Structure du projet

```text
hotspot-management-v2/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── database/
│   │   ├── mikrotik/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── routers/
│   │   │   ├── live/
│   │   │   ├── subscribers/
│   │   │   ├── plans/
│   │   │   ├── tickets/
│   │   │   ├── sessions/
│   │   │   └── statistics/
│   │   ├── websocket/
│   │   ├── middleware/
│   │   └── server.ts
│   │
│   ├── migrations/
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── stores/
│   │   └── types/
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── captive-portal/
│   ├── login.html
│   ├── status.html
│   ├── logout.html
│   └── assets/
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

# 🛠️ Stack technique

## Backend

```text
Node.js
TypeScript
Express
PostgreSQL
node-routeros
WebSocket
```

## Frontend

```text
React
TypeScript
Vite
Tailwind CSS
WebSocket
```

## Réseau

```text
MikroTik RouterOS
Hotspot
RouterOS API
Captive Portal
```

---

# 🗺️ Roadmap

## Phase 1 — Fondation

* [ ] Initialiser le projet
* [ ] Backend Node.js + TypeScript
* [ ] Frontend React + TypeScript
* [ ] PostgreSQL
* [ ] Configuration `.env`
* [ ] Architecture des modules
* [ ] Système de migrations

## Phase 2 — MikroTik

* [ ] Connexion RouterOS
* [ ] Test de connexion
* [ ] Identité du routeur
* [ ] Ressources système
* [ ] `/ip/hotspot/active/print`
* [ ] `/ip/hotspot/user/print`
* [ ] Profils Hotspot

## Phase 3 — LIVE

* [ ] Live Service
* [ ] Détection des nouvelles connexions
* [ ] Détection des déconnexions
* [ ] Gestion des sessions
* [ ] WebSocket
* [ ] Compteur LIVE
* [ ] Dashboard LIVE

## Phase 4 — Métier

* [ ] Abonnés
* [ ] Forfaits
* [ ] Tickets
* [ ] Activation
* [ ] Expiration
* [ ] Quotas
* [ ] Historique
* [ ] Paiements

## Phase 5 — Dashboard

* [ ] Dashboard principal
* [ ] Utilisateurs LIVE
* [ ] Gestion des abonnés
* [ ] Gestion des forfaits
* [ ] Gestion des tickets
* [ ] Gestion des routeurs
* [ ] Statistiques
* [ ] Revenus

## Phase 6 — Captive Portal

* [ ] Login
* [ ] Validation du ticket
* [ ] Connexion Hotspot
* [ ] Page de statut
* [ ] Affichage de l'expiration
* [ ] Déconnexion
* [ ] Interface responsive

---

# 🔐 Sécurité

Principes :

* mots de passe MikroTik chiffrés
* secrets uniquement dans les variables d'environnement
* authentification administrateur
* hash des mots de passe
* validation des entrées API
* protection contre les injections SQL
* contrôle des permissions
* journalisation des actions sensibles
* HTTPS en production
* aucune donnée sensible dans le frontend

---

# 📊 Objectifs V2

HOTSPOT MANAGEMENT V2 doit permettre de :

```text
✓ Administrer plusieurs MikroTik
✓ Voir les utilisateurs réellement connectés
✓ Synchroniser les sessions
✓ Gérer les forfaits
✓ Générer et gérer les tickets
✓ Suivre la consommation
✓ Suivre les paiements
✓ Conserver l'historique
✓ Afficher les statistiques
✓ Mettre à jour le dashboard en temps réel
✓ Gérer le captive portal
✓ Évoluer vers plusieurs sites
```

---

# 🚫 Règles à ne pas violer

### Règle 1

**PostgreSQL ne décide jamais seul qu'un utilisateur est actuellement connecté.**

### Règle 2

**MikroTik est la source de vérité pour le LIVE.**

### Règle 3

**Une session correspond à une connexion réelle.**

### Règle 4

**Un forfait est indépendant des sessions.**

### Règle 5

**Le frontend ne contient pas de logique métier critique.**

### Règle 6

**Les prix et paramètres métier ne sont jamais codés en dur dans React.**

### Règle 7

**Chaque module possède une responsabilité clairement définie.**

---

# 🚧 Principe de développement

La V2 ne doit pas reproduire les erreurs de la V1.

Avant d'ajouter une fonctionnalité :

1. définir son modèle de données ;
2. définir sa source de vérité ;
3. définir son API ;
4. définir sa logique métier ;
5. écrire les tests ;
6. implémenter le backend ;
7. connecter le frontend ;
8. tester avec un véritable MikroTik.

---

# 📌 État du projet

**Version :** `2.0.0-alpha`

**Statut :** Architecture / conception

**Prochaine étape :**

```text
HOTSPOT MANAGEMENT V2
        │
        ▼
DATABASE DESIGN
        │
        ▼
PostgreSQL Schema
        │
        ▼
Migrations
```

---

## Auteur

**HOTSPOT MANAGEMENT V2**

Projet de gestion et d'administration de réseaux Hotspot MikroTik.
HOTSPOT MANAGEMENT V2
│
├── AUTHENTIFICATION
│   ├── Administrateurs
│   ├── Rôles
│   └── Permissions
│
├── INFRASTRUCTURE
│   ├── Sites / Hotspots
│   ├── Routeurs MikroTik
│   └── Équipements / AP
│
├── HOTSPOT
│   ├── Profils
│   ├── Tarifs
│   ├── Tickets / Vouchers
│   ├── Clients
│   └── Sessions
│
├── FINANCE
│   ├── Ventes
│   ├── Paiements
│   └── Revenus
│
├── SUPERVISION
│   ├── État des routeurs
│   ├── Clients connectés
│   ├── Trafic
│   └── Statistiques
│
└── AUDIT
    ├── Journal système
    ├── Actions administrateurs
    └── Événements MikroTik

                        HOTSPOT MANAGEMENT V2
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ADMINISTRATION      INFRASTRUCTURE       HOTSPOT
        │                   │                   │
   users / roles       sites / routers      profiles
                        access_points          plans
                                                │
                                             vouchers
                                                │
                                             clients
                                                │
                                             sessions
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                     FINANCE / AUDIT
                            │
                    ┌───────┴────────┐
                    │                │
                  sales           payments
                    │
                audit_logs