BEGIN;

-- Historique créé avant la migration 012 :
-- si la durée n'était pas enregistrée, on la reconstruit à partir
-- de la date de connexion et de la date de déconnexion.
UPDATE session
SET duration_seconds = GREATEST(
  EXTRACT(EPOCH FROM (ended_at - started_at))::bigint,
  0
)
WHERE status <> 'ACTIVE'
  AND ended_at IS NOT NULL
  AND started_at IS NOT NULL
  AND duration_seconds IS NULL;

-- Pour les anciennes sessions déjà déconnectées, on calcule le
-- temps restant à la fin de chaque connexion selon l'ordre réel
-- des connexions du même voucher.
WITH ordered_sessions AS (
  SELECT
    s.id,
    v.duration_seconds AS voucher_duration_seconds,
    SUM(COALESCE(s.duration_seconds, 0)) OVER (
      PARTITION BY s.voucher_id
      ORDER BY s.started_at ASC, s.id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS used_seconds_at_end
  FROM session s
  INNER JOIN voucher v ON v.id = s.voucher_id
  WHERE s.voucher_id IS NOT NULL
    AND s.status <> 'ACTIVE'
    AND s.ended_at IS NOT NULL
    AND s.voucher_remaining_seconds_at_end IS NULL
    AND v.duration_seconds IS NOT NULL
)
UPDATE session s
SET voucher_remaining_seconds_at_end = GREATEST(
  o.voucher_duration_seconds - o.used_seconds_at_end,
  0
)::bigint
FROM ordered_sessions o
WHERE s.id = o.id;

COMMENT ON COLUMN session.voucher_remaining_seconds_at_end IS
  'Temps restant sur le voucher au moment exact de la déconnexion de cette session. Pour les anciennes sessions, la valeur est reconstruite à partir de la durée historique disponible.';

COMMIT;
