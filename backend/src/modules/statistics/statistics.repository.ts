import { pool } from "../../database/pool.js";
import { checkDatabase } from "../../database/health.js";
import {
  findRouterCredential,
  findRoutersForSync,
} from "../routers/router.repository.js";
import { connectMikroTik } from "../../mikrotik/connection.js";
import { fetchHotspotUsers } from "../../mikrotik/hotspotUsers.js";
import { decryptSecret } from "../../lib/crypto.js";

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

async function getSingleMikrotikSnapshot() {
  const routers = await findRoutersForSync();

  if (routers.length !== 1) {
    throw new Error(
      routers.length === 0
        ? "Aucun MikroTik synchronisé n'est configuré pour le tableau de bord."
        : "Le tableau de bord attend un seul MikroTik comme source de vérité."
    );
  }

  const router = routers[0];
  const credential = await findRouterCredential(router.id);

  if (!credential) {
    throw new Error(
      `Aucun identifiant MikroTik enregistré pour le routeur "${router.name}".`
    );
  }

  const api = await connectMikroTik({
    host: router.managementIp.split("/")[0].trim(),
    port: router.apiPort,
    user: credential.username,
    password: decryptSecret(credential.encryptedSecret),
  });

  try {
    const [users, activeRows] = await Promise.all([
      fetchHotspotUsers(api),
      api.write("/ip/hotspot/active/print"),
    ]);

    return {
      router,
      users,
      activeSessions: activeRows.length,
    };
  } finally {
    await api.close();
  }
}

async function countMikrotikClientsBetween(
  from: Date,
  to: Date
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*) AS count
      FROM (
        SELECT DISTINCT s.router_id, LOWER(TRIM(s.username)) AS username
        FROM session s
        WHERE s.username IS NOT NULL
          AND TRIM(s.username) <> ''
          AND s.started_at >= $1
          AND s.started_at < $2
          AND NOT EXISTS (
            SELECT 1
            FROM session previous
            WHERE previous.router_id = s.router_id
              AND LOWER(TRIM(previous.username)) =
                  LOWER(TRIM(s.username))
              AND previous.started_at < s.started_at
          )
      ) clients
    `,
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

  const mikrotik = await getSingleMikrotikSnapshot();

  const engagedVouchers = mikrotik.users
    .map((user) => {
      const quotaExhausted =
        user.limitUptimeSeconds !== null &&
        user.limitUptimeSeconds > 0 &&
        user.uptimeSeconds === user.limitUptimeSeconds;
      const hasMac = Boolean(user.macAddress?.trim());
      const withinQuota =
        user.limitUptimeSeconds === null ||
        user.uptimeSeconds <= user.limitUptimeSeconds;

      const status = quotaExhausted
        ? "EXPIRED"
        : hasMac && withinQuota
          ? "ACTIVE"
          : "UNUSED";

      return {
        code: user.username,
        profile: user.profile,
        siteId: mikrotik.router.siteId,
        routerId: mikrotik.router.id,
        status: status as "UNUSED" | "ACTIVE" | "EXPIRED",
      };
    })
    .filter(
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
    vouchersCurrent,
    vouchersPrevious,
    recentSalesResult,
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
        $1::int AS clients,
        $2::int AS "activeSessions",
        1::int AS sites,
        1::int AS routers,
        1::int AS "routersOnline",
        0::int AS "accessPoints",
        0::int AS "accessPointsOnline",
        $3::int AS "vouchersAvailable"
    `, [
      mikrotik.users.length,
      mikrotik.activeSessions,
      mikrotik.users.filter((user) => {
        const quotaExhausted =
          user.limitUptimeSeconds !== null &&
          user.limitUptimeSeconds > 0 &&
          user.uptimeSeconds === user.limitUptimeSeconds;
        return (
          !quotaExhausted &&
          !user.macAddress?.trim() &&
          user.uptimeSeconds === 0
        );
      }).length,
    ]),
    countMikrotikClientsBetween(trendStart, now),
    countMikrotikClientsBetween(previousTrendStart, trendStart),
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
    pool.query<{ bucket: Date; value: string }>(`
      SELECT d AS bucket, (
        SELECT COUNT(*)
        FROM session s
        WHERE s.started_at >= d
          AND s.started_at < d + INTERVAL '1 day'
      ) AS value
      FROM generate_series(
        CURRENT_DATE - ($1::int - 1),
        CURRENT_DATE,
        '1 day'::interval
      ) d
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
    networkStatus: [
      {
        id: mikrotik.router.id,
        name: mikrotik.router.name,
        type: "ROUTER" as const,
        status: "ONLINE" as const,
      },
    ],
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
