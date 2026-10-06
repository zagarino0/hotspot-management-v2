import { pool } from "../../database/pool.js";

export interface MikrotikVoucherStatsHistory {
  usedUsernames: Set<string>;
  expiredSessionCount: number;
}

export async function findVoucherUsageHistory(
  siteId: string,
  routerId: string
): Promise<MikrotikVoucherStatsHistory> {
  const usedResult = await pool.query<{ username: string }>(
    `
      SELECT DISTINCT LOWER(TRIM(username)) AS username
      FROM session
      WHERE site_id = $1
        AND router_id = $2
        AND username IS NOT NULL
        AND TRIM(username) <> ''
    `,
    [siteId, routerId]
  );

  const expiredResult = await pool.query<{ count: number }>(
    `
      SELECT COUNT(*)::int AS count
      FROM session
      WHERE site_id = $1
        AND router_id = $2
        AND status IN ('COMPLETED', 'TERMINATED')
    `,
    [siteId, routerId]
  );

  return {
    usedUsernames: new Set(
      usedResult.rows.map((row) => row.username)
    ),
    expiredSessionCount:
      Number(expiredResult.rows[0]?.count ?? 0),
  };
}
