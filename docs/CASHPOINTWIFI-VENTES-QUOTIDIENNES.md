# CASHPOINTWIFI — règles de stock, ventes et clôture quotidienne

## Objectif

Suivre le stock physique des tickets d'un point de vente externe sans exiger que le vendeur utilise l'application et sans modifier le synchroniseur MikroTik. Les tickets peuvent être générés par Hotspot Management V2 ou Mikhmon. Le commentaire MikroTik sert à identifier l'affectation au point de vente, mais ne prouve jamais une vente.

## Sources de vérité

- **MikroTik** : état technique observable (existence, activation, sessions et indices d'utilisation).
- **Registre commercial** : affectation au stock, vente déclarée, rejet, retour, remplacement et clôture.
- Une connexion ou un voucher utilisé n'est pas une preuve de paiement en espèces.
- Aucune vente `PAID` ne doit être créée automatiquement à partir d'une session MikroTik.
- Les statuts commerciaux ne doivent pas modifier automatiquement l'état MikroTik.

## Statuts commerciaux

- `AVAILABLE` : ticket affecté au stock disponible.
- `SOLD` : vente déclarée et confirmée lors du rapprochement.
- `REJECTED` : problème signalé, en attente de décision.
- `RETURN_PENDING` : retour demandé, contrôles non terminés.
- `RETURNED` : retour vérifié et réintégré au stock.
- `REPLACED` : ticket remplacé, interdit à la revente comme ticket neuf.
- `UNUSABLE` : ticket définitivement inutilisable.
- `MISSING` : ticket attendu mais non retrouvé lors du décompte.
- `UNKNOWN` : état commercial ou technique non vérifié.

L'état commercial et l'état technique MikroTik restent distincts.

## Rejets et retours

1. **Ticket défectueux / identifiants invalides** : `REJECTED`; contrôler le code et l'état technique. Ne pas réintégrer avant validation. Si non corrigeable, `UNUSABLE`.
2. **Client change d'avis avant utilisation** : retour possible après vérification de l'absence d'utilisation connue, de validité et d'intégrité du ticket. Passer par `RETURN_PENDING`, puis `RETURNED`.
3. **Ticket déjà remis ou utilisé** : le remplacement peut être validé gratuitement par un administrateur, mais l'ancien ticket devient `REPLACED` et n'est jamais remis automatiquement en stock.
4. **Remplacement** : toujours gratuit. Enregistrer l'ancien et le nouveau ticket, le motif, l'auteur et la date. Recette additionnelle = 0 MGA. Le remplacement n'est pas une nouvelle vente.
5. Si le routeur est inaccessible ou les données sont insuffisantes, garder le cas en attente/`UNKNOWN`; ne pas déduire qu'un ticket n'a jamais été utilisé.
6. Toute transition est historisée; ne pas effacer ni écraser les événements précédents.

## Calculs de vente et recettes

- Nombre de tickets vendus = nombre de tickets distincts avec une vente commerciale confirmée durant la journée, hors tickets remis gratuitement en remplacement.
- Recette brute = somme des prix enregistrés au moment de chaque vente confirmée.
- Recette nette = recette brute moins les remboursements effectivement accordés ce jour-là.
- Un remplacement gratuit vaut 0 MGA et n'est pas soustrait une deuxième fois comme remboursement.
- Un voucher actif/utilisé sans confirmation commerciale n'est pas compté comme vente confirmée.
- Conserver le prix unitaire et la devise comme instantané à la vente; un changement ultérieur de tarif ne modifie pas l'historique.
- La date de vente commerciale détermine la journée de recette; la création du voucher et sa première connexion ne la déterminent pas.

## Clôture quotidienne et stock

Une clôture par point de vente et date locale (Madagascar, fuseau `Indian/Antananarivo`) est unique. Elle conserve les totaux figés, l'utilisateur qui l'a clôturée et l'heure de clôture. Une clôture validée n'est pas modifiée silencieusement; toute correction doit être auditée.

Équation de contrôle des tickets physiques :

`Stock ouverture + tickets reçus = vendus + invendus en stock + rejets en attente + tickets sortis du stock comme inutilisables + tickets de remplacement remis gratuitement + manquants`

Les catégories doivent être mutuellement exclusives pour la clôture. Les tickets remplacés ne sont pas comptés comme vendus une deuxième fois; le nouveau ticket est un mouvement de stock gratuit, pas une vente. Signaler tout écart au lieu de forcer l'équilibre.

## Architecture attendue

- Ajouter un registre d'événements commerciaux séparé.
- Ajouter les clôtures quotidiennes et les instantanés des indicateurs.
- Ajouter des routes protégées dans le module Sales pour consulter le stock, enregistrer rejets/retours/remplacements et clôturer une journée.
- Vérifier l'organisation du POS et les permissions de l'utilisateur sur chaque route.
- Opérations transactionnelles, idempotentes, et auditables.
- Le synchroniseur MikroTik, sa cadence, les règles d'identification POS et les fonctions d'activation/désactivation restent inchangés.
- Ne pas modifier le frontend tant que la chaîne backend n'est pas complète et testée.

## Limite actuelle

Sans relevé de vente ni saisie de clôture par l'administrateur, le backend ne peut pas prouver les paiements en espèces. Le rapprochement MikroTik fournit des indices d'utilisation seulement. La première version doit afficher séparément les ventes confirmées et les indices techniques.
