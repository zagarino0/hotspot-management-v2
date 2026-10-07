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

async function getEngagedVoucherStatsBetween(
  from: Date,
  to: Date,
  engagedVouchers: Array<{
    code: string;
    profile: string | null;
    siteId: string;
    routerId: string;
    status: "UNUSED" | "ACTIVE" | "EXPIRED";
  }>
): Promise<{ revenue: number; count: number }> {
  const firstConnections = await pool.query<{
    siteId: string;
    routerId: string;
    username: string;
    startedAt: Date;
  }>(
    `
      SELECT DISTINCT ON (s.site_id, s.router_id, s.username)
        s.site_id AS "siteId",
        s.router_id AS "routerId",
        s.username,
        s.started_at AS "startedAt"
      FROM session s
      WHERE s.started_at >= $1
        AND s.started_at < $2
      ORDER BY
        s.site_id,
        s.router_id,
        s.username,
        s.started_at ASC,
        s.id ASC
    `,
    [from, to]
  );

  const firstConnectionKeys = new Set(
    firstConnections.rows.map(
      (row) =>
        `${row.siteId}|${row.routerId}|${row.username.trim().toLowerCase()}`
    )
  );

  const normalizeProfile = (profile: string | null) =>
    (profile ?? "").trim().toLowerCase();

  const eligible = engagedVouchers.filter((voucher) =>
    firstConnectionKeys.has(
      `${voucher.siteId}|${voucher.routerId}|${voucher.code.trim().toLowerCase()}`
    )
  );

  if (eligible.length === 0) {
    return { revenue: 0, count: 0 };
  }

  const pricesResult = await pool.query<{
    siteId: string;
    profileCode: string;
    price: number;
  }>(
    `
      SELECT
        s.id AS "siteId",
        p.code AS "profileCode",
        COALESCE(sp.price, p.default_price)::float8 AS price
      FROM site s
      JOIN hotspot_profile p
        ON p.status = 'ACTIVE'
      LEFT JOIN site_hotspot_profile_price sp
        ON sp.site_id = s.id
       AND sp.profile_code = p.code
    `
  );

  const prices = new Map(
    pricesResult.rows.map((row) => [
      `${row.siteId}|${normalizeProfile(row.profileCode)}`,
      Number(row.price),
    ])
  );

  const revenue = eligible.reduce((sum, voucher) => {
    const price =
      prices.get(
        `${voucher.siteId}|${normalizeProfile(voucher.profile)}`
      ) ?? 0;

    return sum + price;
  }, 0);

  return {
    revenue,
    count: eligible.length,
  };
}

async function getEngagedVoucherStats(
  from: Date,
  to: Date,
  engagedVouchers: Array<{
    code: string;
    profile: string | null;
    siteId: string;
    routerId: string;
    status: "UNUSED" | "ACTIVE" | "EXPIRED";
  }>
): Promise<{ revenue: number; count: number }> {
  return getEngagedVoucherStatsBetween(
    from,
    to,
    engagedVouchers
  );
}

export async function getDashboardOverview(
  days: 7 | 30 | 90
): Promise<DashboardOverview> {
  const now = new Date();
  const trendStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousTrendStart = new Date(
    trendStart.getTime() - days * 24 * 60 * 60 * 1000
  );

  const { getMikrotikVouchers } = await import(
    "../vouchers/voucher.service.js"
  );

  const mikrotikVouchers = await getMikrotikVouchers();
  const engagedVouchers = mikrotikVouchers.filter(
    (voucher) =>
      voucher.status === "ACTIVE" ||
      voucher.status === "EXPIRED"
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
    getEngagedVoucherStats(trendStart, now, engagedVouchers),
    getEngagedVoucherStats(previousTrendStart, trendStart, engagedVouchers),
    countBetween("voucher", "created_at", trendStart, now),
    countBetween("voucher", "created_at", previousTrendStart, trendStart),
    pool.query<DashboardOverview["recentSales"][number]>(`
      SELECT
        sa.id,
        COALESCE(
          p.name,
          sa.profile_name,
          sa.profile_code,
          'Forfait'
        ) AS "planName",
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
      LEFT JOIN plan p ON p.id = sa.plan_id
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

  const [salesCurrentStats, salesPreviousStats] = [
    salesCurrent,
    salesPrevious,
  ];

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
      sales: toTrend(
        salesCurrentStats.count,
        salesPreviousStats.count
      ),
      revenue: toTrend(
        salesCurrentStats.revenue,
        salesPreviousStats.revenue
      ),
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
