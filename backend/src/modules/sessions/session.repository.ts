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

    s.mikrotik_profile AS "mikrotikProfile",
    s.mikrotik_limit_uptime_seconds AS "mikrotikLimitUptimeSeconds",
    s.session_time_left_seconds AS "sessionTimeLeftSeconds",
    s.login_method AS "loginMethod",
    s.cookie_present AS "cookiePresent",

    COALESCE(voucher_usage.consumed_seconds, 0)::bigint AS "voucherUsedSeconds",

    COALESCE(
      v.duration_seconds,
      s.mikrotik_limit_uptime_seconds
    ) AS "voucherDurationSeconds",

    CASE
      WHEN COALESCE(
        v.duration_seconds,
        s.mikrotik_limit_uptime_seconds
      ) IS NULL THEN NULL
      ELSE GREATEST(
        COALESCE(
          v.duration_seconds,
          s.mikrotik_limit_uptime_seconds
        ) - COALESCE(voucher_usage.consumed_seconds, 0),
        0
      )::bigint
    END AS "voucherRemainingSeconds",

    CASE
      WHEN COALESCE(
        v.duration_seconds,
        s.mikrotik_limit_uptime_seconds
      ) IS NULL THEN NULL
      ELSE GREATEST(
        COALESCE(
          v.duration_seconds,
          s.mikrotik_limit_uptime_seconds
        ) - COALESCE(voucher_usage.consumed_seconds, 0),
        0
      )::bigint
    END AS "voucherRemainingSecondsAtEnd",

    v.code AS "voucherCode",

    CASE
      WHEN s.voucher_id IS NOT NULL THEN (
        SELECT COUNT(*)::int + 1
        FROM session s2
        WHERE (
                  (
                    s.voucher_id IS NOT NULL
                    AND s2.voucher_id = s.voucher_id
                  )
                  OR (
                    s.voucher_id IS NULL
                    AND s2.voucher_id IS NULL
                    AND s2.site_id = s.site_id
                    AND s2.router_id = s.router_id
                    AND s2.username = s.username
                  )
                )
          AND (
            s2.started_at < s.started_at
            OR (
              s2.started_at = s.started_at
              AND s2.id < s.id
            )
          )
      )
      ELSE (
        SELECT COUNT(*)::int + 1
        FROM session s2
        WHERE s2.voucher_id IS NULL
          AND s2.site_id = s.site_id
          AND s2.router_id = s.router_id
          AND s2.username = s.username
          AND (
            s2.started_at < s.started_at
            OR (
              s2.started_at = s.started_at
              AND s2.id < s.id
            )
          )
      )
    END AS "connectionSequence",

    s.termination_reason AS "terminationReason",

    s.status,

    s.created_at AS "createdAt",
    s.updated_at AS "updatedAt"

  FROM session s
  LEFT JOIN router r ON r.id = s.router_id
  LEFT JOIN voucher v ON v.id = s.voucher_id
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(
        SUM(
          GREATEST(
            COALESCE(s2.duration_seconds, 0),
            0
          )
        ),
        0
      )::bigint AS consumed_seconds
    FROM session s2
    WHERE (
      (
        s.voucher_id IS NOT NULL
        AND s2.voucher_id = s.voucher_id
      )
      OR (
        s.voucher_id IS NULL
        AND s2.voucher_id IS NULL
        AND s2.site_id = s.site_id
        AND s2.router_id = s.router_id
        AND s2.username = s.username
      )
    )
      AND (
        s2.started_at < s.started_at
        OR (
          s2.started_at = s.started_at
          AND s2.id <= s.id
        )
      )
  ) voucher_usage ON TRUE
`;

const SESSION_LIST_LIMIT = 300;

/* ============================================================
   RECONCILIATION DU STATUT PERSISTÉ
   ACTIVE      = connexion en cours
   TERMINATED  = déconnectée mais quota encore disponible
   COMPLETED   = déconnectée et quota épuisé
============================================================ */

async function reconcileSessionStatuses(): Promise<void> {
  await pool.query(
    `
      UPDATE session
      SET
        status = CASE
          WHEN voucher_remaining_seconds_at_end > 0
            THEN 'TERMINATED'
          WHEN voucher_remaining_seconds_at_end = 0
            THEN 'COMPLETED'
          ELSE status
        END,
        updated_at = CASE
          WHEN (
            (voucher_remaining_seconds_at_end > 0
              AND status <> 'TERMINATED')
            OR
            (voucher_remaining_seconds_at_end = 0
              AND status <> 'COMPLETED')
          )
          THEN NOW()
          ELSE updated_at
        END
      WHERE ended_at IS NOT NULL
        AND status IN ('COMPLETED', 'TERMINATED')
        AND voucher_remaining_seconds_at_end IS NOT NULL
    `
  );
}

/* ============================================================
   LIST
============================================================ */

export async function findSessions(filter?: {
  status?: SessionStatus;
}): Promise<SessionRow[]> {
  await reconcileSessionStatuses();

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
  await reconcileSessionStatuses();

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
   HISTORIQUE D'UN UTILISATEUR
============================================================ */

export async function findSessionHistory(
  username: string,
  siteId?: string,
  routerId?: string
): Promise<SessionRow[]> {
  await reconcileSessionStatuses();

  const conditions = ["s.username = $1"];
  const values: string[] = [username];

  if (siteId) {
    values.push(siteId);
    conditions.push("s.site_id = $" + values.length);
  }

  if (routerId) {
    values.push(routerId);
    conditions.push("s.router_id = $" + values.length);
  }

  const result = await pool.query<SessionRow>(
    `
      ${SESSION_SELECT}
      WHERE ${conditions.join(" AND ")}
      ORDER BY s.started_at ASC
      LIMIT ${SESSION_LIST_LIMIT}
    `,
    values
  );

  return result.rows;
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
      UPDATE session s
      SET
        status = 'TERMINATED',
        ended_at = NOW(),
        duration_seconds = GREATEST(
          COALESCE(s.duration_seconds, 0),
          0
        ),
        voucher_remaining_seconds_at_end =
          CASE
            WHEN COALESCE(
              (
                SELECT v.duration_seconds
                FROM voucher v
                WHERE v.id = s.voucher_id
              ),
              s.mikrotik_limit_uptime_seconds
            ) IS NULL THEN NULL
            ELSE GREATEST(
              COALESCE(
              (
                SELECT v.duration_seconds
                FROM voucher v
                WHERE v.id = s.voucher_id
              ),
              s.mikrotik_limit_uptime_seconds
            ) - (
                SELECT COALESCE(
                  SUM(
                    CASE
                      WHEN s2.id = s.id
                        THEN COALESCE(s.duration_seconds, 0)
                      ELSE COALESCE(s2.duration_seconds, 0)
                    END
                  ),
                  0
                )
                FROM session s2
                WHERE (
                  (
                    s.voucher_id IS NOT NULL
                    AND s2.voucher_id = s.voucher_id
                  )
                  OR (
                    s.voucher_id IS NULL
                    AND s2.voucher_id IS NULL
                    AND s2.site_id = s.site_id
                    AND s2.router_id = s.router_id
                    AND s2.username = s.username
                  )
                )
              ),
              0
            )::bigint
          END,
        termination_reason = $2,
        updated_at = NOW()
      WHERE s.id = $1
    `,
    [id, reason]
  );

  return findSessionById(id);
}

/* ============================================================
   BACKFILL QUOTA MIKROTIK POUR L'HISTORIQUE
   Le compte HotSpot MikroTik est la source du quota total.
   Lorsqu'un utilisateur est actif, on rattache ce quota aux
   anciennes sessions du même compte qui n'en avaient pas encore.
============================================================ */

export async function backfillMikrotikMetadataForUser(
  siteId: string,
  routerId: string,
  username: string,
  profile: string | null,
  limitUptimeSeconds: number | null
): Promise<void> {
  if (!username.trim()) {
    return;
  }

  await pool.query(
    `
      UPDATE session
      SET
        mikrotik_profile = COALESCE($4, mikrotik_profile),
        mikrotik_limit_uptime_seconds = COALESCE(
          $5,
          mikrotik_limit_uptime_seconds
        ),
        updated_at = NOW()
      WHERE site_id = $1
        AND router_id = $2
        AND username = $3
    `,
    [
      siteId,
      routerId,
      username,
      profile,
      limitUptimeSeconds,
    ]
  );
}

/* ============================================================
   UPSERT ACTIVE SESSION (appelé par le live sync MikroTik)

   Clé de correspondance : (router_id, mac_address) sur une
   session encore ACTIVE. C'est le seul identifiant stable
   fourni par /ip/hotspot/active/print d'un cycle de sync à
   l'autre (le ".id" RouterOS est interne au routeur et peut
   être réattribué après un redémarrage).
============================================================ */

export interface UpsertActiveSessionResult {
  created: boolean;
  sessionId: string;
}

export async function upsertActiveSession(
  data: LiveSessionData
): Promise<UpsertActiveSessionResult> {
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
    const sessionId = existing.rows[0].id;

    await pool.query(
      `
        UPDATE session
        SET
          voucher_id = COALESCE($2, voucher_id),
          username = COALESCE($3, username),
          ip_address = $4::inet,
          upload_bytes = $5,
          download_bytes = $6,
          mikrotik_profile = COALESCE($7, mikrotik_profile),
          mikrotik_limit_uptime_seconds = COALESCE(
            $8,
            mikrotik_limit_uptime_seconds
          ),
          session_time_left_seconds = $9,
          login_method = COALESCE($10, login_method),
          cookie_present = $11,
          duration_seconds = GREATEST(
            COALESCE(duration_seconds, 0),
            $12::bigint
          ),
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        sessionId,
        data.voucherId ?? null,
        data.username,
        data.ipAddress,
        data.uploadBytes,
        data.downloadBytes,
        data.mikrotikProfile,
        data.mikrotikLimitUptimeSeconds ?? null,
        data.sessionTimeLeftSeconds,
        data.loginMethod,
        data.cookiePresent,
        data.uptimeSeconds,
      ]
    );

    return { created: false, sessionId };
  }

  const inserted = await pool.query<{ id: string }>(
    `
      INSERT INTO session (
        site_id,
        router_id,
        voucher_id,
        username,
        mac_address,
        ip_address,
        started_at,
        upload_bytes,
        download_bytes,
        duration_seconds,
        mikrotik_profile,
        mikrotik_limit_uptime_seconds,
        session_time_left_seconds,
        login_method,
        cookie_present,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::inet,
        NOW() - ($7::bigint * INTERVAL '1 second'),
        $8,
        $9,
        $7,
        $10,
        $11,
        $12,
        $13,
        $14,
        'ACTIVE'
      )
      RETURNING id
    `,
    [
      data.siteId,
      data.routerId,
      data.voucherId ?? null,
      data.username,
      data.macAddress,
      data.ipAddress,
      data.uptimeSeconds,
      data.uploadBytes,
      data.downloadBytes,
      data.mikrotikProfile,
      data.mikrotikLimitUptimeSeconds ?? null,
      data.sessionTimeLeftSeconds,
      data.loginMethod,
      data.cookiePresent,
    ]
  );

  const sessionId = inserted.rows[0]?.id;
  if (!sessionId) {
    throw new Error("La session active n'a pas pu être créée.");
  }

  return { created: true, sessionId };
}

/* ============================================================
   VOUCHER
============================================================ */

export async function findVoucherIdByCode(
  siteId: string,
  code: string
): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM voucher
      WHERE site_id = $1
        AND code = $2
      LIMIT 1
    `,
    [siteId, code]
  );

  return result.rows[0]?.id ?? null;
}

export async function activateVoucher(
  voucherId: string
): Promise<void> {
  await pool.query(
    `
      UPDATE voucher
      SET
        status = CASE
          WHEN status = 'UNUSED' THEN 'ACTIVE'
          ELSE status
        END,
        activated_at = COALESCE(activated_at, NOW()),
        used_at = COALESCE(used_at, NOW()),
        updated_at = NOW()
      WHERE id = $1
        AND status NOT IN ('DISABLED', 'REVOKED', 'EXPIRED')
    `,
    [voucherId]
  );
}

export async function syncVoucherUsage(
  voucherId: string
): Promise<void> {
  await pool.query(
    `
      UPDATE voucher v
      SET
        status = CASE
          WHEN v.status IN ('DISABLED', 'REVOKED') THEN v.status
          WHEN v.duration_seconds IS NOT NULL
            AND (
              SELECT COALESCE(SUM(COALESCE(s.duration_seconds, 0)), 0)
              FROM session s
              WHERE s.voucher_id = v.id
            ) >= v.duration_seconds
            THEN 'EXPIRED'
          WHEN v.status = 'UNUSED' THEN 'ACTIVE'
          ELSE v.status
        END,
        updated_at = NOW()
      WHERE v.id = $1
    `,
    [voucherId]
  );
}

export async function findVoucherIdsByRouter(
  routerId: string
): Promise<string[]> {
  const result = await pool.query<{ voucherId: string }>(
    `
      SELECT DISTINCT voucher_id AS "voucherId"
      FROM session
      WHERE router_id = $1
        AND voucher_id IS NOT NULL
    `,
    [routerId]
  );

  return result.rows.map((row) => row.voucherId);
}

/* ============================================================
   CLOSE SESSIONS NOT IN LIST
   Toute session ACTIVE en base pour ce routeur qui n'apparaît
   plus dans /ip/hotspot/active/print est considérée terminée.
============================================================ */

export interface HotspotLogoutEventForSession {
  username: string;
  ipAddress: string;
  endedAt: string;
  reason: string | null;
}

export async function closeSessionsNotIn(
  routerId: string,
  stillActiveMacAddresses: string[],
  logoutEvents: HotspotLogoutEventForSession[] = []
): Promise<number> {
  const logoutEventsJson = JSON.stringify(
    logoutEvents
      .filter(
        (event) =>
          event.username.trim().length > 0 &&
          event.ipAddress.trim().length > 0 &&
          event.endedAt.trim().length > 0
      )
      .map((event) => ({
        username: event.username.trim(),
        ipAddress: event.ipAddress.trim(),
        endedAt: event.endedAt,
        reason: event.reason?.trim() || null,
      }))
  );

  let closedCount = 0;

  if (logoutEvents.length > 0) {
    const loggedOut = await pool.query(
      `
        WITH logout_events AS (
          SELECT
            username,
            ip_address,
            ended_at,
            reason
          FROM jsonb_to_recordset($3::jsonb) AS events(
            username text,
            ip_address text,
            ended_at timestamptz,
            reason text
          )
        ),
        matched AS (
          SELECT DISTINCT ON (s.id)
            s.id AS session_id,
            logout_events.ended_at,
            logout_events.reason
          FROM session s
          JOIN logout_events
            ON logout_events.username = s.username
            AND logout_events.ip_address = s.ip_address::text
            AND logout_events.ended_at >= s.started_at
            AND logout_events.ended_at <= NOW()
          WHERE s.router_id = $1
            AND s.status = 'ACTIVE'
            AND s.ended_at IS NULL
            AND (
              s.mac_address IS NULL
              OR NOT (s.mac_address = ANY($2::text[]))
            )
          ORDER BY s.id, logout_events.ended_at
        )
        UPDATE session s
        SET
          status = CASE
          WHEN COALESCE(
                (
                  SELECT v.duration_seconds
                  FROM voucher v
                  WHERE v.id = s.voucher_id
                ),
                s.mikrotik_limit_uptime_seconds
              ) IS NOT NULL
            AND GREATEST(
              COALESCE(
                (
                  SELECT v.duration_seconds
                  FROM voucher v
                  WHERE v.id = s.voucher_id
                ),
                s.mikrotik_limit_uptime_seconds
              ) - (
                SELECT COALESCE(
                  SUM(
                    CASE
                      WHEN s2.id = s.id
                        AND s.status = 'ACTIVE'
                        THEN COALESCE(s2.duration_seconds, 0)
                      WHEN s2.id = s.id
                        THEN COALESCE(s2.duration_seconds, 0)
                      ELSE COALESCE(s2.duration_seconds, 0)
                    END
                  ),
                  0
                )
                FROM session s2
                WHERE (
                  (
                    s.voucher_id IS NOT NULL
                    AND s2.voucher_id = s.voucher_id
                  )
                  OR (
                    s.voucher_id IS NULL
                    AND s2.voucher_id IS NULL
                    AND s2.site_id = s.site_id
                    AND s2.router_id = s.router_id
                    AND s2.username = s.username
                  )
                )
              ),
              0
            ) > 0
            THEN 'TERMINATED'
          ELSE 'COMPLETED'
        END,
          ended_at = matched.ended_at,
          duration_seconds = COALESCE(s.duration_seconds, 0),
          voucher_remaining_seconds_at_end =
            CASE
              WHEN COALESCE(
              (
                SELECT v.duration_seconds
                FROM voucher v
                WHERE v.id = s.voucher_id
              ),
              s.mikrotik_limit_uptime_seconds
            ) IS NULL THEN NULL
              ELSE GREATEST(
                COALESCE(
              (
                SELECT v.duration_seconds
                FROM voucher v
                WHERE v.id = s.voucher_id
              ),
              s.mikrotik_limit_uptime_seconds
            ) - (
                  SELECT COALESCE(
                    SUM(
                      CASE
                        WHEN s2.id = s.id
                          THEN COALESCE(s.duration_seconds, 0)
                        ELSE COALESCE(s2.duration_seconds, 0)
                      END
                    ),
                    0
                  )
                  FROM session s2
                  WHERE (
                  (
                    s.voucher_id IS NOT NULL
                    AND s2.voucher_id = s.voucher_id
                  )
                  OR (
                    s.voucher_id IS NULL
                    AND s2.voucher_id IS NULL
                    AND s2.site_id = s.site_id
                    AND s2.router_id = s.router_id
                    AND s2.username = s.username
                  )
                )
                ),
                0
              )::bigint
            END,
          termination_reason = COALESCE(
            NULLIF(matched.reason, ''),
            'DISCONNECTED'
          ),
          updated_at = NOW()
        FROM matched
        WHERE s.id = matched.session_id
      `,
      [routerId, stillActiveMacAddresses, logoutEventsJson]
    );

    closedCount += loggedOut.rowCount ?? 0;
  }

  const fallback = await pool.query(
    `
      UPDATE session s
      SET
        status = CASE
          WHEN COALESCE(
                (
                  SELECT v.duration_seconds
                  FROM voucher v
                  WHERE v.id = s.voucher_id
                ),
                s.mikrotik_limit_uptime_seconds
              ) IS NOT NULL
            AND GREATEST(
              COALESCE(
                (
                  SELECT v.duration_seconds
                  FROM voucher v
                  WHERE v.id = s.voucher_id
                ),
                s.mikrotik_limit_uptime_seconds
              ) - (
                SELECT COALESCE(
                  SUM(
                    CASE
                      WHEN s2.id = s.id
                        AND s.status = 'ACTIVE'
                        THEN COALESCE(s.duration_seconds, 0)
                      WHEN s2.id = s.id
                        THEN COALESCE(s2.duration_seconds, 0)
                      ELSE COALESCE(s2.duration_seconds, 0)
                    END
                  ),
                  0
                )
                FROM session s2
                WHERE (
                  (
                    s.voucher_id IS NOT NULL
                    AND s2.voucher_id = s.voucher_id
                  )
                  OR (
                    s.voucher_id IS NULL
                    AND s2.voucher_id IS NULL
                    AND s2.site_id = s.site_id
                    AND s2.router_id = s.router_id
                    AND s2.username = s.username
                  )
                )
              ),
              0
            ) > 0
            THEN 'TERMINATED'
          ELSE 'COMPLETED'
        END,
        ended_at = NOW(),
        duration_seconds = GREATEST(
          COALESCE(s.duration_seconds, 0),
          0
        ),
        voucher_remaining_seconds_at_end =
          CASE
            WHEN COALESCE(
              (
                SELECT v.duration_seconds
                FROM voucher v
                WHERE v.id = s.voucher_id
              ),
              s.mikrotik_limit_uptime_seconds
            ) IS NULL THEN NULL
            ELSE GREATEST(
              COALESCE(
              (
                SELECT v.duration_seconds
                FROM voucher v
                WHERE v.id = s.voucher_id
              ),
              s.mikrotik_limit_uptime_seconds
            ) - (
                SELECT COALESCE(
                  SUM(
                    CASE
                      WHEN s2.id = s.id
                        THEN COALESCE(s.duration_seconds, 0)
                      ELSE COALESCE(s2.duration_seconds, 0)
                    END
                  ),
                  0
                )
                FROM session s2
                WHERE (
                  (
                    s.voucher_id IS NOT NULL
                    AND s2.voucher_id = s.voucher_id
                  )
                  OR (
                    s.voucher_id IS NULL
                    AND s2.voucher_id IS NULL
                    AND s2.site_id = s.site_id
                    AND s2.router_id = s.router_id
                    AND s2.username = s.username
                  )
                )
              ),
              0
            )::bigint
          END,
        termination_reason = 'DISCONNECTED',
        updated_at = NOW()
      WHERE s.router_id = $1
        AND s.status = 'ACTIVE'
        AND s.ended_at IS NULL
        AND (
          s.mac_address IS NULL
          OR NOT (s.mac_address = ANY($2::text[]))
        )
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_to_recordset($3::jsonb) AS events(
            username text,
            ip_address text,
            ended_at timestamptz,
            reason text
          )
          WHERE events.username = s.username
            AND events.ip_address = s.ip_address::text
            AND events.ended_at >= s.started_at
            AND events.ended_at <= NOW()
        )
    `,
    [routerId, stillActiveMacAddresses, logoutEventsJson]
  );

  closedCount += fallback.rowCount ?? 0;

  return closedCount;
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
      UPDATE session s
      SET
        status = 'TERMINATED',
        ended_at = NOW(),
        duration_seconds = GREATEST(
          COALESCE(s.duration_seconds, 0),
          0
        ),
        voucher_remaining_seconds_at_end =
          CASE
            WHEN COALESCE(
              (
                SELECT v.duration_seconds
                FROM voucher v
                WHERE v.id = s.voucher_id
              ),
              s.mikrotik_limit_uptime_seconds
            ) IS NULL THEN NULL
            ELSE GREATEST(
              COALESCE(
              (
                SELECT v.duration_seconds
                FROM voucher v
                WHERE v.id = s.voucher_id
              ),
              s.mikrotik_limit_uptime_seconds
            ) - (
                SELECT COALESCE(
                  SUM(
                    CASE
                      WHEN s2.id = s.id
                        THEN COALESCE(s.duration_seconds, 0)
                      ELSE COALESCE(s2.duration_seconds, 0)
                    END
                  ),
                  0
                )
                FROM session s2
                WHERE (
                  (
                    s.voucher_id IS NOT NULL
                    AND s2.voucher_id = s.voucher_id
                  )
                  OR (
                    s.voucher_id IS NULL
                    AND s2.voucher_id IS NULL
                    AND s2.site_id = s.site_id
                    AND s2.router_id = s.router_id
                    AND s2.username = s.username
                  )
                )
              ),
              0
            )::bigint
          END,
        termination_reason = $2,
        updated_at = NOW()
      WHERE s.router_id = $1
        AND s.status = 'ACTIVE'
        AND s.ended_at IS NULL
    `,
    [routerId, reason]
  );

  return result.rowCount ?? 0;
}
