import { pool } from "../../database/pool.js";

export interface MikrotikVoucherStatsHistory {
  expiredSessionCount: number;
  expiredUsernames: Set<string>;
}

export async function findVoucherUsageHistory(
  siteId: string,
  routerId: string
): Promise<MikrotikVoucherStatsHistory> {
  const expiredResult = await pool.query<{ count: number }>(
    `
      SELECT COUNT(*)::int AS count
      FROM session
      WHERE site_id = $1
        AND router_id = $2
        AND (
          status = 'COMPLETED'
          OR (
            status = 'TERMINATED'
            AND voucher_remaining_seconds_at_end = 0
          )
        )
    `,
    [siteId, routerId]
  );

  const expiredUsersResult = await pool.query<{ username: string }>(
    `
      SELECT DISTINCT LOWER(TRIM(username)) AS username
      FROM session
      WHERE site_id = $1
        AND router_id = $2
        AND (
          status = 'COMPLETED'
          OR (
            status = 'TERMINATED'
            AND voucher_remaining_seconds_at_end = 0
          )
        )
        AND username IS NOT NULL
        AND TRIM(username) <> ''
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
