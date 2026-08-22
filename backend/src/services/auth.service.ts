import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { pool } from "../database/pool.js";
import { env } from "../config/env.js";
import { badRequest, unauthorized } from "../lib/errors.js";

import type {
  AuthPermission,
  AuthRole,
  AuthTokenPayload,
  AuthUser,
  LoginInput,
} from "../domain/iam/auth.types.js";

export async function login(
  input: LoginInput
): Promise<{
  token: string;
  user: AuthUser;
}> {
  const username = input.username.trim();

  if (!username || !input.password) {
    throw badRequest("Identifiant et mot de passe requis.");
  }

  const client = await pool.connect();

  try {
    /*
     * ============================================================
     * USER
     * ============================================================
     */

    const userResult = await client.query(
      `
      SELECT
        u.id,
        u.organization_id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.password_hash,
        u.status
      FROM "user" u
      WHERE LOWER(u.username) = LOWER($1)
      LIMIT 1
      `,
      [username]
    );

    if (userResult.rowCount === 0) {
      throw unauthorized("Identifiants invalides.");
    }

    const dbUser = userResult.rows[0];

    /*
     * ============================================================
     * PASSWORD
     *
     * Vérifié AVANT le statut du compte : un attaquant qui ne
     * connaît pas le mot de passe ne doit jamais pouvoir savoir
     * si le compte existe, ni s'il est actif/bloqué/inactif.
     * ============================================================
     */

    const passwordValid = await bcrypt.compare(
      input.password,
      dbUser.password_hash
    );

    if (!passwordValid) {
      throw unauthorized("Identifiants invalides.");
    }

    /*
     * ============================================================
     * STATUS
     * ============================================================
     */

    if (dbUser.status !== "ACTIVE") {
      throw unauthorized(
        `Compte ${dbUser.status.toLowerCase()}.`
      );
    }

    /*
     * ============================================================
     * ROLES + PERMISSIONS
     * ============================================================
     */

    const rolesResult = await client.query(
      `
      SELECT
        r.id AS role_id,
        r.name AS role_name,
        r.code AS role_code,

        p.id AS permission_id,
        p.name AS permission_name,
        p.code AS permission_code,
        p.resource AS permission_resource,
        p.action AS permission_action

      FROM user_role ur

      INNER JOIN role r
        ON r.id = ur.role_id

      LEFT JOIN role_permission rp
        ON rp.role_id = r.id

      LEFT JOIN permission p
        ON p.id = rp.permission_id

      WHERE ur.user_id = $1
        AND r.status = 'ACTIVE'

      ORDER BY r.name, p.name
      `,
      [dbUser.id]
    );

    const roleMap = new Map<string, AuthRole>();

    for (const row of rolesResult.rows) {
      if (!roleMap.has(row.role_id)) {
        roleMap.set(row.role_id, {
          id: row.role_id,
          name: row.role_name,
          code: row.role_code,
          permissions: [],
        });
      }

      if (row.permission_id) {
        const role = roleMap.get(row.role_id)!;

        role.permissions.push({
          id: row.permission_id,
          name: row.permission_name,
          code: row.permission_code,
          resource: row.permission_resource,
          action: row.permission_action,
        });
      }
    }

    const roles = Array.from(roleMap.values());

    /*
     * ============================================================
     * UPDATE LAST LOGIN
     * ============================================================
     */

    await client.query(
      `
      UPDATE "user"
      SET
        last_login_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      `,
      [dbUser.id]
    );

    /*
     * ============================================================
     * AUTH USER
     * ============================================================
     */

    const user: AuthUser = {
      id: dbUser.id,
      organizationId: dbUser.organization_id,
      username: dbUser.username,
      email: dbUser.email,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      status: dbUser.status,
      roles,
    };

    /*
     * ============================================================
     * JWT
     * ============================================================
     */

    const payload: AuthTokenPayload = {
      sub: user.id,
      organizationId: user.organizationId,
      username: user.username,
    };

    const token = jwt.sign(payload, env.jwtSecret, {
      expiresIn: "8h",
    });

    return {
      token,
      user,
    };
  } finally {
    client.release();
  }
}