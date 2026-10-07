import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { pool } from "../database/pool.js";
import { env } from "../config/env.js";
import { badRequest, unauthorized } from "../lib/errors.js";

const SALT_ROUNDS = 12;

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
        u.phone,
        u.first_name,
        u.last_name,
        u.password_hash,
        u.status,
        u.email_verified,
        u.created_at,
        u.updated_at
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
      phone: dbUser.phone,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      status: dbUser.status,
      emailVerified: dbUser.email_verified,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date(dbUser.created_at).toISOString(),
      updatedAt: new Date().toISOString(),
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

/* ============================================================
   CURRENT USER
============================================================ */

export async function getCurrentUser(userId: string): Promise<AuthUser & {
  phone: string | null;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}> {
  const userResult = await pool.query(
    `
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
        u.created_at AS "createdAt",
        u.updated_at AS "updatedAt"
      FROM "user" u
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId]
  );

  if (userResult.rowCount === 0) {
    throw unauthorized("Utilisateur introuvable.");
  }

  const dbUser = userResult.rows[0];

  const rolesResult = await pool.query(
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
    [userId]
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
      roleMap.get(row.role_id)!.permissions.push({
        id: row.permission_id,
        name: row.permission_name,
        code: row.permission_code,
        resource: row.permission_resource,
        action: row.permission_action,
      });
    }
  }

  return {
    id: dbUser.id,
    organizationId: dbUser.organizationId,
    username: dbUser.username,
    email: dbUser.email,
    phone: dbUser.phone,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    status: dbUser.status,
    emailVerified: dbUser.emailVerified,
    lastLoginAt: dbUser.lastLoginAt
      ? new Date(dbUser.lastLoginAt).toISOString()
      : null,
    createdAt: new Date(dbUser.createdAt).toISOString(),
    updatedAt: new Date(dbUser.updatedAt).toISOString(),
    roles: Array.from(roleMap.values()),
  };
}

/* ============================================================
   CHANGE OWN PASSWORD
============================================================ */

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (newPassword.length < 8) {
    throw badRequest(
      "Le nouveau mot de passe doit contenir au moins 8 caractères."
    );
  }

  const result = await pool.query<{ password_hash: string }>(
    `SELECT password_hash FROM "user" WHERE id = $1`,
    [userId]
  );

  if (result.rowCount === 0) {
    throw unauthorized("Utilisateur introuvable.");
  }

  const valid = await bcrypt.compare(
    currentPassword,
    result.rows[0].password_hash
  );

  if (!valid) {
    throw unauthorized("Mot de passe actuel incorrect.");
  }

  if (currentPassword === newPassword) {
    throw badRequest(
      "Le nouveau mot de passe doit être différent de l'ancien."
    );
  }

  const passwordHash = await bcrypt.hash(
    newPassword,
    SALT_ROUNDS
  );

  await pool.query(
    `
      UPDATE "user"
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `,
    [passwordHash, userId]
  );
}
