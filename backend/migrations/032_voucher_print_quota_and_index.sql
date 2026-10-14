-- Inclut le quota dans le pied du modèle standard et garde l'index comme variable.
-- La durée et le quota proviennent du snapshot réel du voucher ; le frontend les formate.
UPDATE voucher_print_template
SET
  html = REPLACE(
    REPLACE(html, '{{validity}} · {{price}}', '{{validity}} · {{datalimit}} · {{price}}'),
    '{{validity}} Ar {{price}}',
    '{{validity}} · {{datalimit}} · {{price}}'
  ),
  updated_at = NOW()
WHERE name = 'Modèle standard'
  AND (html LIKE '%{{validity}}%{{price}}%' OR html LIKE '%{{index}}%');
