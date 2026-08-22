import { pool } from "../../database/pool.js";

import type {
  LiveSessionData,
  SessionRow,
  SessionStatus,
} from "../../routes/session.types.js";

/* ============================================================
   SELECT
============================================================ */

const SESSION_SELECT = `
  SELECT
    s.id,

    s.site_id AS "siteId",
    s.router_id AS "routerId",
    r.name AS "routerName",

    s.voucher_id AS "voucherId",
    s.client_id AS "clientId",
    s.device_id AS "deviceId",

    s.username,

    s.mac_address AS "macAddress",
    s.ip_address::text AS "ipAddress",

    s.started_at AS "startedAt",
    s.ended_at AS "endedAt",

    s.duration_seconds AS "durationSeconds",

    s.upload_bytes AS "uploadBytes",
    s.download_bytes AS "downloadBytes",

    s.termination_reason AS "terminationReason",

    s.status,

    s.created_at AS "createdAt",
    s.updated_at AS "updatedAt"

  FROM session s
  LEFT JOIN router r ON r.id = s.router_id
`;

const SESSION_LIST_LIMIT = 300;

/* ============================================================
   LIST
============================================================ */

export async function findSessions(filter?: {
  status?: SessionStatus;
}): Promise<SessionRow[]> {
  if (filter?.status) {
    const result = await pool.query<SessionRow>(
      `
        ${SESSION_SELECT}
        WHERE s.status = $1
        ORDER BY s.started_at DESC
        LIMIT ${SESSION_LIST_LIMIT}
      `,
      [filter.status]
    );

    return result.rows;
  }

  const result = await pool.query<SessionRow>(
    `
      ${SESSION_SELECT}
      ORDER BY s.started_at DESC
      LIMIT ${SESSION_LIST_LIMIT}
    `
  );

  return result.rows;
}

/* ============================================================
   FIND BY ID
============================================================ */

export async function findSessionById(
  id: string
): Promise<SessionRow | null> {
  const result = await pool.query<SessionRow>(
    `
      ${SESSION_SELECT}
      WHERE s.id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

/* ============================================================
   MARK TERMINATED (déconnexion manuelle déclenchée par un admin)
============================================================ */

export async function markSessionTerminated(
  id: string,
  reason: string
): Promise<SessionRow | null> {
  await pool.query(
    `
      UPDATE session
      SET
        status = 'TERMINATED',
        ended_at = NOW(),
        duration_seconds =
          EXTRACT(EPOCH FROM (NOW() - started_at))::bigint,
        termination_reason = $2,
        updated_at = NOW()
      WHERE id = $1
    `,
    [id, reason]
  );

  return findSessionById(id);
}

/* ============================================================
   UPSERT ACTIVE SESSION (appelé par le live sync MikroTik)

   Clé de correspondance : (router_id, mac_address) sur une
   session encore ACTIVE. C'est le seul identifiant stable
   fourni par /ip/hotspot/active/print d'un cycle de sync à
   l'autre (le ".id" RouterOS est interne au routeur et peut
   être réattribué après un redémarrage).
============================================================ */

export async function upsertActiveSession(
  data: LiveSessionData
): Promise<void> {
  const existing = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM session
      WHERE router_id = $1
        AND mac_address = $2
        AND status = 'ACTIVE'
        AND ended_at IS NULL
      LIMIT 1
    `,
    [data.routerId, data.macAddress]
  );

  if (existing.rows[0]) {
    await pool.query(
      `
        UPDATE session
        SET
          username = COALESCE($2, username),
          ip_address = $3::inet,
          upload_bytes = $4,
          download_bytes = $5,
          duration_seconds =
            EXTRACT(EPOCH FROM (NOW() - started_at))::bigint,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        existing.rows[0].id,
        data.username,
        data.ipAddress,
        data.uploadBytes,
        data.downloadBytes,
      ]
    );

    return;
  }

  await pool.query(
    `
      INSERT INTO session (
        site_id,
        router_id,
        username,
        mac_address,
        ip_address,
        upload_bytes,
        download_bytes,
        status
      )
      VALUES (
        $1, $2, $3, $4, $5::inet, $6, $7, 'ACTIVE'
      )
    `,
    [
      data.siteId,
      data.routerId,
      data.username,
      data.macAddress,
      data.ipAddress,
      data.uploadBytes,
      data.downloadBytes,
    ]
  );
}

/* ============================================================
   CLOSE SESSIONS NOT IN LIST
   Toute session ACTIVE en base pour ce routeur qui n'apparaît
   plus dans /ip/hotspot/active/print est considérée terminée.
============================================================ */

export async function closeSessionsNotIn(
  routerId: string,
  stillActiveMacAddresses: string[]
): Promise<number> {
  const result = await pool.query(
    `
      UPDATE session
      SET
        status = 'COMPLETED',
        ended_at = NOW(),
        duration_seconds =
          EXTRACT(EPOCH FROM (NOW() - started_at))::bigint,
        termination_reason = 'DISCONNECTED',
        updated_at = NOW()
      WHERE router_id = $1
        AND status = 'ACTIVE'
        AND ended_at IS NULL
        AND (
          mac_address IS NULL
          OR NOT (mac_address = ANY($2::text[]))
        )
    `,
    [routerId, stillActiveMacAddresses]
  );

  return result.rowCount ?? 0;
}

/* ============================================================
   CLOSE ALL ACTIVE FOR ROUTER (routeur injoignable)
   Si on n'arrive pas à joindre le routeur, on ne sait plus s'il
   y a réellement des utilisateurs connectés : on ne ferme PAS
   les sessions automatiquement (on préfère un faux "actif" à
   une perte d'historique). Cette fonction existe pour un usage
   explicite futur (ex: désactivation manuelle d'un routeur).
============================================================ */

export async function closeAllActiveForRouter(
  routerId: string,
  reason: string
): Promise<number> {
  const result = await pool.query(
    `
      UPDATE session
      SET
        status = 'TERMINATED',
        ended_at = NOW(),
        duration_seconds =
          EXTRACT(EPOCH FROM (NOW() - started_at))::bigint,
        termination_reason = $2,
        updated_at = NOW()
      WHERE router_id = $1
        AND status = 'ACTIVE'
        AND ended_at IS NULL
    `,
    [routerId, reason]
  );

  return result.rowCount ?? 0;
}
