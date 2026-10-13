CREATE TABLE IF NOT EXISTS voucher_print_template (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name VARCHAR(120) NOT NULL DEFAULT 'Modèle standard',
  html TEXT NOT NULL,
  width_mm NUMERIC(7,2) NOT NULL DEFAULT 55 CHECK (width_mm BETWEEN 20 AND 300),
  height_mm NUMERIC(7,2) NOT NULL DEFAULT 30 CHECK (height_mm BETWEEN 10 AND 300),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL
);
INSERT INTO voucher_print_template (id, name, html, width_mm, height_mm)
VALUES (1, 'Modèle standard',
'<article class="ticket"><h3>{{hotspotname}}</h3><p>Identifiant : <strong>{{username}}</strong></p><p>Mot de passe : <strong>{{password}}</strong></p><p>Durée : {{validity}}</p><p>Profil : {{profile}}</p></article>',
55, 30)
ON CONFLICT (id) DO NOTHING;
