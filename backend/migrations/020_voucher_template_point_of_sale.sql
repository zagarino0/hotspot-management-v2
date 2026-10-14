-- Ajoute le point de vente au modèle standard des tickets.
-- Les modèles personnalisés ne sont pas modifiés.
UPDATE voucher_print_template
SET
  html = REPLACE(
    html,
    '</header><table',
    '</header><div style="font-size:6pt">Point de vente : {{pointofsale}}</div><table'
  ),
  updated_at = NOW()
WHERE id = 1
  AND name = 'Modèle standard'
  AND html NOT LIKE '%{{pointofsale}}%';
