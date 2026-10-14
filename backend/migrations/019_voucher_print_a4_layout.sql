-- Aligne le modèle standard sur les tickets compacts en 4 colonnes sur A4.
-- Les modèles personnalisés (nom différent) sont conservés.
UPDATE voucher_print_template
SET
  html = '<article class="dw-voucher" style="height:100%;display:flex;flex-direction:column;justify-content:space-between;text-align:center;font-family:Arial,sans-serif;font-size:7pt;line-height:1.05"><header style="font-size:8pt;font-weight:800;border-bottom:1px solid #111;padding-bottom:0.5mm">{{hotspotname}} <span>[{{index}}]</span></header><table style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr><th style="border:0.5px solid #555;font-size:6pt;font-weight:400">Anarana</th><th style="border:0.5px solid #555;font-size:6pt;font-weight:400">Code</th></tr></thead><tbody><tr><td style="border:0.5px solid #555;font-size:8pt;font-weight:700">{{username}}</td><td style="border:0.5px solid #555;font-size:8pt;font-weight:700">{{password}}</td></tr></tbody></table><footer style="border:0.5px solid #555;font-size:7pt;font-weight:700;padding:0.5mm">{{validity}} Ar {{price}}</footer></article>',
  width_mm = 48,
  height_mm = 22,
  updated_at = NOW()
WHERE id = 1 AND name = 'Modèle standard';
