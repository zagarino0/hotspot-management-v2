# Architecture VPN MikroTik — Hotspot Management V2

## Objectif et contraintes

- Le backend actuel est hébergé sur Render.
- Le routeur connu est un MikroTik hAP ac² sous RouterOS 6.49.23, derrière un routeur amont/Starlink et du NAT.
- Son adresse LAN est 192.168.88.1. Cette adresse privée n'est pas directement routable depuis Render.
- Aucun VPS n'est encore disponible.
- Ne jamais publier les ports RouterOS API 8728 ou API-SSL 8729 sur Internet.

Ce document prépare l'architecture. Il ne configure aucun tunnel et ne signifie pas que le VPN est actif.

## Architecture cible recommandée

1. **VPS public** : point de terminaison WireGuard, pare-feu strict et supervision.
2. **MikroTik** : tunnel WireGuard initié depuis le site vers l'adresse publique du VPS. Cela permet de traverser le NAT/Starlink sans redirection entrante vers le routeur.
3. **Réseau VPN dédié** : sous-réseau WireGuard distinct du LAN, par exemple 10.77.0.0/24 après vérification d'absence de chevauchement. Attribuer une adresse VPN fixe au routeur et une autre au VPS.
4. **Backend** : le processus qui appelle RouterOS doit avoir un chemin réseau explicite vers l'adresse VPN du routeur. Le simple réglage `MIKROTIK_NETWORK_MODE=vpn` ne crée ni tunnel, ni route, ni proxy.

### Choix pour le backend

**Option préférée pour une architecture simple et sûre :** héberger le backend dans le VPS ou dans un réseau privé qu'il contrôle, afin qu'il puisse joindre directement l'adresse VPN du MikroTik. Il faudra planifier le déplacement du service, les secrets, la base de données, les sauvegardes, les migrations et le déploiement sans interruption.

**Si le backend reste sur Render :** mettre en place une passerelle TCP dédiée sur le VPS, accessible uniquement via TLS mutuel (mTLS), avec authentification client, filtrage réseau, journalisation et autorisation limitée au routeur/port nécessaires. Le proxy ne doit écouter que sur son interface VPN pour la destination MikroTik. Vérifier si Render fournit une adresse de sortie fixe avant de s'appuyer sur une liste d'autorisation IP. Ne pas exposer directement 8728/8729 et ne pas publier un proxy TCP sans authentification.

Ne pas retenir un simple port-forward public vers le MikroTik.

## Prérequis avant configuration

- Choisir un fournisseur VPS et une région adaptée.
- Créer une sauvegarde chiffrée de la configuration MikroTik et vérifier une procédure de restauration.
- Préparer une fenêtre de maintenance pour migrer RouterOS 6.49.23 vers une version RouterOS 7 compatible avec WireGuard, après vérification du modèle, de l'espace disque et des paquets.
- Générer des clés WireGuard uniques pour le VPS et le routeur. Les clés privées restent sur leurs machines et ne sont jamais commitées dans GitHub.
- Choisir un plan d'adressage VPN qui ne chevauche ni le LAN du site, ni les réseaux de l'hébergeur.
- N'autoriser que le trafic requis entre le backend/passerelle et l'adresse VPN du routeur.
- Conserver API/API-SSL accessibles uniquement depuis l'interface VPN ou une adresse d'administration explicitement autorisée. Désactiver les services inutilisés.
- Pour API-SSL, installer un certificat adapté et conserver la validation TLS activée. Un certificat auto-signé non approuvé ne doit pas être contourné en désactivant la vérification.

## Variables applicatives

- `MIKROTIK_NETWORK_MODE=direct` est le mode actuel par défaut. Il ne signifie pas que l'accès Internet direct est recommandé.
- `MIKROTIK_NETWORK_MODE=vpn` est uniquement un indicateur de diagnostic applicatif à ce stade. Il ne met pas en place le VPN et ne prouve pas que la route est disponible.
- L'adresse et le port configurés côté backend doivent être l'adresse VPN privée du routeur (ou une destination de passerelle explicitement documentée), jamais une adresse publique avec 8728/8729 ouvert.

Ne pas activer le mode VPN en production avant d'avoir configuré et testé le chemin réseau complet.

## Tests de validation avant mise en production

1. WireGuard actif et stable après redémarrage du routeur et du VPS.
2. Le VPS joint l'adresse VPN du MikroTik; aucune connexion ne dépend de l'adresse WAN Starlink.
3. Depuis l'hôte backend, la destination RouterOS est joignable uniquement par le chemin privé prévu.
4. Test API-SSL avec certificat vérifié, compte MikroTik dédié et permissions minimales.
5. Échec attendu depuis un réseau externe non autorisé.
6. Tests fonctionnels : lecture des ressources, profils, sessions, création de vouchers et synchronisation.
7. Vérifier reconnexion après coupure WAN, rotation des clés/secrets, logs sans mot de passe, sauvegardes et procédure de retour arrière.

## État

- [x] Transport applicatif API / API-SSL distingué et CI validée sur la branche de travail.
- [x] Exigence de ne pas exposer les ports API documentée.
- [ ] VPS choisi et provisionné.
- [ ] Sauvegarde routeur et migration RouterOS 7 planifiées.
- [ ] WireGuard configuré et testé.
- [ ] Chemin réseau Render/backend validé.
- [ ] Tests réels MikroTik effectués.
- [ ] Pull Request examinée et fusionnée.

Aucun VPS, tunnel VPN ou accès distant n'est configuré par ce document.
