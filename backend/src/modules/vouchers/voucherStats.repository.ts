import { pool } from "../../database/pool.js";

export interface MikrotikVoucherStatsHistory {
  expiredSessionCount: number;
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

  return {
    expiredSessionCount:
      Number(expiredResult.rows[0]?.count ?? 0),
  };
}
