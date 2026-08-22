import { pool } from "../../database/pool.js";

import type {
  AccessPointRow,
  CreateAccessPointData,
} from "../../routes/accessPoint.types.js";

/* ============================================================
   SELECT
============================================================ */

const ACCESS_POINT_SELECT = `
  SELECT
    ap.id,

    ap.site_id AS "siteId",
    s.name AS "siteName",

    ap.router_id AS "routerId",
    r.name AS "routerName",

    ap.name,
    ap.code,

    ap.vendor,
    ap.model,

    ap.serial_number AS "serialNumber",
    ap.mac_address AS "macAddress",

    ap.management_ip::text AS "managementIp",

    ap.status,

    radio.ssid,
    radio.band,

    ap.created_at AS "createdAt",
    ap.updated_at AS "updatedAt"

  FROM access_point ap
  JOIN site s ON s.id = ap.site_id
  LEFT JOIN router r ON r.id = ap.router_id
  LEFT JOIN LATERAL (
    SELECT ssid, band
    FROM ap_radio
    WHERE ap_radio.access_point_id = ap.id
    ORDER BY ap_radio.created_at ASC
    LIMIT 1
  ) radio ON true
`;

/* ============================================================
   LIST
============================================================ */

export async function findAccessPoints(): Promise<
  AccessPointRow[]
> {
  const result = await pool.query<AccessPointRow>(
    `
      ${ACCESS_POINT_SELECT}
      ORDER BY ap.created_at DESC
    `
  );

  return result.rows;
}

/* ============================================================
   FIND BY ID
============================================================ */

export async function findAccessPointById(
  id: string
): Promise<AccessPointRow | null> {
  const result = await pool.query<AccessPointRow>(
    `
      ${ACCESS_POINT_SELECT}
      WHERE ap.id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

/* ============================================================
   UPDATE
============================================================ */

export interface UpdateAccessPointData {
  name?: string;
  routerId?: string | null;
  vendor?: string | null;
  model?: string | null;
  macAddress?: string | null;
  managementIp?: string | null;
}

export async function updateAccessPoint(
  id: string,
  data: UpdateAccessPointData
): Promise<AccessPointRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  function set(column: string, value: unknown, cast = "") {
    values.push(value);
    fields.push(`${column} = $${values.length}${cast}`);
  }

  if (data.name !== undefined) set("name", data.name);
  if (data.routerId !== undefined)
    set("router_id", data.routerId);
  if (data.vendor !== undefined) set("vendor", data.vendor);
  if (data.model !== undefined) set("model", data.model);
  if (data.macAddress !== undefined)
    set("mac_address", data.macAddress);
  if (data.managementIp !== undefined)
    set("management_ip", data.managementIp, "::inet");

  if (fields.length === 0) {
    return findAccessPointById(id);
  }

  fields.push("updated_at = NOW()");
  values.push(id);

  await pool.query(
    `
      UPDATE access_point
      SET ${fields.join(", ")}
      WHERE id = $${values.length}
    `,
    values
  );

  return findAccessPointById(id);
}

/* ============================================================
   DELETE
   ap_radio référence access_point en RESTRICT : on retire les
   radios d'abord, dans la même transaction.
============================================================ */

export async function deleteAccessPoint(
  id: string
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM ap_radio WHERE access_point_id = $1`,
      [id]
    );

    await client.query(
      `DELETE FROM access_point WHERE id = $1`,
      [id]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/* ============================================================
   INSERT (access_point + radio principale facultative)
============================================================ */

export async function insertAccessPoint(
  data: CreateAccessPointData
): Promise<AccessPointRow> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const apResult = await client.query<{ id: string }>(
      `
        INSERT INTO access_point (
          site_id,
          router_id,
          name,
          code,
          vendor,
          model,
          mac_address,
          management_ip,
          status
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::inet, 'UNKNOWN'
        )
        RETURNING id
      `,
      [
        data.siteId,
        data.routerId ?? null,
        data.name,
        data.code,
        data.vendor ?? null,
        data.model ?? null,
        data.macAddress ?? null,
        data.managementIp ?? null,
      ]
    );

    const accessPointId = apResult.rows[0].id;

    if (data.ssid) {
      await client.query(
        `
          INSERT INTO ap_radio (
            access_point_id,
            name,
            band,
            ssid,
            enabled,
            status
          )
          VALUES (
            $1, 'radio-0', $2, $3, true, 'UNKNOWN'
          )
        `,
        [
          accessPointId,
          data.band ?? "2.4GHZ",
          data.ssid,
        ]
      );
    }

    await client.query("COMMIT");

    const created = await findAccessPointById(accessPointId);

    if (!created) {
      throw new Error(
        "Le point d'accès n'a pas pu être créé."
      );
    }

    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
