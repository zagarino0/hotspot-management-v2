-- Corrige les variantes historiques du modèle standard sans toucher aux modèles personnalisés.
UPDATE voucher_print_template
SET
  html = regexp_replace(
    regexp_replace(
      html,
      '\\s*[·|/]\\s*\\{\\{\\s*datalimit\\s*\\}\\}',
      '',
      'gi'
    ),
    '\\{\\{\\s*validity\\s*\\}\\}\\s*(Ar|MGA)?\\s*[-·|/]?\\s*\\{\\{\\s*price\\s*\\}\\}',
    '{{validity}} - {{price}}',
    'gi'
  ),
  updated_at = NOW()
WHERE name = 'Modèle standard'
  AND html ILIKE '%{{validity}}%'
  AND html ILIKE '%{{price}}%';
