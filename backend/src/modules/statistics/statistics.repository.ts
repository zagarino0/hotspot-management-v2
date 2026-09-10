import { pool } from "../../database/pool.js";
import { checkDatabase } from "../../database/health.js";
import {
  computeChangePercent,
  getPeriodRange,
  type PeriodRange,
} from "../../lib/period.js";

import type {
  DashboardCounts,
  DashboardOverview,
  DashboardTrends,
  NetworkActivity,
  NetworkStatusRow,
  PaymentMethodShare,
  PlanSalesShare,
  RecentSaleRow,
  RevenueSeriesPoint,
  StatKpi,
  StatsPeriod,
  TrendValue,
} from "../../routes/statistics.types.js";

/* ============================================================
   DASHBOARD — COUNTS
============================================================ */

async function getDashboardCounts(): Promise<DashboardCounts> {
  const result = await pool.query<{
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
  `);

  const row = result.rows[0];

  return {
    clients: Number(row.clients),
    activeSessions: Number(row.activeSessions),
    sites: Number(row.sites),
    routers: Number(row.routers),
    routersOnline: Number(row.routersOnline),
    accessPoints: Number(row.accessPoints),
    accessPointsOnline: Number(row.accessPointsOnline),
    vouchersAvailable: Number(row.vouchersAvailable),
  };
}

/* ============================================================
   DASHBOARD — TRENDS (30 derniers jours vs 30 précédents)
============================================================ */

async function getDashboardTrends(): Promise<DashboardTrends> {
  const now = new Date();
  const start = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000
  );
  const previousStart = new Date(
    start.getTime() - 30 * 24 * 60 * 60 * 1000
  );

  async function countBetween(
    table: string,
    dateColumn: string,
    from: Date,
    to: Date
  ): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*) AS count
        FROM ${table}
        WHERE ${dateColumn} >= $1
          AND ${dateColumn} < $2
      `,
      [from, to]
    );

    return Number(result.rows[0].count);
  }

  async function sumRevenueBetween(
    from: Date,
    to: Date
  ): Promise<number> {
    const result = await pool.query<{ total: string | null }>(
      `
        SELECT SUM(amount)::float8 AS total
        FROM payment
        WHERE status = 'SUCCESS'
          AND paid_at >= $1
          AND paid_at < $2
      `,
      [from, to]
    );

    return Number(result.rows[0].total ?? 0);
  }

  function toTrend(current: number, previous: number): TrendValue {
    return {
      current,
      previous,
      changePercent: computeChangePercent(current, previous),
    };
  }

  const [
    clientsCurrent,
    clientsPrevious,
    sessionsCurrent,
    sessionsPrevious,
    revenueCurrent,
    revenuePrevious,
    vouchersCurrent,
    vouchersPrevious,
  ] = await Promise.all([
    countBetween("client", "created_at", start, now),
    countBetween(
      "client",
      "created_at",
      previousStart,
      start
    ),
    countBetween("session", "started_at", start, now),
    countBetween(
      "session",
      "started_at",
      previousStart,
      start
    ),
    sumRevenueBetween(start, now),
    sumRevenueBetween(previousStart, start),
    countBetween("voucher", "created_at", start, now),
    countBetween(
      "voucher",
      "created_at",
      previousStart,
      start
    ),
  ]);

  return {
    clients: toTrend(clientsCurrent, clientsPrevious),
    sessions: toTrend(sessionsCurrent, sessionsPrevious),
    revenue: toTrend(revenueCurrent, revenuePrevious),
    vouchers: toTrend(vouchersCurrent, vouchersPrevious),
  };
}

/* ============================================================
   DASHBOARD — RECENT SALES
============================================================ */

async function getRecentSales(
  limit: number
): Promise<RecentSaleRow[]> {
  const result = await pool.query<RecentSaleRow>(
    `
      SELECT
        s.id,
        p.name AS "planName",
        (
          SELECT pay.method
          FROM payment pay
          WHERE pay.sale_id = s.id
            AND pay.status = 'SUCCESS'
          ORDER BY pay.paid_at DESC
          LIMIT 1
        ) AS method,
        s.total_amount::float8 AS amount,
        s.currency,
        s.status,
        s.sold_at AS "soldAt"
      FROM sale s
      JOIN plan p ON p.id = s.plan_id
      ORDER BY s.sold_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

/* ============================================================
   DASHBOARD — NETWORK STATUS (routeurs + points d'accès)
============================================================ */

async function getNetworkStatus(
  limit: number
): Promise<NetworkStatusRow[]> {
  const result = await pool.query<NetworkStatusRow>(
    `
      (
        SELECT
          id,
          name,
          'ROUTER' AS type,
          status
        FROM router
      )
      UNION ALL
      (
        SELECT
          id,
          name,
          'ACCESS_POINT' AS type,
          status
        FROM access_point
      )
      ORDER BY
        (status = 'OFFLINE') DESC,
        name ASC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

/* ============================================================
   DASHBOARD — SESSIONS SERIES (sélecteur 7/30/90 jours)
============================================================ */

async function getSessionsSeries(
  days: number
): Promise<RevenueSeriesPoint[]> {
  const result = await pool.query<{
    bucket: Date;
    value: string;
  }>(
    `
      SELECT
        d AS bucket,
        (
          SELECT COUNT(*)
          FROM session s
          WHERE s.started_at::date = d::date
        ) AS value
      FROM generate_series(
        (CURRENT_DATE - ($1::int - 1)),
        CURRENT_DATE,
        '1 day'::interval
      ) d
      ORDER BY d
    `,
    [days]
  );

  return result.rows.map((row) => ({
    label: new Date(row.bucket).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    }),
    value: Number(row.value),
  }));
}

/* ============================================================
   DASHBOARD OVERVIEW (assemble tout ce qui précède)
============================================================ */

export async function getDashboardOverview(
  sessionsSeriesDays = 7
): Promise<DashboardOverview> {
  let dbHealthy = true;

  try {
    await checkDatabase();
  } catch {
    dbHealthy = false;
  }

  const [
    counts,
    trends,
    recentSales,
    networkStatus,
    sessionsSeries,
  ] = await Promise.all([
    getDashboardCounts(),
    getDashboardTrends(),
    getRecentSales(5),
    getNetworkStatus(8),
    getSessionsSeries(sessionsSeriesDays),
  ]);

  return {
    counts,
    trends,
    recentSales,
    networkStatus,
    sessionsSeries,
    dbHealthy,
  };
}

/* ============================================================
   STATISTICS — KPI (avec comparaison de période)
============================================================ */

async function sumRevenue(
  from: Date,
  to: Date
): Promise<number> {
  const result = await pool.query<{ total: string | null }>(
    `
      SELECT SUM(amount)::float8 AS total
      FROM payment
      WHERE status = 'SUCCESS'
        AND paid_at >= $1
        AND paid_at < $2
    `,
    [from, to]
  );

  return Number(result.rows[0].total ?? 0);
}

async function countSales(
  from: Date,
  to: Date
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*) AS count
      FROM sale
      WHERE sold_at >= $1
        AND sold_at < $2
    `,
    [from, to]
  );

  return Number(result.rows[0].count);
}

async function countSessions(
  from: Date,
  to: Date
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*) AS count
      FROM session
      WHERE started_at >= $1
        AND started_at < $2
    `,
    [from, to]
  );

  return Number(result.rows[0].count);
}

async function countActiveClients(
  from: Date,
  to: Date
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `
      SELECT COUNT(
        DISTINCT COALESCE(
          client_id::text,
          mac_address,
          username
        )
      ) AS count
      FROM session
      WHERE started_at >= $1
        AND started_at < $2
    `,
    [from, to]
  );

  return Number(result.rows[0].count);
}

export async function getStatKpi(
  range: PeriodRange
): Promise<StatKpi> {
  function toTrend(current: number, previous: number): TrendValue {
    return {
      current,
      previous,
      changePercent: computeChangePercent(current, previous),
    };
  }

  const [
    revenueCurrent,
    revenuePrevious,
    salesCurrent,
    salesPrevious,
    sessionsCurrent,
    sessionsPrevious,
    clientsCurrent,
    clientsPrevious,
  ] = await Promise.all([
    sumRevenue(range.start, range.end),
    sumRevenue(range.previousStart, range.previousEnd),
    countSales(range.start, range.end),
    countSales(range.previousStart, range.previousEnd),
    countSessions(range.start, range.end),
    countSessions(range.previousStart, range.previousEnd),
    countActiveClients(range.start, range.end),
    countActiveClients(
      range.previousStart,
      range.previousEnd
    ),
  ]);

  return {
    revenue: toTrend(revenueCurrent, revenuePrevious),
    salesCount: toTrend(salesCurrent, salesPrevious),
    sessionsCount: toTrend(
      sessionsCurrent,
      sessionsPrevious
    ),
    activeClients: toTrend(clientsCurrent, clientsPrevious),
  };
}

/* ============================================================
   STATISTICS — REVENUE SERIES
   Bucketé par jour (today/week/month) ou par mois (year), avec
   generate_series pour ne jamais avoir de trou (jour à 0 Ar
   affiché, pas absent du graphique).
============================================================ */

export async function getRevenueSeries(
  period: StatsPeriod,
  range: PeriodRange
): Promise<RevenueSeriesPoint[]> {
  if (period === "year") {
    const result = await pool.query<{
      bucket: Date;
      value: string | null;
    }>(
      `
        SELECT
          d AS bucket,
          (
            SELECT SUM(p.amount)
            FROM payment p
            WHERE p.status = 'SUCCESS'
              AND date_trunc('month', p.paid_at) = d
          )::float8 AS value
        FROM generate_series(
          date_trunc('year', $1::timestamptz),
          date_trunc('year', $2::timestamptz) + interval '11 months',
          '1 month'::interval
        ) d
        ORDER BY d
      `,
      [range.start, range.end]
    );

    return result.rows.map((row) => ({
      label: new Date(row.bucket).toLocaleDateString(
        "fr-FR",
        { month: "short" }
      ),
      value: Number(row.value ?? 0),
    }));
  }

  const result = await pool.query<{
    bucket: Date;
    value: string | null;
  }>(
    `
      SELECT
        d AS bucket,
        (
          SELECT SUM(p.amount)
          FROM payment p
          WHERE p.status = 'SUCCESS'
            AND p.paid_at::date = d::date
        )::float8 AS value
      FROM generate_series(
        $1::date,
        $2::date,
        '1 day'::interval
      ) d
      ORDER BY d
    `,
    [range.start, range.end]
  );

  return result.rows.map((row) => ({
    label: new Date(row.bucket).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    }),
    value: Number(row.value ?? 0),
  }));
}

/* ============================================================
   STATISTICS — PAYMENT METHOD BREAKDOWN
============================================================ */

export async function getPaymentMethodBreakdown(
  range: PeriodRange
): Promise<PaymentMethodShare[]> {
  const result = await pool.query<{
    method: string;
    amount: string;
  }>(
    `
      SELECT
        method,
        SUM(amount)::float8 AS amount
      FROM payment
      WHERE status = 'SUCCESS'
        AND paid_at >= $1
        AND paid_at < $2
      GROUP BY method
      ORDER BY amount DESC
    `,
    [range.start, range.end]
  );

  const total = result.rows.reduce(
    (sum, row) => sum + Number(row.amount),
    0
  );

  return result.rows.map((row) => ({
    method: row.method,
    amount: Number(row.amount),
    percentage:
      total > 0 ? (Number(row.amount) / total) * 100 : 0,
  }));
}

/* ============================================================
   STATISTICS — SALES BY PLAN
============================================================ */

export async function getSalesByPlan(
  range: PeriodRange
): Promise<PlanSalesShare[]> {
  const result = await pool.query<{
    planName: string;
    count: string;
  }>(
    `
      SELECT
        p.name AS "planName",
        COUNT(*) AS count
      FROM sale s
      JOIN plan p ON p.id = s.plan_id
      WHERE s.sold_at >= $1
        AND s.sold_at < $2
      GROUP BY p.name
      ORDER BY count DESC
      LIMIT 8
    `,
    [range.start, range.end]
  );

  const total = result.rows.reduce(
    (sum, row) => sum + Number(row.count),
    0
  );

  return result.rows.map((row) => ({
    planName: row.planName,
    count: Number(row.count),
    percentage:
      total > 0 ? (Number(row.count) / total) * 100 : 0,
  }));
}

/* ============================================================
   STATISTICS — NETWORK ACTIVITY
   Le "pic simultané" est calculé par une méthode de balayage
   (sweep line) : chaque session chevauchant la période génère
   un événement +1 à son début effectif et -1 à sa fin effective
   (bornés à la période), puis on prend le maximum de la somme
   cumulée triée par temps.
============================================================ */

export async function getNetworkActivity(
  range: PeriodRange
): Promise<NetworkActivity> {
  const [sessionsResult, peakResult, durationResult, clientsResult] =
    await Promise.all([
      pool.query<{ count: string }>(
        `
          SELECT COUNT(*) AS count
          FROM session
          WHERE started_at >= $1
            AND started_at < $2
        `,
        [range.start, range.end]
      ),

      pool.query<{ peak: string }>(
        `
          WITH overlapping AS (
            SELECT
              GREATEST(started_at, $1::timestamptz) AS eff_start,
              LEAST(
                COALESCE(ended_at, NOW()),
                $2::timestamptz
              ) AS eff_end
            FROM session
            WHERE started_at < $2::timestamptz
              AND COALESCE(ended_at, NOW()) > $1::timestamptz
          ),
          events AS (
            SELECT eff_start AS ts, 1 AS delta
            FROM overlapping
            WHERE eff_start < eff_end
            UNION ALL
            SELECT eff_end AS ts, -1 AS delta
            FROM overlapping
            WHERE eff_start < eff_end
          )
          SELECT COALESCE(MAX(running), 0)::int AS peak
          FROM (
            SELECT
              SUM(delta) OVER (
                ORDER BY ts, delta DESC
              ) AS running
            FROM events
          ) sub
        `,
        [range.start, range.end]
      ),

      pool.query<{ avg: string | null }>(
        `
          SELECT
            AVG(
              COALESCE(
                duration_seconds,
                EXTRACT(EPOCH FROM (NOW() - started_at))
              )
            )::float8 AS avg
          FROM session
          WHERE started_at >= $1
            AND started_at < $2
        `,
        [range.start, range.end]
      ),

      pool.query<{ count: string }>(
        `
          SELECT COUNT(
            DISTINCT COALESCE(
              client_id::text,
              mac_address,
              username
            )
          ) AS count
          FROM session
          WHERE started_at >= $1
            AND started_at < $2
        `,
        [range.start, range.end]
      ),
    ]);

  return {
    sessionsInPeriod: Number(sessionsResult.rows[0].count),
    peakConcurrent: Number(peakResult.rows[0].peak),
    averageDurationSeconds: Number(
      durationResult.rows[0].avg ?? 0
    ),
    activeClients: Number(clientsResult.rows[0].count),
  };
}

export { getPeriodRange };
