import { pool } from "../../database/pool.js";
import { generateVoucherCode } from "../../lib/voucherCode.js";

import type {
  GenerateVouchersData,
  VoucherRow,
  VoucherStatus,
} from "../../routes/voucher.types.js";

/* ============================================================
   SELECT
============================================================ */

const VOUCHER_SELECT = `
  SELECT
    v.id,

    v.site_id AS "siteId",
    s.name AS "siteName",

    v.plan_id AS "planId",
    p.name AS "planName",
    p.price::float8 AS "planPrice",
    p.currency AS "planCurrency",

    v.mikrotik_profile AS "mikrotikProfile",

    v.batch_id AS "batchId",

    v.code,

    v.status,

    v.activated_at AS "activatedAt",
    v.expires_at AS "expiresAt",

    v.duration_seconds AS "durationSeconds",
    v.data_limit_bytes AS "dataLimitBytes",

    v.sold_at AS "soldAt",
    v.used_at AS "usedAt",

    v.created_at AS "createdAt",
    v.updated_at AS "updatedAt"

  FROM voucher v
  JOIN site s ON s.id = v.site_id
  LEFT JOIN plan p ON p.id = v.plan_id
`;

const VOUCHER_LIST_LIMIT = 500;

/* ============================================================
   LIST
============================================================ */

export async function findVouchers(filter?: {
  status?: VoucherStatus;
  siteId?: string;
  planId?: string;
}): Promise<VoucherRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.status) {
    params.push(filter.status);
    conditions.push(`v.status = $${params.length}`);
  }

  if (filter?.siteId) {
    params.push(filter.siteId);
    conditions.push(`v.site_id = $${params.length}`);
  }

  if (filter?.planId) {
    params.push(filter.planId);
    conditions.push(`v.plan_id = $${params.length}`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await pool.query<VoucherRow>(
    `
      ${VOUCHER_SELECT}
      ${whereClause}
      ORDER BY v.created_at DESC
      LIMIT ${VOUCHER_LIST_LIMIT}
    `,
    params
  );

  return result.rows;
}

/* ============================================================
   UPDATE STATUS
============================================================ */

export async function updateVoucherStatus(
  id: string,
  status: VoucherStatus
): Promise<VoucherRow | null> {
  await pool.query(
    `
      UPDATE voucher
      SET status = $2, updated_at = NOW()
      WHERE id = $1
    `,
    [id, status]
  );

  const result = await pool.query<VoucherRow>(
    `
      ${VOUCHER_SELECT}
      WHERE v.id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

/* ============================================================
   FIND BY ID
============================================================ */

export async function findVoucherById(
  id: string
): Promise<VoucherRow | null> {
  const result = await pool.query<VoucherRow>(
    `
      ${VOUCHER_SELECT}
      WHERE v.id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

/* ============================================================
   DELETE
   Réservé aux vouchers jamais utilisés (contrôlé par le
   service, pas ici) — un voucher déjà vendu/activé est une
   pièce d'audit, pas une simple ligne à effacer.
============================================================ */

export async function deleteVoucher(id: string): Promise<void> {
  await pool.query(`DELETE FROM voucher WHERE id = $1`, [id]);
}

/* ============================================================
   FIND BY BATCH ID
============================================================ */

export async function findVouchersByBatchId(
  batchId: string
): Promise<VoucherRow[]> {
  const result = await pool.query<VoucherRow>(
    `
      ${VOUCHER_SELECT}
      WHERE v.batch_id = $1
      ORDER BY v.created_at ASC
    `,
    [batchId]
  );

  return result.rows;
}

/* ============================================================
   GENERATE BATCH

   Insère le lot (voucher_batch) puis chaque voucher un par un.
   Les paramètres du forfait (durée/quota/débit) sont copiés sur
   le voucher AU MOMENT DE LA GÉNÉRATION : si le forfait change
   plus tard, les vouchers déjà émis ne sont pas affectés.
============================================================ */

interface PlanSnapshot {
  id: string | null;
  siteId: string;
  durationSeconds: number | null;
  dataLimitBytes: number | null;
  downloadSpeedBps: number | null;
  uploadSpeedBps: number | null;
}

const MAX_CODE_ATTEMPTS = 5;

export async function generateVoucherBatch(
  data: GenerateVouchersData,
  plan: PlanSnapshot
): Promise<{ batchId: string; voucherIds: string[] }> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const batchResult = await client.query<{ id: string }>(
      `
        INSERT INTO voucher_batch (
          site_id,
          plan_id,
          mikrotik_profile,
          name,
          prefix,
          quantity,
          created_by,
          status
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, 'ACTIVE'
        )
        RETURNING id
      `,
      [
        data.siteId,
        data.planId,
        data.mikrotikProfile,
        data.batchName,
        data.prefix ?? null,
        data.quantity,
        data.createdBy ?? null,
      ]
    );

    const batchId = batchResult.rows[0].id;
    const voucherIds: string[] = [];

    for (let i = 0; i < data.quantity; i++) {
      const voucherId = await insertVoucherWithRetry(
        client,
        {
          siteId: data.siteId,
          planId: plan.id,
          mikrotikProfile: data.mikrotikProfile,
          batchId,
          prefix: data.prefix,
          durationSeconds: plan.durationSeconds,
          dataLimitBytes: plan.dataLimitBytes,
          downloadSpeedBps: plan.downloadSpeedBps,
          uploadSpeedBps: plan.uploadSpeedBps,
        }
      );

      voucherIds.push(voucherId);
    }

    await client.query("COMMIT");

    return { batchId, voucherIds };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function insertVoucherWithRetry(
  client: {
    query: (
      text: string,
      params?: unknown[]
    ) => Promise<{ rows: { id: string }[] }>;
  },
  input: {
    siteId: string;
    planId: string | null;
    mikrotikProfile?: string | null;
    batchId: string;
    prefix?: string | null;
    durationSeconds: number | null;
    dataLimitBytes: number | null;
    downloadSpeedBps: number | null;
    uploadSpeedBps: number | null;
  }
): Promise<string> {
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt < MAX_CODE_ATTEMPTS;
    attempt++
  ) {
    const code = generateVoucherCode(input.prefix);

    try {
      const result = await client.query(
        `
          INSERT INTO voucher (
            site_id,
            plan_id,
            mikrotik_profile,
            batch_id,
            code,
            duration_seconds,
            data_limit_bytes,
            download_speed_bps,
            upload_speed_bps,
            status
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, 'UNUSED'
          )
          RETURNING id
        `,
        [
          input.siteId,
          input.planId,
          input.mikrotikProfile,
          input.batchId,
          code,
          input.durationSeconds,
          input.dataLimitBytes,
          input.downloadSpeedBps,
          input.uploadSpeedBps,
        ]
      );

      return result.rows[0].id;
    } catch (error) {
      lastError = error;

      const isUniqueViolation =
        error instanceof Error &&
        "code" in error &&
        (error as { code?: string }).code === "23505";

      if (!isUniqueViolation) {
        throw error;
      }

      // Collision de code (extrêmement rare) : on réessaie
      // avec un nouveau code généré aléatoirement.
    }
  }

  throw (
    lastError ??
    new Error(
      "Impossible de générer un code voucher unique."
    )
  );
}
