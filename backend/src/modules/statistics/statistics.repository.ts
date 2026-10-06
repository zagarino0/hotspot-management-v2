import { pool } from "../../database/pool.js";
import { checkDatabase } from "../../database/health.js";

import type {
  DashboardOverview,
  TrendValue,
} from "../../routes/statistics.types.js";

function toTrend(current: number, previous: number): TrendValue {
  return {
    current,
    previous,
    changePercent:
      previous === 0
        ? current === 0
          ? 0
          : null
        : ((current - previous) / previous) * 100,
  };
}

async function countBetween(
  table: "client" | "session" | "voucher",
  dateColumn: "created_at" | "started_at",
  from: Date,
  to: Date
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM ${table} WHERE ${dateColumn} >= $1 AND ${dateColumn} < $2`,
    [from, to]
  );

  return Number(result.rows[0].count);
}

async function revenueBetween(from: Date, to: Date): Promise<number> {
  const result = await pool.query<{ total: string | null }>(
    `SELECT SUM(amount)::float8 AS total
     FROM payment
     WHERE status = 'SUCCESS' AND paid_at >= $1 AND paid_at < $2`,
    [from, to]
  );

  return Number(result.rows[0].total ?? 0);
}

async function paidSalesBetween(from: Date, to: Date): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(DISTINCT sale_id) AS count
     FROM payment
     WHERE status = 'SUCCESS' AND paid_at >= $1 AND paid_at < $2`,
    [from, to]
  );

  return Number(result.rows[0].count);
}

export async function getDashboardOverview(
  days: 7 | 30 | 90
): Promise<DashboardOverview> {
  const now = new Date();
  const trendStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousTrendStart = new Date(
    trendStart.getTime() - days * 24 * 60 * 60 * 1000
  );

  const [
    database,
    countsResult,
    clientsCurrent,
    clientsPrevious,
    sessionsCurrent,
    sessionsPrevious,
    salesCurrent,
    salesPrevious,
    revenueCurrent,
    revenuePrevious,
    vouchersCurrent,
    vouchersPrevious,
    recentSalesResult,
    networkResult,
    sessionsSeriesResult,
  ] = await Promise.all([
    checkDatabase(),
    pool.query<{
      clients: string;
      activeSessions: string;
      sites: string;
      routers: string;
      routersOnline: string;
      accessPoints: string;
      accessPointsOnline: string;
      vouchersAvailable: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM client) AS clients,
        (SELECT COUNT(*) FROM session WHERE status = 'ACTIVE' AND ended_at IS NULL) AS "activeSessions",
        (SELECT COUNT(*) FROM site) AS sites,
        (SELECT COUNT(*) FROM router) AS routers,
        (SELECT COUNT(*) FROM router WHERE status = 'ONLINE') AS "routersOnline",
        (SELECT COUNT(*) FROM access_point) AS "accessPoints",
        (SELECT COUNT(*) FROM access_point WHERE status = 'ONLINE') AS "accessPointsOnline",
        (SELECT COUNT(*) FROM voucher WHERE status = 'UNUSED') AS "vouchersAvailable"
    `),
    countBetween("client", "created_at", trendStart, now),
    countBetween("client", "created_at", previousTrendStart, trendStart),
    countBetween("session", "started_at", trendStart, now),
    countBetween("session", "started_at", previousTrendStart, trendStart),
    paidSalesBetween(trendStart, now),
    paidSalesBetween(previousTrendStart, trendStart),
    revenueBetween(trendStart, now),
    revenueBetween(previousTrendStart, trendStart),
    countBetween("voucher", "created_at", trendStart, now),
    countBetween("voucher", "created_at", previousTrendStart, trendStart),
    pool.query<DashboardOverview["recentSales"][number]>(`
      SELECT
        sa.id,
        p.name AS "planName",
        (
          SELECT pay.method
          FROM payment pay
          WHERE pay.sale_id = sa.id AND pay.status = 'SUCCESS'
          ORDER BY pay.paid_at DESC
          LIMIT 1
        ) AS method,
        sa.total_amount::float8 AS amount,
        sa.currency,
        sa.status,
        sa.sold_at AS "soldAt"
      FROM sale sa
      JOIN plan p ON p.id = sa.plan_id
      ORDER BY sa.sold_at DESC
      LIMIT 5
    `),
    pool.query<DashboardOverview["networkStatus"][number]>(`
      SELECT id, name, type, status
      FROM (
        SELECT id, name, 'ROUTER'::text AS type, status FROM router
        UNION ALL
        SELECT id, name, 'ACCESS_POINT'::text AS type, status FROM access_point
      ) equipment
      ORDER BY (status = 'OFFLINE') DESC, name ASC
      LIMIT 8
    `),
    pool.query<{ bucket: Date; value: string }>(`
      SELECT d AS bucket, (
        SELECT COUNT(*)
        FROM session s
        WHERE s.started_at::date = d::date
      ) AS value
      FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, '1 day'::interval) d
      ORDER BY d
    `, [days]),
  ]);

  const counts = countsResult.rows[0];

  return {
    counts: {
      clients: Number(counts.clients),
      activeSessions: Number(counts.activeSessions),
      sites: Number(counts.sites),
      routers: Number(counts.routers),
      routersOnline: Number(counts.routersOnline),
      accessPoints: Number(counts.accessPoints),
      accessPointsOnline: Number(counts.accessPointsOnline),
      vouchersAvailable: Number(counts.vouchersAvailable),
    },
    trends: {
      clients: toTrend(clientsCurrent, clientsPrevious),
      sessions: toTrend(sessionsCurrent, sessionsPrevious),
      sales: toTrend(salesCurrent, salesPrevious),
      revenue: toTrend(revenueCurrent, revenuePrevious),
      vouchers: toTrend(vouchersCurrent, vouchersPrevious),
    },
    recentSales: recentSalesResult.rows,
    networkStatus: networkResult.rows,
    sessionsSeries: sessionsSeriesResult.rows.map((row) => ({
      label: new Date(row.bucket).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      }),
      value: Number(row.value),
    })),
    dbHealthy: database.connected,
  };
}
