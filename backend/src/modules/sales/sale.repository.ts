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

    pos.id AS "pointOfSaleId",
    pos.code AS "pointOfSaleCode",
    pos.name AS "pointOfSaleName",
    pos.type AS "pointOfSaleType",

    sa.voucher_id AS "voucherId",
    v.code AS "voucherCode",

    sa.plan_id AS "planId",
    COALESCE(p.name, sa.profile_name, sa.profile_code, 'Forfait') AS "planName",
    sa.profile_code AS "profileCode",

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
  LEFT JOIN plan p ON p.id = sa.plan_id
  LEFT JOIN voucher v ON v.id = sa.voucher_id
  JOIN point_of_sale pos ON pos.id = sa.point_of_sale_id
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
  pointOfSaleId?: string;
}): Promise<SaleRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.status) {
    params.push(filter.status);
    conditions.push(`sa.status = $${params.length}`);
  }

  if (filter?.siteId) {
    params.push(filter.siteId);
    conditions.push(`sa.site_id = ${params.length}`);
  }

  if (filter?.pointOfSaleId) {
    params.push(filter.pointOfSaleId);
    conditions.push(`sa.point_of_sale_id = ${params.length}`);
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
   POINTS DE VENTE
============================================================ */

export async function findPointOfSales(): Promise<
  Array<{
    id: string;
    organizationId: string;
    code: string;
    name: string;
    type: "INTERNAL" | "EXTERNAL";
    status: "ACTIVE" | "INACTIVE";
  }>
> {
  const result = await pool.query(
    `
      SELECT
        id,
        organization_id AS "organizationId",
        code,
        name,
        type,
        status
      FROM point_of_sale
      ORDER BY
        CASE WHEN type = 'INTERNAL' THEN 0 ELSE 1 END,
        name ASC
    `
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

interface SaleSnapshot {
  price: number;
  currency: string;
  profileCode: string;
  profileName: string;
}

export async function insertSale(
  data: CreateSaleData,
  plan: SaleSnapshot
): Promise<SaleRow> {
  const quantity = data.quantity ?? 1;
  const unitPrice = data.unitPrice ?? plan.price;
  const totalAmount = unitPrice * quantity;

  const pointOfSaleResult = await pool.query<{ id: string }>(
    `
      SELECT pos.id
      FROM point_of_sale pos
      JOIN site s ON s.organization_id = pos.organization_id
      WHERE s.id = $1
        AND pos.code = 'INTERNAL'
        AND pos.status = 'ACTIVE'
      LIMIT 1
    `,
    [data.siteId]
  );

  let pointOfSaleId = data.pointOfSaleId ?? pointOfSaleResult.rows[0]?.id;

  if (!pointOfSaleId) {
    throw new Error("Point de vente introuvable pour ce site.");
  }

  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO sale (
        site_id,
        point_of_sale_id,
        voucher_id,
        plan_id,
        profile_code,
        profile_name,
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
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING', $12
      )
      RETURNING id
    `,
    [
      data.siteId,
      pointOfSaleId,
      data.voucherId ?? null,
      data.planId ?? null,
      plan.profileCode,
      plan.profileName,
      data.customerName ?? null,
      data.customerPhone ?? null,
      quantity,
      unitPrice,
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
  const normalizeProfile = (profile: string | null) =>
    (profile ?? "").trim().toLowerCase();

  const mikrotikVouchers = await import("../vouchers/voucher.service.js")
    .then(({ getMikrotikVouchers }) => getMikrotikVouchers());

  const engagedVouchers = mikrotikVouchers.filter(
    (voucher) =>
      voucher.status === "ACTIVE" ||
      voucher.status === "EXPIRED"
  );

  const siteProfilePricesResult = await pool.query<{
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
      CROSS JOIN hotspot_profile p
      LEFT JOIN site_hotspot_profile_price sp
        ON sp.site_id = s.id
       AND sp.profile_code = p.code
      WHERE p.status = 'ACTIVE'
    `
  );

  const siteProfilePrices = new Map(
    siteProfilePricesResult.rows.map((row) => [
      `${row.siteId}|${normalizeProfile(row.profileCode)}`,
      Number(row.price),
    ])
  );

  const totalRevenue = engagedVouchers.reduce((sum, voucher) => {
    const profile = normalizeProfile(voucher.profile);
    const price =
      siteProfilePrices.get(
        `${voucher.siteId}|${profile}`
      ) ?? 0;

    return sum + price;
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
        COALESCE(sp.price, p.default_price, 0)::float8 AS amount
      FROM session s
      LEFT JOIN hotspot_profile p
        ON p.code = LOWER(TRIM(COALESCE(s.mikrotik_profile, '')))
      LEFT JOIN site_hotspot_profile_price sp
        ON sp.site_id = s.site_id
       AND sp.profile_code = p.code
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
        COALESCE(
          SUM(
            sa.quantity * COALESCE(
              sp.price,
              hp.default_price,
              sa.unit_price
            )
          ),
          0
        )::float8 AS "amount"
      FROM sale sa
      LEFT JOIN hotspot_profile hp
        ON hp.code = LOWER(TRIM(COALESCE(sa.profile_code, '')))
      LEFT JOIN site_hotspot_profile_price sp
        ON sp.site_id = sa.site_id
       AND sp.profile_code = hp.code
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
