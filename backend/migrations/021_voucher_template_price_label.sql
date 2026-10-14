-- Corrige le libellé de pied de ticket : la devise est déjà incluse dans {{price}}.
UPDATE voucher_print_template
SET
  html = REPLACE(html, '{{validity}} Ar {{price}}', '{{validity}} · {{price}}'),
  updated_at = NOW()
WHERE id = 1
  AND name = 'Modèle standard'
  AND html LIKE '%{{validity}} Ar {{price}}%';
