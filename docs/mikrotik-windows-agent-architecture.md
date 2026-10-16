# Agent Windows MikroTik — architecture et plan d’intégration

## Constat vérifié

Le backend Render tente actuellement d'ouvrir directement une connexion RouterOS avec `node-routeros`. Pour le routeur configuré en `192.168.88.1:8728`, Render expire après 10 secondes. Cette IP appartient au réseau privé du site et n'est pas routable depuis Render sans VPN ou relais.

## Architecture cible

```text
Interface web
    | HTTPS + JWT
    v
Backend Render + PostgreSQL
    ^ HTTPS sortant authentifié (polling / réponses)
    |
Agent Windows installé sur le LAN
    | RouterOS API, LAN uniquement
    v
MikroTik 192.168.88.1:8728
```

L'agent n'ouvre aucun port entrant sur Windows et ne publie pas le port 8728 sur Internet. Les échanges agent/backend doivent être chiffrés et authentifiés avec un secret d'agent distinct du JWT utilisateur et des identifiants MikroTik.

## Contrats nécessaires

1. **Enrôlement** : un administrateur génère dans l'application un code à usage unique, à durée courte et lié à l'organisation/site. L'agent l'échange contre un identifiant et un secret révocable. Ne pas placer un secret partagé permanent dans le dépôt.
2. **Heartbeat** : l'agent annonce périodiquement sa disponibilité et sa version. Le backend affiche explicitement « Agent en ligne/hors ligne ».
3. **File de tâches durable** : PostgreSQL stocke les commandes avec identifiant unique, agent/site/routeur ciblés, date d'expiration, état et résultat. Les commandes sont limitées à une liste autorisée (test connexion, lecture d'identité/ressources/profils/sessions et commandes métier explicitement approuvées). Pas d'exécution arbitraire de RouterOS.
4. **Résultats idempotents** : l'agent confirme une tâche par son identifiant. Le backend refuse les tâches expirées, les doublons et les tâches hors du périmètre autorisé.
5. **Routage des opérations** : le test et la création de routeur doivent passer par l'agent lorsque l'adresse est privée. Le synchroniseur live, les sessions, les profils, les vouchers et les autres opérations RouterOS doivent ensuite utiliser le même transport; aucune tentative directe depuis Render ne doit être utilisée comme fallback silencieux.
6. **Sécurité** : TLS obligatoire, secret d'agent stocké dans le gestionnaire d'identifiants Windows ou protégé par ACL, rotation/révocation, limitation de débit, validation stricte des messages, logs sans mot de passe ni secret, et contrôle d'accès par organisation/site.

## Plan d'implémentation

### Phase 1 — transport et enrôlement
- Ajouter une migration SQL pour agents, tâches et résultats.
- Ajouter des routes machine-à-machine dédiées, protégées par une authentification agent distincte.
- Créer un agent Node.js/TypeScript Windows avec configuration locale, polling HTTPS, heartbeat, arrêt propre et logs sans secrets.
- Ajouter tests unitaires et d'intégration sur l'authentification, les tâches expirées, l'isolation organisation/site et l'idempotence.

### Phase 2 — test de connexion et création
- Le bouton « Tester la connexion » soumet une tâche au bon agent et attend le résultat avec délai borné.
- L'agent vérifie localement la connexion RouterOS et retourne uniquement les données utiles (identité, modèle, version, uptime, DNS).
- La création n'enregistre le routeur et ses identifiants chiffrés en PostgreSQL qu'après un test réussi.

### Phase 3 — opérations courantes
- Adapter le synchroniseur et les modules sessions/profils/vouchers/ventes pour envoyer les commandes à l'agent.
- Afficher la disponibilité de l'agent distinctement de la disponibilité du routeur.
- Désactiver proprement la synchronisation si aucun agent associé n'est en ligne; ne pas marquer le routeur hors ligne sur une simple erreur de cloud/agent.

## Critères d'acceptation

- Depuis Windows, l'agent peut joindre `192.168.88.1:8728` sur le LAN.
- Render ne tente plus de joindre directement cette IP privée pour les opérations prises en charge.
- Un agent absent ou non autorisé provoque une erreur explicite, sans faux statut « MikroTik hors ligne ».
- Les secrets ne sont jamais transmis dans les logs ou le frontend.
- Les tests de permissions, expiration, doublons et isolement multi-organisation passent avant activation en production.

## Point de déploiement

Ne pas activer le nouveau flux en production avant que l'agent Windows soit installé, enrôlé et déclaré en ligne. Le service Render actuel a son auto-déploiement désactivé; tout déploiement backend devra être déclenché et vérifié explicitement.
