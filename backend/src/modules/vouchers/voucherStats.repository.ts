import { pool } from "../../database/pool.js";

export interface MikrotikVoucherStatsHistory {
  expiredSessionCount: number;
  expiredUsernames: Set<string>;
}

/**
 * Un voucher est expire uniquement si sa derniere session connue
 * a reellement epuise son quota.
 *
 * Une ancienne session COMPLETED ne doit pas rendre le voucher
 * definitivement expire si l utilisateur s est reconnecte ensuite
 * avec du quota restant : le voucher reste UTILISE.
 */
export async function findVoucherUsageHistory(
  siteId: string,
  routerId: string
): Promise<MikrotikVoucherStatsHistory> {
  const expiredResult = await pool.query<{ count: number }>(
    `
      WITH latest_sessions AS (
        SELECT DISTINCT ON (LOWER(TRIM(s.username)))
          LOWER(TRIM(s.username)) AS username,
          s.status,
          s.voucher_remaining_seconds_at_end,
          s.started_at,
          s.id
        FROM session s
        WHERE s.site_id = $1
          AND s.router_id = $2
          AND s.username IS NOT NULL
          AND TRIM(s.username) <> ''
        ORDER BY
          LOWER(TRIM(s.username)),
          s.started_at DESC,
          s.id DESC
      )
      SELECT COUNT(*)::int AS count
      FROM latest_sessions
      WHERE status = 'COMPLETED'
         OR (
           status = 'TERMINATED'
           AND voucher_remaining_seconds_at_end = 0
         )
    `,
    [siteId, routerId]
  );

  const expiredUsersResult = await pool.query<{ username: string }>(
    `
      WITH latest_sessions AS (
        SELECT DISTINCT ON (LOWER(TRIM(s.username)))
          LOWER(TRIM(s.username)) AS username,
          s.status,
          s.voucher_remaining_seconds_at_end,
          s.started_at,
          s.id
        FROM session s
        WHERE s.site_id = $1
          AND s.router_id = $2
          AND s.username IS NOT NULL
          AND TRIM(s.username) <> ''
        ORDER BY
          LOWER(TRIM(s.username)),
          s.started_at DESC,
          s.id DESC
      )
      SELECT username
      FROM latest_sessions
      WHERE status = 'COMPLETED'
         OR (
           status = 'TERMINATED'
           AND voucher_remaining_seconds_at_end = 0
         )
    `,
    [siteId, routerId]
  );

  return {
    expiredSessionCount:
      Number(expiredResult.rows[0]?.count ?? 0),
    expiredUsernames: new Set(
      expiredUsersResult.rows.map((row) => row.username)
    ),
  };
}
