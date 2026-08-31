import { pool } from "../../database/pool.js";

import type {
  CreatePlanData,
  PlanRow,
} from "../../routes/plan.types.js";

const PLAN_SELECT = `
  SELECT
    p.id,

    p.site_id AS "siteId",
    s.name AS "siteName",

    p.name,
    p.code,
    p.description,

    p.price::float8 AS "price",
    p.currency,

    p.duration_seconds AS "durationSeconds",
    p.data_limit_bytes AS "dataLimitBytes",

    p.download_speed_bps AS "downloadSpeedBps",
    p.upload_speed_bps AS "uploadSpeedBps",

    p.simultaneous_sessions AS "simultaneousSessions",

    p.status,

    COUNT(v.id) AS "voucherCount",

    p.created_at AS "createdAt",
    p.updated_at AS "updatedAt"

  FROM plan p
  JOIN site s ON s.id = p.site_id
  LEFT JOIN voucher v ON v.plan_id = p.id
`;

const PLAN_GROUP_BY = `GROUP BY p.id, s.name`;

/* ============================================================
   LIST
============================================================ */

export async function findPlans(): Promise<PlanRow[]> {
  const result = await pool.query<PlanRow>(
    `
      ${PLAN_SELECT}
      ${PLAN_GROUP_BY}
      ORDER BY p.created_at DESC
    `
  );

  return result.rows;
}

/* ============================================================
   FIND BY ID
============================================================ */

export async function findPlanById(
  id: string
): Promise<PlanRow | null> {
  const result = await pool.query<PlanRow>(
    `
      ${PLAN_SELECT}
      WHERE p.id = $1
      ${PLAN_GROUP_BY}
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

/* ============================================================
   INSERT
============================================================ */

export async function insertPlan(
  data: CreatePlanData
): Promise<PlanRow> {
  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO plan (
        site_id,
        name,
        code,
        description,
        price,
        currency,
        duration_seconds,
        data_limit_bytes,
        download_speed_bps,
        upload_speed_bps,
        simultaneous_sessions
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      RETURNING id
    `,
    [
      data.siteId,
      data.name,
      data.code,
      data.description ?? null,
      data.price,
      data.currency ?? "MGA",
      data.durationSeconds ?? null,
      data.dataLimitBytes ?? null,
      data.downloadSpeedBps ?? null,
      data.uploadSpeedBps ?? null,
      data.simultaneousSessions ?? 1,
    ]
  );

  const created = await findPlanById(result.rows[0].id);

  if (!created) {
    throw new Error("Le forfait n'a pas pu être créé.");
  }

  return created;
}
