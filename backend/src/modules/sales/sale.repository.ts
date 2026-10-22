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
    sa.client_id AS "clientId",
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
    conditions.push(`sa.site_id = $${params.length}`);
  }

  if (filter?.pointOfSaleId) {
    params.push(filter.pointOfSaleId);
    conditions.push(`sa.point_of_sale_id = $${params.length}`);
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

export async function findPointOfSales(
  organizationId?: string
): Promise<
  Array<{
    id: string;
    organizationId: string;
    code: string;
    name: string;
    type: "INTERNAL" | "EXTERNAL";
    status: "ACTIVE" | "INACTIVE";
    openingTime: string;
    closingTime: string;
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
        status,
        TO_CHAR(opening_time, 'HH24:MI') AS "openingTime",
        TO_CHAR(closing_time, 'HH24:MI') AS "closingTime"
      FROM point_of_sale
      ${organizationId ? "WHERE organization_id = $1" : ""}
      ORDER BY
        CASE WHEN type = 'INTERNAL' THEN 0 ELSE 1 END,
        name ASC
    `,
    organizationId ? [organizationId] : []
  );

  return result.rows;
}

export async function insertPointOfSale(data: {
  organizationId: string;
  code: string;
  name: string;
  type: "INTERNAL" | "EXTERNAL";
}) {
  const result = await pool.query(
    `
      INSERT INTO point_of_sale (
        organization_id,
        code,
        name,
        type
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        organization_id AS "organizationId",
        code,
        name,
        type,
        status,
        TO_CHAR(opening_time, 'HH24:MI') AS "openingTime",
        TO_CHAR(closing_time, 'HH24:MI') AS "closingTime"
    `,
    [data.organizationId, data.code, data.name, data.type]
  );

  return result.rows[0];
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

  // Resolve the client by a normalized phone number within this site.
  // Names alone are not treated as identity keys: homonyms must not merge.
  let clientId: string | null = null;
  const customerName = data.customerName?.trim() || null;
  const customerPhone = data.customerPhone?.trim() || null;
  const normalizedPhone = customerPhone?.replace(/[^0-9]/g, "") ?? "";

  if (customerName || normalizedPhone) {
    if (normalizedPhone) {
      const existingClient = await pool.query<{ id: string }>(
        `
          SELECT id
          FROM client
          WHERE site_id = $1
            AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $2
            AND $2 <> ''
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        [data.siteId, normalizedPhone]
      );
      clientId = existingClient.rows[0]?.id ?? null;
    }

    if (!clientId) {
      const createdClient = await pool.query<{ id: string }>(
        `
          INSERT INTO client (site_id, display_name, phone, status)
          VALUES ($1, $2, $3, 'ACTIVE')
          RETURNING id
        `,
        [data.siteId, customerName, customerPhone]
      );
      clientId = createdClient.rows[0]?.id ?? null;
    } else {
      await pool.query(
        `
          UPDATE client
          SET display_name = COALESCE(NULLIF($2, ''), display_name),
              phone = COALESCE(NULLIF($3, ''), phone),
              updated_at = NOW()
          WHERE id = $1
        `,
        [clientId, customerName, customerPhone]
      );
    }
  }

  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO sale (
        site_id,
        point_of_sale_id,
        voucher_id,
        client_id,
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
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'PENDING', $14
      )
      RETURNING id
    `,
    [
      data.siteId,
      pointOfSaleId,
      data.voucherId ?? null,
      clientId,
      data.planId ?? null,
      plan.profileCode,
      plan.profileName,
      customerName,
      customerPhone,
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
   * Ventes du jour = ventes internes PAID + tickets externes SOLD.
   * Les deux sources sont disjointes par type de POS pour éviter les doublons.
   * Chaque source suit le jour commercial du POS dans le fuseau de Madagascar.
   */
  const todaySalesResult = await pool.query<{ revenue: string }>(
    `
      WITH internal_sales AS (
        SELECT
          SUM(
            sa.quantity * COALESCE(
              sp.price,
              hp.default_price,
              sa.unit_price
            )
          ) AS revenue
        FROM sale sa
        JOIN point_of_sale pos
          ON pos.id = sa.point_of_sale_id
         AND pos.type = 'INTERNAL'
        LEFT JOIN hotspot_profile hp
          ON LOWER(TRIM(hp.code)) = LOWER(TRIM(COALESCE(sa.profile_code, '')))
        LEFT JOIN LATERAL (
          SELECT MAX(price) AS price
          FROM site_hotspot_profile_price
          WHERE site_id = sa.site_id
            AND LOWER(TRIM(profile_code)) = LOWER(TRIM(COALESCE(hp.code, sa.profile_code, '')))
        ) sp ON TRUE
        WHERE sa.status = 'PAID'
          AND (
            CASE
              WHEN TO_CHAR(sa.sold_at AT TIME ZONE 'Indian/Antananarivo', 'HH24:MI')
                   > TO_CHAR(pos.closing_time, 'HH24:MI')
              THEN (sa.sold_at AT TIME ZONE 'Indian/Antananarivo')::date + 1
              ELSE (sa.sold_at AT TIME ZONE 'Indian/Antananarivo')::date
            END
          ) = (
            CASE
              WHEN TO_CHAR(NOW() AT TIME ZONE 'Indian/Antananarivo', 'HH24:MI')
                   > TO_CHAR(pos.closing_time, 'HH24:MI')
              THEN (NOW() AT TIME ZONE 'Indian/Antananarivo')::date + 1
              ELSE (NOW() AT TIME ZONE 'Indian/Antananarivo')::date
            END
          )
      ),
      external_sales AS (
        SELECT SUM(e.unit_price) AS revenue
        FROM point_of_sale_ticket_event e
        JOIN point_of_sale pos
          ON pos.id = e.point_of_sale_id
         AND pos.type = 'EXTERNAL'
        WHERE e.event_type = 'SOLD'
          AND (
            CASE
              WHEN TO_CHAR(e.occurred_at AT TIME ZONE 'Indian/Antananarivo', 'HH24:MI')
                   > TO_CHAR(pos.closing_time, 'HH24:MI')
              THEN (e.occurred_at AT TIME ZONE 'Indian/Antananarivo')::date + 1
              ELSE (e.occurred_at AT TIME ZONE 'Indian/Antananarivo')::date
            END
          ) = (
            CASE
              WHEN TO_CHAR(NOW() AT TIME ZONE 'Indian/Antananarivo', 'HH24:MI')
                   > TO_CHAR(pos.closing_time, 'HH24:MI')
              THEN (NOW() AT TIME ZONE 'Indian/Antananarivo')::date + 1
              ELSE (NOW() AT TIME ZONE 'Indian/Antananarivo')::date
            END
          )
      )
      SELECT (
        COALESCE((SELECT revenue FROM internal_sales), 0) +
        COALESCE((SELECT revenue FROM external_sales), 0)
      )::float8 AS revenue
    `
  );
  const todayRevenue = Number(todaySalesResult.rows[0]?.revenue ?? 0);

  // Recette confirmée = somme des versements réels de la date locale courante.
  // business_date est déjà la date commerciale enregistrée lors du versement :
  // ne pas lui appliquer une seconde fois le décalage après l'heure de clôture.
  const todayConfirmedRemittanceResult = await pool.query<{ revenue: string }>(
    `
      SELECT COALESCE(SUM(r.remitted_amount), 0)::float8 AS revenue
      FROM point_of_sale_remittance r
      JOIN point_of_sale pos ON pos.id = r.point_of_sale_id
      WHERE r.currency = 'MGA'
        AND r.business_date = (NOW() AT TIME ZONE 'Indian/Antananarivo')::date
    `
  );
  const todayConfirmedRemittance = Number(
    todayConfirmedRemittanceResult.rows[0]?.revenue ?? 0
  );

  const externalTodayResult = await pool.query<{
    revenue: string;
    count: string;
  }>(
    `
      SELECT
        COALESCE(SUM(e.unit_price), 0)::float8 AS revenue,
        COUNT(*)::int AS count
      FROM point_of_sale_ticket_event e
      JOIN point_of_sale pos
        ON pos.id = e.point_of_sale_id
      WHERE e.event_type = 'SOLD'
        AND pos.type = 'EXTERNAL'
        AND (
          CASE
            WHEN TO_CHAR(e.occurred_at AT TIME ZONE 'Indian/Antananarivo', 'HH24:MI')
                 > TO_CHAR(pos.closing_time, 'HH24:MI')
            THEN (e.occurred_at AT TIME ZONE 'Indian/Antananarivo')::date + 1
            ELSE (e.occurred_at AT TIME ZONE 'Indian/Antananarivo')::date
          END
        ) = (
          CASE
            WHEN TO_CHAR(NOW() AT TIME ZONE 'Indian/Antananarivo', 'HH24:MI')
                 > TO_CHAR(pos.closing_time, 'HH24:MI')
            THEN (NOW() AT TIME ZONE 'Indian/Antananarivo')::date + 1
            ELSE (NOW() AT TIME ZONE 'Indian/Antananarivo')::date
          END
        )
    `
  );

  const externalTodayRevenue = Number(
    externalTodayResult.rows[0]?.revenue ?? 0
  );
  const externalTodaySalesCount = Number(
    externalTodayResult.rows[0]?.count ?? 0
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
    todayConfirmedRemittance,
    externalTodayRevenue,
    externalTodaySalesCount,
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
