import { pool } from "../../database/pool.js";

/* ============================================================
   CLIENT ROW
============================================================ */

export interface ClientListRow {
  id: string;
  siteId: string;
  username: string | null;
  displayName: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sessionsCount: number;
  purchasesCount: number;
  purchasesTotal: number;
  lastPurchaseAt: Date | null;
  voucherCode: string | null;
  planName: string | null;
  planPrice: number | null;
  planCurrency: string | null;
  paymentStatus: string | null;
}

/* ============================================================
   CREATE CLIENT DATA
============================================================ */

export interface CreateClientData {
  siteId: string;
  username?: string | null;
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  status?:
    | "ACTIVE"
    | "INACTIVE"
    | "BLOCKED"
    | "ARCHIVED";
}

/* ============================================================
   LIST CLIENTS
============================================================ */

export async function findClients(): Promise<ClientListRow[]> {
  const result = await pool.query<ClientListRow>(`
    SELECT
      c.id,
      c.site_id AS "siteId",
      c.username,
      c.display_name AS "displayName",
      c.phone,
      c.email,
      c.status,
      c.first_seen_at AS "firstSeenAt",
      c.last_seen_at AS "lastSeenAt",
      c.created_at AS "createdAt",
      c.updated_at AS "updatedAt",

      COUNT(DISTINCT s.id)::int AS "sessionsCount",
      (SELECT COUNT(*)::int FROM sale sa WHERE sa.site_id = c.site_id AND sa.client_id = c.id) AS "purchasesCount",
      (SELECT COALESCE(SUM(sa.total_amount), 0)::float8 FROM sale sa WHERE sa.site_id = c.site_id AND sa.client_id = c.id AND sa.status <> 'CANCELLED') AS "purchasesTotal",
      (SELECT MAX(sa.sold_at) FROM sale sa WHERE sa.site_id = c.site_id AND sa.client_id = c.id) AS "lastPurchaseAt",

      (SELECT v.code
       FROM session vs
       JOIN voucher v ON v.id = vs.voucher_id AND v.site_id = vs.site_id
       WHERE vs.site_id = c.site_id AND vs.client_id = c.id
       ORDER BY vs.started_at DESC
       LIMIT 1) AS "voucherCode",
      (SELECT COALESCE(p.name, v.mikrotik_profile, vs.mikrotik_profile)
       FROM session vs
       JOIN voucher v ON v.id = vs.voucher_id AND v.site_id = vs.site_id
       LEFT JOIN plan p ON p.id = v.plan_id AND p.site_id = v.site_id
       WHERE vs.site_id = c.site_id AND vs.client_id = c.id
       ORDER BY vs.started_at DESC
       LIMIT 1) AS "planName",
      (SELECT COALESCE(hpp.price, v.price_snapshot, p.price)::float8
       FROM session vs
       JOIN voucher v ON v.id = vs.voucher_id AND v.site_id = vs.site_id
       LEFT JOIN plan p ON p.id = v.plan_id AND p.site_id = v.site_id
       LEFT JOIN LATERAL (
         SELECT profile_price.price, profile_price.currency
         FROM site_hotspot_profile_price profile_price
         WHERE profile_price.site_id = v.site_id
           AND LOWER(profile_price.profile_code) = LOWER(COALESCE(v.mikrotik_profile, vs.mikrotik_profile))
         ORDER BY profile_price.updated_at DESC NULLS LAST
         LIMIT 1
       ) hpp ON TRUE
       WHERE vs.site_id = c.site_id AND vs.client_id = c.id
       ORDER BY vs.started_at DESC
       LIMIT 1) AS "planPrice",
      (SELECT COALESCE(hpp.currency, v.currency_snapshot, p.currency)
       FROM session vs
       JOIN voucher v ON v.id = vs.voucher_id AND v.site_id = vs.site_id
       LEFT JOIN plan p ON p.id = v.plan_id AND p.site_id = v.site_id
       LEFT JOIN LATERAL (
         SELECT profile_price.price, profile_price.currency
         FROM site_hotspot_profile_price profile_price
         WHERE profile_price.site_id = v.site_id
           AND LOWER(profile_price.profile_code) = LOWER(COALESCE(v.mikrotik_profile, vs.mikrotik_profile))
         ORDER BY profile_price.updated_at DESC NULLS LAST
         LIMIT 1
       ) hpp ON TRUE
       WHERE vs.site_id = c.site_id AND vs.client_id = c.id
       ORDER BY vs.started_at DESC
       LIMIT 1) AS "planCurrency",
      (SELECT sa.status
       FROM session vs
       JOIN sale sa ON sa.voucher_id = vs.voucher_id AND sa.site_id = vs.site_id
       WHERE vs.site_id = c.site_id AND vs.client_id = c.id
       ORDER BY sa.sold_at DESC NULLS LAST
       LIMIT 1) AS "paymentStatus"

    FROM client c

    LEFT JOIN session s
      ON s.site_id = c.site_id
      AND s.client_id = c.id

    GROUP BY
      c.id,
      c.site_id,
      c.username,
      c.display_name,
      c.phone,
      c.email,
      c.status,
      c.first_seen_at,
      c.last_seen_at,
      c.created_at,
      c.updated_at

    ORDER BY c.created_at DESC
  `);

  return result.rows;
}

/* ============================================================
   FIND CLIENT BY ID
============================================================ */

export async function findClientById(
  id: string
): Promise<ClientListRow | null> {
  const result = await pool.query<ClientListRow>(
    `
      SELECT
        c.id,
        c.site_id AS "siteId",
        c.username,
        c.display_name AS "displayName",
        c.phone,
        c.email,
        c.status,
        c.first_seen_at AS "firstSeenAt",
        c.last_seen_at AS "lastSeenAt",
        c.created_at AS "createdAt",
        c.updated_at AS "updatedAt",

        COUNT(DISTINCT s.id)::int AS "sessionsCount",
        (SELECT COUNT(*)::int FROM sale sa WHERE sa.site_id = c.site_id AND sa.client_id = c.id) AS "purchasesCount",
        (SELECT COALESCE(SUM(sa.total_amount), 0)::float8 FROM sale sa WHERE sa.site_id = c.site_id AND sa.client_id = c.id AND sa.status <> 'CANCELLED') AS "purchasesTotal",
        (SELECT MAX(sa.sold_at) FROM sale sa WHERE sa.site_id = c.site_id AND sa.client_id = c.id) AS "lastPurchaseAt",

      (SELECT v.code
       FROM session vs
       JOIN voucher v ON v.id = vs.voucher_id AND v.site_id = vs.site_id
       WHERE vs.site_id = c.site_id AND vs.client_id = c.id
       ORDER BY vs.started_at DESC
       LIMIT 1) AS "voucherCode",
      (SELECT COALESCE(p.name, v.mikrotik_profile, vs.mikrotik_profile)
       FROM session vs
       JOIN voucher v ON v.id = vs.voucher_id AND v.site_id = vs.site_id
       LEFT JOIN plan p ON p.id = v.plan_id AND p.site_id = v.site_id
       WHERE vs.site_id = c.site_id AND vs.client_id = c.id
       ORDER BY vs.started_at DESC
       LIMIT 1) AS "planName",
      (SELECT COALESCE(hpp.price, v.price_snapshot, p.price)::float8
       FROM session vs
       JOIN voucher v ON v.id = vs.voucher_id AND v.site_id = vs.site_id
       LEFT JOIN plan p ON p.id = v.plan_id AND p.site_id = v.site_id
       LEFT JOIN LATERAL (
         SELECT profile_price.price, profile_price.currency
         FROM site_hotspot_profile_price profile_price
         WHERE profile_price.site_id = v.site_id
           AND LOWER(profile_price.profile_code) = LOWER(COALESCE(v.mikrotik_profile, vs.mikrotik_profile))
         ORDER BY profile_price.updated_at DESC NULLS LAST
         LIMIT 1
       ) hpp ON TRUE
       WHERE vs.site_id = c.site_id AND vs.client_id = c.id
       ORDER BY vs.started_at DESC
       LIMIT 1) AS "planPrice",
      (SELECT COALESCE(hpp.currency, v.currency_snapshot, p.currency)
       FROM session vs
       JOIN voucher v ON v.id = vs.voucher_id AND v.site_id = vs.site_id
       LEFT JOIN plan p ON p.id = v.plan_id AND p.site_id = v.site_id
       LEFT JOIN LATERAL (
         SELECT profile_price.price, profile_price.currency
         FROM site_hotspot_profile_price profile_price
         WHERE profile_price.site_id = v.site_id
           AND LOWER(profile_price.profile_code) = LOWER(COALESCE(v.mikrotik_profile, vs.mikrotik_profile))
         ORDER BY profile_price.updated_at DESC NULLS LAST
         LIMIT 1
       ) hpp ON TRUE
       WHERE vs.site_id = c.site_id AND vs.client_id = c.id
       ORDER BY vs.started_at DESC
       LIMIT 1) AS "planCurrency",
      (SELECT sa.status
       FROM session vs
       JOIN sale sa ON sa.voucher_id = vs.voucher_id AND sa.site_id = vs.site_id
       WHERE vs.site_id = c.site_id AND vs.client_id = c.id
       ORDER BY sa.sold_at DESC NULLS LAST
       LIMIT 1) AS "paymentStatus"

      FROM client c

      LEFT JOIN session s
        ON s.site_id = c.site_id
        AND s.client_id = c.id

      WHERE c.id = $1

      GROUP BY
        c.id,
        c.site_id,
        c.username,
        c.display_name,
        c.phone,
        c.email,
        c.status,
        c.first_seen_at,
        c.last_seen_at,
        c.created_at,
        c.updated_at
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

/* ============================================================
   UPDATE CLIENT
============================================================ */

export interface UpdateClientData {
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: "ACTIVE" | "INACTIVE" | "BLOCKED" | "ARCHIVED";
}

export async function updateClient(
  id: string,
  data: UpdateClientData
): Promise<ClientListRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  function set(column: string, value: unknown) {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  }

  if (data.displayName !== undefined)
    set("display_name", data.displayName);
  if (data.phone !== undefined) set("phone", data.phone);
  if (data.email !== undefined) set("email", data.email);
  if (data.status !== undefined) set("status", data.status);

  if (fields.length === 0) {
    return findClientById(id);
  }

  fields.push("updated_at = NOW()");
  values.push(id);

  await pool.query(
    `
      UPDATE client
      SET ${fields.join(", ")}
      WHERE id = $${values.length}
    `,
    values
  );

  return findClientById(id);
}

/* ============================================================
   DELETE CLIENT
============================================================ */

export async function deleteClient(id: string): Promise<void> {
  await pool.query(`DELETE FROM client WHERE id = $1`, [id]);
}

/* ============================================================
   CREATE CLIENT
============================================================ */

export async function createClient(
  data: CreateClientData
): Promise<ClientListRow> {
  const result = await pool.query<ClientListRow>(
    `
      INSERT INTO client (
        site_id,
        username,
        display_name,
        phone,
        email,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        COALESCE($6, 'ACTIVE')
      )
      RETURNING
        id,
        site_id AS "siteId",
        username,
        display_name AS "displayName",
        phone,
        email,
        status,
        first_seen_at AS "firstSeenAt",
        last_seen_at AS "lastSeenAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    [
      data.siteId,
      data.username ?? null,
      data.displayName ?? null,
      data.phone ?? null,
      data.email ?? null,
      data.status ?? "ACTIVE",
    ]
  );

  return {
    ...result.rows[0],
    sessionsCount: 0,
    purchasesCount: 0,
    purchasesTotal: 0,
    lastPurchaseAt: null,
    voucherCode: null,
    planName: null,
    planPrice: null,
    planCurrency: null,
    paymentStatus: null,
  };
}