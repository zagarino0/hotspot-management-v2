import { pool } from "../../database/pool.js";
import { encryptSecret } from "../../lib/crypto.js";

import type {
  CreateRouterData,
  RouterListRow,
} from "../../routes/router.types.js";

/* ============================================================
   SELECT
============================================================ */

const ROUTER_SELECT = `
  SELECT
    id,
    site_id AS "siteId",
    name,
    code,
    vendor,
    model,

    serial_number AS "serialNumber",
    mac_address AS "macAddress",

    management_ip::text AS "managementIp",

    api_port AS "apiPort",
    api_protocol AS "apiProtocol",

    identity,
    router_os_version AS "routerOsVersion",

    status,

    last_seen_at AS "lastSeenAt",
    last_check_at AS "lastCheckAt",

    uptime_seconds AS "uptimeSeconds",

    cpu_usage AS "cpuUsage",
    memory_usage AS "memoryUsage",

    last_error AS "lastError",

    sync_enabled AS "syncEnabled",
    last_sync_at AS "lastSyncAt",
    sync_status AS "syncStatus",

    created_at AS "createdAt",
    updated_at AS "updatedAt"

  FROM router
`;

/* ============================================================
   INSERT TYPE
============================================================ */

export interface InsertRouterData
  extends CreateRouterData {
  identity?: string | null;
  model?: string | null;
  routerOsVersion?: string | null;
  uptimeSeconds?: number | null;
}
/* ============================================================
   LIST
============================================================ */

export async function findRouters(): Promise<RouterListRow[]> {
  const result = await pool.query<RouterListRow>(
    `
      ${ROUTER_SELECT}
      ORDER BY created_at DESC
    `
  );

  return result.rows;
}

/* ============================================================
   FIND BY ID
============================================================ */

export async function findRouterById(
  id: string
): Promise<RouterListRow | null> {
  const result = await pool.query<RouterListRow>(
    `
      ${ROUTER_SELECT}
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

/* ============================================================
   FIND ROUTERS FOR SYNC
   Routeurs éligibles au sync live : sync_enabled = true et une
   adresse de gestion connue.
============================================================ */

export interface RouterForSync {
  id: string;
  siteId: string;
  name: string;
  managementIp: string;
  apiPort: number;
  domainName?: string;
}

export async function findRoutersForSync(): Promise<
  RouterForSync[]
> {
  const result = await pool.query<RouterForSync>(
    `
      SELECT
        id,
        site_id AS "siteId",
        name,
        management_ip::text AS "managementIp",
        api_port AS "apiPort",
        domain_name AS "domainName"
      FROM router
      WHERE sync_enabled = true
        AND management_ip IS NOT NULL
    `
  );

  return result.rows;
}

/* ============================================================
   FIND ROUTER CREDENTIAL
   Identifiant actif le plus récent pour ce routeur.
============================================================ */

export interface RouterCredentialRow {
  username: string;
  encryptedSecret: string;
}

export async function findRouterCredential(
  routerId: string
): Promise<RouterCredentialRow | null> {
  const result = await pool.query<RouterCredentialRow>(
    `
      SELECT
        username,
        encrypted_secret AS "encryptedSecret"
      FROM router_credential
      WHERE router_id = $1
        AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [routerId]
  );

  return result.rows[0] ?? null;
}

/* ============================================================
   UPDATE ROUTER HEALTH
   Appelé après chaque tentative de sync (succès ou échec) pour
   refléter l'état réel du routeur.
============================================================ */

export interface RouterHealthUpdate {
  routerId: string;
  reachable: boolean;
  errorMessage?: string | null;
}

export async function updateRouterHealth(
  update: RouterHealthUpdate
): Promise<void> {
  await pool.query(
    `
      UPDATE router
      SET
        status = $2,
        last_check_at = NOW(),
        last_seen_at = CASE
          WHEN $3 THEN NOW()
          ELSE last_seen_at
        END,
        last_error = $4,
        sync_status = $5,
        last_sync_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `,
    [
      update.routerId,
      update.reachable ? "ONLINE" : "OFFLINE",
      update.reachable,
      update.errorMessage ?? null,
      update.reachable ? "SUCCESS" : "FAILED",
    ]
  );
}

/* ============================================================
   UPDATE
============================================================ */

export interface UpdateRouterData {
  name?: string;
  model?: string | null;
  managementIp?: string;
  apiPort?: number;
  syncEnabled?: boolean;
}

export async function updateRouter(
  id: string,
  data: UpdateRouterData
): Promise<RouterListRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  function set(column: string, value: unknown, cast = "") {
    values.push(value);
    fields.push(`${column} = $${values.length}${cast}`);
  }

  if (data.name !== undefined) set("name", data.name);
  if (data.model !== undefined) set("model", data.model);
  if (data.managementIp !== undefined)
    set("management_ip", data.managementIp, "::inet");
  if (data.apiPort !== undefined)
    set("api_port", data.apiPort);
  if (data.syncEnabled !== undefined)
    set("sync_enabled", data.syncEnabled);

  if (fields.length === 0) {
    return findRouterById(id);
  }

  fields.push("updated_at = NOW()");
  values.push(id);

  await pool.query(
    `
      UPDATE router
      SET ${fields.join(", ")}
      WHERE id = $${values.length}
    `,
    values
  );

  return findRouterById(id);
}

/* ============================================================
   DELETE
   Le routeur ne peut être supprimé tant qu'il a des identifiants
   actifs (contrainte RESTRICT) : on les retire d'abord, dans la
   même transaction que la suppression du routeur.
============================================================ */

export async function deleteRouter(id: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM router_credential WHERE router_id = $1`,
      [id]
    );

    await client.query(
      `DELETE FROM router WHERE id = $1`,
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
   INSERT ROUTER
============================================================ */

export async function insertRouter(
  data: InsertRouterData
): Promise<RouterListRow> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* --------------------------------------------------------
       INSERT ROUTER
    -------------------------------------------------------- */

    const routerResult =
      await client.query<RouterListRow>(
        `
          INSERT INTO router (
            site_id,
            name,
            code,
            vendor,
            model,
            management_ip,
            api_port,
            api_protocol,
            identity,
            router_os_version,
            status,
            last_seen_at,
            last_check_at,
            uptime_seconds,
            sync_status
          )
          VALUES (
            $1,
            $2,
            $3,
            'MikroTik',
            $4,
            $5::inet,
            $6,
            'API',
            $7,
            $8,
            'ONLINE',
            NOW(),
            NOW(),
            $9,
            'SUCCESS'
          )

          RETURNING
            id,
            site_id AS "siteId",
            name,
            code,
            vendor,
            model,

            serial_number AS "serialNumber",
            mac_address AS "macAddress",

            management_ip::text AS "managementIp",

            api_port AS "apiPort",
            api_protocol AS "apiProtocol",

            identity,
            router_os_version AS "routerOsVersion",

            status,

            last_seen_at AS "lastSeenAt",
            last_check_at AS "lastCheckAt",

            uptime_seconds AS "uptimeSeconds",

            cpu_usage AS "cpuUsage",
            memory_usage AS "memoryUsage",

            last_error AS "lastError",

            sync_enabled AS "syncEnabled",
            last_sync_at AS "lastSyncAt",
            sync_status AS "syncStatus",

            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [
          data.siteId,
          data.name,
          data.code,
          data.model ?? null,
          data.host,
          data.port,
          data.identity ?? null,
          data.routerOsVersion ?? null,
          data.uptimeSeconds ?? null,
        ]
      );

    const router = routerResult.rows[0];

    if (!router) {
      throw new Error(
        "Le routeur n'a pas pu être créé."
      );
    }

    /* --------------------------------------------------------
       INSERT CREDENTIAL

       Le mot de passe MikroTik est chiffré (AES-256-GCM) avant
       d'être stocké. Ce n'est plus le mot de passe en clair.
    -------------------------------------------------------- */

    const encryptedSecret = encryptSecret(data.password);

    await client.query(
      `
        INSERT INTO router_credential (
          router_id,
          username,
          encrypted_secret,
          is_active
        )
        VALUES (
          $1,
          $2,
          $3,
          true
        )
      `,
      [
        router.id,
        data.username,
        encryptedSecret,
      ]
    );

    /* --------------------------------------------------------
       COMMIT
    -------------------------------------------------------- */

    await client.query("COMMIT");

    return router;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}