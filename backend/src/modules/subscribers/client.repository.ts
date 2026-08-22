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

      COUNT(s.id)::int AS "sessionsCount"

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

        COUNT(s.id)::int AS "sessionsCount"

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
  };
}