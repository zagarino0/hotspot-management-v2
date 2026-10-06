BEGIN;

-- Rattache les anciennes sessions au voucher réellement utilisé lorsque
-- l'ancien système n'avait pas encore enregistré voucher_id.
-- Le code voucher est globalement unique, donc la correspondance est sûre.
UPDATE session s
SET voucher_id = v.id
FROM voucher v
WHERE s.voucher_id IS NULL
  AND s.username IS NOT NULL
  AND v.code = s.username
  AND v.site_id = s.site_id;

-- Reconstruit la durée des anciennes sessions lorsqu'elle manque.
UPDATE session
SET duration_seconds = GREATEST(
  EXTRACT(EPOCH FROM (ended_at - started_at))::bigint,
  0
)
WHERE status <> 'ACTIVE'
  AND ended_at IS NOT NULL
  AND started_at IS NOT NULL
  AND duration_seconds IS NULL;

-- Calcule le temps restant après chaque ancienne connexion du même voucher.
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
