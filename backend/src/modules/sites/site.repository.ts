import { pool } from "../../database/pool.js";

import type {
  CreateSiteData,
  SiteRow,
} from "../../routes/site.types.js";

/* ============================================================
   SELECT
   Agrégats calculés en direct depuis les tables liées — pas de
   compteurs dupliqués/désynchronisables en base.
============================================================ */

const SITE_SELECT = `
  SELECT
    s.id,
    s.organization_id AS "organizationId",

    s.name,
    s.code,
    s.description,

    s.address,
    s.city,
    s.region,
    s.district,

    s.latitude,
    s.longitude,

    s.timezone,

    s.status,

    COUNT(DISTINCT r.id) AS "routerCount",
    COUNT(DISTINCT r.id) FILTER (
      WHERE r.status = 'ONLINE'
    ) AS "routerOnlineCount",
    COUNT(DISTINCT ap.id) AS "accessPointCount",
    COUNT(DISTINCT c.id) AS "clientCount",

    s.created_at AS "createdAt",
    s.updated_at AS "updatedAt"

  FROM site s
  LEFT JOIN router r ON r.site_id = s.id
  LEFT JOIN access_point ap ON ap.site_id = s.id
  LEFT JOIN client c ON c.site_id = s.id
`;

const SITE_GROUP_BY = `
  GROUP BY s.id
`;

/* ============================================================
   LIST
============================================================ */

export async function findSites(): Promise<SiteRow[]> {
  const result = await pool.query<SiteRow>(
    `
      ${SITE_SELECT}
      ${SITE_GROUP_BY}
      ORDER BY s.created_at DESC
    `
  );

  return result.rows;
}

/* ============================================================
   FIND BY ID
============================================================ */

export async function findSiteById(
  id: string
): Promise<SiteRow | null> {
  const result = await pool.query<SiteRow>(
    `
      ${SITE_SELECT}
      WHERE s.id = $1
      ${SITE_GROUP_BY}
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

/* ============================================================
   UPDATE
============================================================ */

export interface UpdateSiteData {
  name?: string;
  code?: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  district?: string | null;
  timezone?: string | null;
  status?: SiteRow["status"];
}

export async function updateSite(
  id: string,
  data: UpdateSiteData
): Promise<SiteRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  function set(column: string, value: unknown) {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  }

  if (data.name !== undefined) set("name", data.name);
  if (data.code !== undefined) set("code", data.code);
  if (data.description !== undefined)
    set("description", data.description);
  if (data.address !== undefined)
    set("address", data.address);
  if (data.city !== undefined) set("city", data.city);
  if (data.region !== undefined) set("region", data.region);
  if (data.district !== undefined)
    set("district", data.district);
  if (data.timezone !== undefined)
    set("timezone", data.timezone);
  if (data.status !== undefined)
    set("status", data.status);

  if (fields.length === 0) {
    return findSiteById(id);
  }

  fields.push("updated_at = NOW()");
  values.push(id);

  await pool.query(
    `
      UPDATE site
      SET ${fields.join(", ")}
      WHERE id = $${values.length}
    `,
    values
  );

  return findSiteById(id);
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteSite(id: string): Promise<void> {
  await pool.query(`DELETE FROM site WHERE id = $1`, [id]);
}

/* ============================================================
   INSERT
============================================================ */

export async function insertSite(
  data: CreateSiteData
): Promise<SiteRow> {
  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO site (
        organization_id,
        name,
        code,
        description,
        address,
        city,
        region,
        district,
        timezone
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
      RETURNING id
    `,
    [
      data.organizationId,
      data.name,
      data.code,
      data.description ?? null,
      data.address ?? null,
      data.city ?? null,
      data.region ?? null,
      data.district ?? null,
      data.timezone ?? null,
    ]
  );

  const created = await findSiteById(result.rows[0].id);

  if (!created) {
    throw new Error(
      "Le site n'a pas pu être créé."
    );
  }

  return created;
}
