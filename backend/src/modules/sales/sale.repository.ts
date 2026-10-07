import { pool } from "../../database/pool.js";

import type {
  CreateSaleData,
  SaleRow,
  SalesSummary,
  SaleStatus,
} from "../../routes/sale.types.js";

/* ============================================================
   SELECT
   paidAmount = somme des paiements SUCCESS liés à cette vente,
   calculée en direct (pas de compteur dupliqué en base).
============================================================ */

const SALE_SELECT = `
  SELECT
    sa.id,

    sa.site_id AS "siteId",
    s.name AS "siteName",

    sa.voucher_id AS "voucherId",
    v.code AS "voucherCode",

    sa.plan_id AS "planId",
    p.name AS "planName",

    sa.customer_name AS "customerName",
    sa.customer_phone AS "customerPhone",

    sa.quantity,

    sa.unit_price::float8 AS "unitPrice",
    sa.total_amount::float8 AS "totalAmount",

    COALESCE(paid.amount, 0)::float8 AS "paidAmount",

    lastpay.method AS "lastPaymentMethod",

    sa.currency,

    sa.status,

    sa.sold_at AS "soldAt",

    sa.created_at AS "createdAt",
    sa.updated_at AS "updatedAt"

  FROM sale sa
  JOIN site s ON s.id = sa.site_id
  JOIN plan p ON p.id = sa.plan_id
  LEFT JOIN voucher v ON v.id = sa.voucher_id
  LEFT JOIN LATERAL (
    SELECT SUM(pay.amount) AS amount
    FROM payment pay
    WHERE pay.sale_id = sa.id
      AND pay.status = 'SUCCESS'
  ) paid ON true
  LEFT JOIN LATERAL (
    SELECT method
    FROM payment pay2
    WHERE pay2.sale_id = sa.id
    ORDER BY pay2.created_at DESC
    LIMIT 1
  ) lastpay ON true
`;

const SALE_LIST_LIMIT = 500;

/* ============================================================
   LIST
============================================================ */

export async function findSales(filter?: {
  status?: SaleStatus;
  siteId?: string;
}): Promise<SaleRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.status) {
    params.push(filter.status);
    conditions.push(`sa.status = $${params.length}`);
  }

  if (filter?.siteId) {
    params.push(filter.siteId);
    conditions.push(`sa.site_id = $${params.length}`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await pool.query<SaleRow>(
    `
      ${SALE_SELECT}
      ${whereClause}
      ORDER BY sa.sold_at DESC
      LIMIT ${SALE_LIST_LIMIT}
    `,
    params
  );

  return result.rows;
}

/* ============================================================
   FIND BY ID
============================================================ */

export async function findSaleById(
  id: string
): Promise<SaleRow | null> {
  const result = await pool.query<SaleRow>(
    `
      ${SALE_SELECT}
      WHERE sa.id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

/* ============================================================
   INSERT
============================================================ */

interface PlanSnapshot {
  price: number;
  currency: string;
}

export async function insertSale(
  data: CreateSaleData,
  plan: PlanSnapshot
): Promise<SaleRow> {
  const quantity = data.quantity ?? 1;
  const totalAmount = plan.price * quantity;

  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO sale (
        site_id,
        voucher_id,
        plan_id,
        customer_name,
        customer_phone,
        quantity,
        unit_price,
        total_amount,
        currency,
        status,
        created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', $10
      )
      RETURNING id
    `,
    [
      data.siteId,
      data.voucherId ?? null,
      data.planId,
      data.customerName ?? null,
      data.customerPhone ?? null,
      quantity,
      plan.price,
      totalAmount,
      plan.currency,
      data.createdBy ?? null,
    ]
  );

  const created = await findSaleById(result.rows[0].id);

  if (!created) {
    throw new Error("La vente n'a pas pu être créée.");
  }

  return created;
}

/* ============================================================
   UPDATE STATUS (recalcul après un paiement, ou annulation)
============================================================ */

export async function updateSaleStatus(
  id: string,
  status: SaleStatus
): Promise<void> {
  await pool.query(
    `
      UPDATE sale
      SET status = $2, updated_at = NOW()
      WHERE id = $1
    `,
    [id, status]
  );
}

/* ============================================================
   DELETE (réservé aux ventes PENDING sans paiement, contrôlé
   par le service)
============================================================ */

export async function deleteSale(id: string): Promise<void> {
  await pool.query(`DELETE FROM sale WHERE id = $1`, [id]);
}

/* ============================================================
   SUMMARY (revenus, panier moyen, part mobile money, courbe)
============================================================ */

export async function getSalesSummary(): Promise<SalesSummary> {
  /*
   * Règle métier Ventes :
   * - Un ticket est considéré comme engagé lorsqu'il possède une MAC
   *   ou que son quota est arrivé à expiration.
   * - Le chiffre d'affaires est calculé à partir du profil MikroTik
   *   du ticket, jamais à partir d'un montant saisi dans sale.
   * - Chaque profil possède un tarif fixe.
   */
  const profilePrices: Record<string, number> = {
    profil_1h: 500,
    profil_3h: 1000,
    profil_24h: 2500,
    profil_week: 7000,
    profil_mothe_1: 35000,
    profil_month_1: 35000,
  };

  const normalizeProfile = (profile: string | null) =>
    (profile ?? "").trim().toLowerCase();

  const mikrotikVouchers = await import("../vouchers/voucher.service.js")
    .then(({ getMikrotikVouchers }) => getMikrotikVouchers());

  const engagedVouchers = mikrotikVouchers.filter(
    (voucher) =>
      voucher.status === "ACTIVE" ||
      voucher.status === "EXPIRED"
  );

  const totalRevenue = engagedVouchers.reduce((sum, voucher) => {
    const profile = normalizeProfile(voucher.profile);
    return sum + (profilePrices[profile] ?? 0);
  }, 0);

  const salesCount = engagedVouchers.length;

  /*
   * Ventes aujourd'hui = somme des nouveaux tickets dont la toute
   * première connexion historique a commencé aujourd'hui.
   * Un même voucher ne peut donc être compté qu'une seule fois,
   * même s'il s'est reconnecté plusieurs fois dans la journée.
   */
  const todayFirstConnectionsResult = await pool.query<{
    profile: string | null;
    amount: string;
  }>(
    `
      SELECT
        s.mikrotik_profile AS profile,
        CASE LOWER(TRIM(COALESCE(s.mikrotik_profile, '')))
          WHEN 'profil_1h' THEN 500
          WHEN 'profil_3h' THEN 1000
          WHEN 'profil_24h' THEN 2500
          WHEN 'profil_week' THEN 7000
          WHEN 'profil_mothe_1' THEN 35000
          WHEN 'profil_month_1' THEN 35000
          ELSE 0
        END::float8 AS amount
      FROM session s
      WHERE s.started_at >= CURRENT_DATE
        AND s.started_at < CURRENT_DATE + INTERVAL '1 day'
        AND NOT EXISTS (
          SELECT 1
          FROM session previous
          WHERE previous.router_id = s.router_id
            AND previous.username = s.username
            AND previous.started_at < s.started_at
        )
    `
  );

  const todayRevenue = todayFirstConnectionsResult.rows.reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );

  const paymentShareResult = await pool.query<{
    mobileAmount: string | null;
    cashAmount: string | null;
    paidAmount: string | null;
  }>(
    `
      SELECT
        COALESCE(SUM(pay.amount) FILTER (
          WHERE pay.method IN ('MVOLA', 'ORANGE_MONEY', 'AIRTEL_MONEY')
        ), 0)::float8 AS "mobileAmount",
        COALESCE(SUM(pay.amount) FILTER (
          WHERE pay.method = 'CASH'
        ), 0)::float8 AS "cashAmount",
        COALESCE(SUM(pay.amount), 0)::float8 AS "paidAmount"
      FROM payment pay
      JOIN sale sa ON sa.id = pay.sale_id
      WHERE pay.status = 'SUCCESS'
        AND sa.status = 'PAID'
    `
  );

  const mobileAmount = Number(
    paymentShareResult.rows[0]?.mobileAmount ?? 0
  );
  const cashAmount = Number(
    paymentShareResult.rows[0]?.cashAmount ?? 0
  );
  const paidAmount = Number(
    paymentShareResult.rows[0]?.paidAmount ?? 0
  );

  /*
   * La courbe reste basée sur les ventes enregistrées dans le module
   * afin de conserver la chronologie commerciale existante.
   * Les KPI principaux ci-dessus suivent, eux, exclusivement la
   * logique des vouchers MikroTik.
   */
  const revenueByDayResult = await pool.query<{
    date: string;
    amount: string;
  }>(
    `
      SELECT
        TO_CHAR(sa.sold_at, 'YYYY-MM-DD') AS "date",
        SUM(sa.total_amount)::float8 AS "amount"
      FROM sale sa
      WHERE sa.status = 'PAID'
        AND sa.sold_at >= NOW() - INTERVAL '30 days'
      GROUP BY TO_CHAR(sa.sold_at, 'YYYY-MM-DD')
      ORDER BY "date" ASC
    `
  );

  return {
    totalRevenue,
    todayRevenue,
    salesCount,
    averageBasket:
      salesCount > 0 ? totalRevenue / salesCount : 0,
    mobilePaymentShare:
      paidAmount > 0
        ? (mobileAmount / paidAmount) * 100
        : 0,
    cashPaymentShare:
      paidAmount > 0
        ? (cashAmount / paidAmount) * 100
        : 0,
    revenueByDay: revenueByDayResult.rows.map((row) => ({
      date: row.date,
      amount: Number(row.amount),
    })),
  };
}
