import { pool } from "../../database/pool.js";

import type {
  CreateRoleData,
  PermissionRow,
  RoleRow,
  UpdateRoleData,
} from "../../routes/role.types.js";

/* ============================================================
   SELECT (liste) — compteurs agrégés, pas le détail des
   permissions (récupéré séparément pour l'édition).
============================================================ */

const ROLE_SELECT = `
  SELECT
    r.id,
    r.organization_id AS "organizationId",

    r.name,
    r.code,
    r.description,

    r.status,
    r.is_system AS "isSystem",

    COUNT(DISTINCT rp.permission_id) AS "permissionCount",
    COUNT(DISTINCT ur.user_id) AS "userCount",

    r.created_at AS "createdAt",
    r.updated_at AS "updatedAt"

  FROM role r
  LEFT JOIN role_permission rp ON rp.role_id = r.id
  LEFT JOIN user_role ur ON ur.role_id = r.id
`;

const ROLE_GROUP_BY = `GROUP BY r.id`;

/* ============================================================
   LIST
============================================================ */

export async function findRoles(): Promise<RoleRow[]> {
  const result = await pool.query<RoleRow>(
    `
      ${ROLE_SELECT}
      ${ROLE_GROUP_BY}
      ORDER BY r.is_system DESC, r.name ASC
    `
  );

  return result.rows;
}

/* ============================================================
   FIND BY ID
============================================================ */

export async function findRoleById(
  id: string
): Promise<RoleRow | null> {
  const result = await pool.query<RoleRow>(
    `
      ${ROLE_SELECT}
      WHERE r.id = $1
      ${ROLE_GROUP_BY}
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

/* ============================================================
   PERMISSIONS ATTRIBUÉES À UN RÔLE (juste les IDs, pour
   préremplir les cases à cocher du formulaire d'édition)
============================================================ */

export async function findRolePermissionIds(
  roleId: string
): Promise<string[]> {
  const result = await pool.query<{ permissionId: string }>(
    `
      SELECT permission_id AS "permissionId"
      FROM role_permission
      WHERE role_id = $1
    `,
    [roleId]
  );

  return result.rows.map((row) => row.permissionId);
}

/* ============================================================
   CATALOGUE COMPLET DES PERMISSIONS DISPONIBLES
============================================================ */

export async function findAllPermissions(): Promise<
  PermissionRow[]
> {
  const result = await pool.query<PermissionRow>(
    `
      SELECT
        id,
        name,
        code,
        resource,
        action,
        description
      FROM permission
      ORDER BY resource ASC, action ASC
    `
  );

  return result.rows;
}

/* ============================================================
   INSERT (+ attribution des permissions initiales)
============================================================ */

export async function insertRole(
  data: CreateRoleData
): Promise<RoleRow> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const roleResult = await client.query<{ id: string }>(
      `
        INSERT INTO role (
          organization_id,
          name,
          code,
          description,
          status,
          is_system
        )
        VALUES ($1, $2, $3, $4, 'ACTIVE', false)
        RETURNING id
      `,
      [
        data.organizationId,
        data.name,
        data.code,
        data.description ?? null,
      ]
    );

    const roleId = roleResult.rows[0].id;

    for (const permissionId of data.permissionIds) {
      await client.query(
        `
          INSERT INTO role_permission (role_id, permission_id)
          VALUES ($1, $2)
        `,
        [roleId, permissionId]
      );
    }

    await client.query("COMMIT");

    const created = await findRoleById(roleId);

    if (!created) {
      throw new Error("Le rôle n'a pas pu être créé.");
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
   UPDATE (+ remplacement optionnel des permissions)
============================================================ */

export async function updateRole(
  id: string,
  data: UpdateRoleData
): Promise<RoleRow | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const fields: string[] = [];
    const values: unknown[] = [];

    function set(column: string, value: unknown) {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    }

    if (data.name !== undefined) set("name", data.name);
    if (data.description !== undefined)
      set("description", data.description);
    if (data.status !== undefined)
      set("status", data.status);

    if (fields.length > 0) {
      fields.push("updated_at = NOW()");
      values.push(id);

      await client.query(
        `
          UPDATE role
          SET ${fields.join(", ")}
          WHERE id = $${values.length}
        `,
        values
      );
    }

    if (data.permissionIds !== undefined) {
      await client.query(
        `DELETE FROM role_permission WHERE role_id = $1`,
        [id]
      );

      for (const permissionId of data.permissionIds) {
        await client.query(
          `
            INSERT INTO role_permission (role_id, permission_id)
            VALUES ($1, $2)
          `,
          [id, permissionId]
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return findRoleById(id);
}

/* ============================================================
   DELETE
   role_permission référence role_id en RESTRICT : on retire
   d'abord les permissions attribuées, dans la même transaction.
   (La vérification is_system / userCount > 0 est faite dans le
   service, avant d'appeler cette fonction.)
============================================================ */

export async function deleteRole(id: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM role_permission WHERE role_id = $1`,
      [id]
    );

    await client.query(`DELETE FROM role WHERE id = $1`, [
      id,
    ]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
