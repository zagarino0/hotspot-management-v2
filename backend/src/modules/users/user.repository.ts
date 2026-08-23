import bcrypt from "bcryptjs";

import { pool } from "../../database/pool.js";

import type {
  CreateUserData,
  UpdateUserData,
  UserRow,
} from "../../routes/user.types.js";

const SALT_ROUNDS = 12;

/* ============================================================
   SELECT
   Les rôles sont agrégés via json_agg pour éviter les allers-
   retours multiples ; NULL (aucun rôle) devient un tableau vide.
============================================================ */

const USER_SELECT = `
  SELECT
    u.id,
    u.organization_id AS "organizationId",

    u.username,
    u.email,
    u.phone,

    u.first_name AS "firstName",
    u.last_name AS "lastName",

    u.status,

    u.email_verified AS "emailVerified",
    u.last_login_at AS "lastLoginAt",

    COALESCE(roles.roles, '[]'::json) AS roles,

    u.created_at AS "createdAt",
    u.updated_at AS "updatedAt"

  FROM "user" u
  LEFT JOIN LATERAL (
    SELECT json_agg(
      json_build_object(
        'id', r.id,
        'name', r.name,
        'code', r.code
      )
      ORDER BY r.name
    ) AS roles
    FROM user_role ur
    JOIN role r ON r.id = ur.role_id
    WHERE ur.user_id = u.id
  ) roles ON true
`;

/* ============================================================
   LIST
============================================================ */

export async function findUsers(): Promise<UserRow[]> {
  const result = await pool.query<UserRow>(
    `
      ${USER_SELECT}
      ORDER BY u.created_at DESC
    `
  );

  return result.rows;
}

/* ============================================================
   FIND BY ID
============================================================ */

export async function findUserById(
  id: string
): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `
      ${USER_SELECT}
      WHERE u.id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

/* ============================================================
   INSERT (+ attribution des rôles, scope ORGANIZATION)
============================================================ */

export async function insertUser(
  data: CreateUserData
): Promise<UserRow> {
  const passwordHash = await bcrypt.hash(
    data.password,
    SALT_ROUNDS
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query<{ id: string }>(
      `
        INSERT INTO "user" (
          organization_id,
          username,
          email,
          phone,
          first_name,
          last_name,
          password_hash,
          status
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
        RETURNING id
      `,
      [
        data.organizationId,
        data.username,
        data.email ?? null,
        data.phone ?? null,
        data.firstName ?? null,
        data.lastName ?? null,
        passwordHash,
        data.status ?? "INVITED",
      ]
    );

    const userId = userResult.rows[0].id;

    for (const roleId of data.roleIds ?? []) {
      await client.query(
        `
          INSERT INTO user_role (
            user_id, role_id, scope
          )
          VALUES ($1, $2, 'ORGANIZATION')
        `,
        [userId, roleId]
      );
    }

    await client.query("COMMIT");

    const created = await findUserById(userId);

    if (!created) {
      throw new Error("L'utilisateur n'a pas pu être créé.");
    }

    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/* ============================================================
   UPDATE
============================================================ */

export async function updateUser(
  id: string,
  data: UpdateUserData
): Promise<UserRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  function set(column: string, value: unknown) {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  }

  if (data.email !== undefined) set("email", data.email);
  if (data.phone !== undefined) set("phone", data.phone);
  if (data.firstName !== undefined)
    set("first_name", data.firstName);
  if (data.lastName !== undefined)
    set("last_name", data.lastName);
  if (data.status !== undefined) set("status", data.status);

  if (data.password) {
    const passwordHash = await bcrypt.hash(
      data.password,
      SALT_ROUNDS
    );
    set("password_hash", passwordHash);
  }

  if (fields.length === 0) {
    return findUserById(id);
  }

  fields.push("updated_at = NOW()");
  values.push(id);

  await pool.query(
    `
      UPDATE "user"
      SET ${fields.join(", ")}
      WHERE id = $${values.length}
    `,
    values
  );

  return findUserById(id);
}

/* ============================================================
   SET ROLES (remplace toutes les attributions ORGANIZATION)
============================================================ */

export async function setUserRoles(
  userId: string,
  roleIds: string[]
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        DELETE FROM user_role
        WHERE user_id = $1
          AND scope = 'ORGANIZATION'
      `,
      [userId]
    );

    for (const roleId of roleIds) {
      await client.query(
        `
          INSERT INTO user_role (user_id, role_id, scope)
          VALUES ($1, $2, 'ORGANIZATION')
        `,
        [userId, roleId]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/* ============================================================
   DELETE
   user_role référence user_id en RESTRICT : on retire d'abord
   les attributions de rôle, dans la même transaction.
============================================================ */

export async function deleteUser(id: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM user_role WHERE user_id = $1`,
      [id]
    );

    await client.query(
      `DELETE FROM "user" WHERE id = $1`,
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
