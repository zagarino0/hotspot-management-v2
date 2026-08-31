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
  const totalsResult = await pool.query<{
    totalRevenue: string | null;
    salesCount: string;
  }>(
    `
      SELECT
        COALESCE(SUM(pay.amount), 0)::float8 AS "totalRevenue",
        COUNT(DISTINCT sa.id) AS "salesCount"
      FROM sale sa
      LEFT JOIN payment pay
        ON pay.sale_id = sa.id AND pay.status = 'SUCCESS'
      WHERE sa.status IN ('PAID', 'PARTIALLY_PAID')
    `
  );

  const totalRevenue = Number(
    totalsResult.rows[0]?.totalRevenue ?? 0
  );
  const salesCount = Number(
    totalsResult.rows[0]?.salesCount ?? 0
  );

  const mobileResult = await pool.query<{
    mobileAmount: string | null;
    totalAmount: string | null;
  }>(
    `
      SELECT
        COALESCE(SUM(amount) FILTER (
          WHERE method IN ('MVOLA', 'ORANGE_MONEY', 'AIRTEL_MONEY')
        ), 0)::float8 AS "mobileAmount",
        COALESCE(SUM(amount), 0)::float8 AS "totalAmount"
      FROM payment
      WHERE status = 'SUCCESS'
    `
  );

  const mobileAmount = Number(
    mobileResult.rows[0]?.mobileAmount ?? 0
  );
  const paymentsTotal = Number(
    mobileResult.rows[0]?.totalAmount ?? 0
  );

  const revenueByDayResult = await pool.query<{
    date: string;
    amount: string;
  }>(
    `
      SELECT
        TO_CHAR(pay.paid_at, 'YYYY-MM-DD') AS "date",
        SUM(pay.amount)::float8 AS "amount"
      FROM payment pay
      WHERE pay.status = 'SUCCESS'
        AND pay.paid_at >= NOW() - INTERVAL '30 days'
      GROUP BY TO_CHAR(pay.paid_at, 'YYYY-MM-DD')
      ORDER BY "date" ASC
    `
  );

  return {
    totalRevenue,
    salesCount,
    averageBasket:
      salesCount > 0 ? totalRevenue / salesCount : 0,
    mobilePaymentShare:
      paymentsTotal > 0
        ? (mobileAmount / paymentsTotal) * 100
        : 0,
    revenueByDay: revenueByDayResult.rows.map((row) => ({
      date: row.date,
      amount: Number(row.amount),
    })),
  };
}
