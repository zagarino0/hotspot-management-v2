-- Modèle standard compact : supprimer le quota et afficher durée - prix.
-- Mise à jour des installations existantes où la migration 032 a déjà ajouté le quota.
UPDATE voucher_print_template
SET
  html = REPLACE(
    REPLACE(html, '{{validity}} · {{datalimit}} · {{price}}', '{{validity}} - {{price}}'),
    '{{validity}} Ar {{price}}',
    '{{validity}} - {{price}}'
  ),
  updated_at = NOW()
WHERE id = 1
  AND name = 'Modèle standard';
