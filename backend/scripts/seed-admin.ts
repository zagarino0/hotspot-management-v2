import bcrypt from "bcryptjs";
import { pool } from "../src/database/pool.js";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  throw new Error(
    "ADMIN_PASSWORD est obligatoire pour exécuter le seed."
  );
}

const permissions = [
  ["Lire les organisations", "organization:read", "organization", "read"],
  ["Gérer les organisations", "organization:write", "organization", "write"],

  ["Lire les sites", "site:read", "site", "read"],
  ["Gérer les sites", "site:write", "site", "write"],

  ["Lire les routeurs", "router:read", "router", "read"],
  ["Gérer les routeurs", "router:write", "router", "write"],

  ["Lire les points d'accès", "access_point:read", "access_point", "read"],
  ["Gérer les points d'accès", "access_point:write", "access_point", "write"],

  ["Lire les forfaits", "plan:read", "plan", "read"],
  ["Gérer les forfaits", "plan:write", "plan", "write"],

  ["Lire les vouchers", "voucher:read", "voucher", "read"],
  ["Gérer les vouchers", "voucher:write", "voucher", "write"],

  ["Lire les clients", "client:read", "client", "read"],
  ["Gérer les clients", "client:write", "client", "write"],

  ["Lire les sessions", "session:read", "session", "read"],

  ["Lire les ventes", "sale:read", "sale", "read"],
  ["Gérer les ventes", "sale:write", "sale", "write"],

  ["Lire les paiements", "payment:read", "payment", "read"],
  ["Gérer les paiements", "payment:write", "payment", "write"],

  ["Lire les utilisateurs", "user:read", "user", "read"],
  ["Gérer les utilisateurs", "user:write", "user", "write"],

  ["Lire les rôles", "role:read", "role", "read"],
  ["Gérer les rôles", "role:write", "role", "write"],
] as const;

async function seedAdmin(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * ============================================================
     * ORGANIZATION
     * ============================================================
     */

    const organizationResult = await client.query(
      `
      INSERT INTO organization (
        name,
        code,
        description,
        country,
        timezone,
        currency,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'ACTIVE'
      )
      ON CONFLICT (code)
      DO UPDATE SET
        updated_at = NOW()
      RETURNING id
      `,
      [
        "Hotspot Management",
        "HMV2",
        "Organisation principale de HOTSPOT MANAGEMENT V2",
        "Madagascar",
        "Indian/Antananarivo",
        "MGA",
      ]
    );

    const organizationId = organizationResult.rows[0].id;

    console.log(
      `Organisation : ${organizationId}`
    );

    /*
     * ============================================================
     * PERMISSIONS
     * ============================================================
     */

    const permissionIds: string[] = [];

    for (const [
      name,
      code,
      resource,
      action,
    ] of permissions) {
      const result = await client.query(
        `
        INSERT INTO permission (
          name,
          code,
          resource,
          action
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (code)
        DO UPDATE SET
          name = EXCLUDED.name,
          resource = EXCLUDED.resource,
          action = EXCLUDED.action
        RETURNING id
        `,
        [name, code, resource, action]
      );

      permissionIds.push(result.rows[0].id);
    }

    console.log(
      `Permissions créées/vérifiées : ${permissionIds.length}`
    );

    /*
     * ============================================================
     * ADMIN ROLE
     * ============================================================
     */

    const roleResult = await client.query(
      `
      INSERT INTO role (
        organization_id,
        name,
        code,
        description,
        status,
        is_system
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'ACTIVE',
        true
      )
      ON CONFLICT (
        organization_id,
        code
      )
      DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = 'ACTIVE',
        updated_at = NOW()
      RETURNING id
      `,
      [
        organizationId,
        "Administrateur",
        "ADMIN",
        "Administrateur complet de l'organisation",
      ]
    );

    const roleId = roleResult.rows[0].id;

    console.log(`Rôle ADMIN : ${roleId}`);

    /*
     * ============================================================
     * ROLE PERMISSIONS
     * ============================================================
     */

    for (const permissionId of permissionIds) {
      await client.query(
        `
        INSERT INTO role_permission (
          role_id,
          permission_id
        )
        VALUES ($1, $2)
        ON CONFLICT (
          role_id,
          permission_id
        )
        DO NOTHING
        `,
        [roleId, permissionId]
      );
    }

    /*
     * ============================================================
     * ADMIN USER
     * ============================================================
     */

    const passwordHash = await bcrypt.hash(
      ADMIN_PASSWORD,
      12
    );

    const userResult = await client.query(
      `
      INSERT INTO "user" (
        organization_id,
        username,
        password_hash,
        status,
        email_verified
      )
      VALUES (
        $1,
        $2,
        $3,
        'ACTIVE',
        false
      )
      ON CONFLICT (
        organization_id,
        username
      )
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        status = 'ACTIVE',
        updated_at = NOW()
      RETURNING id
      `,
      [
        organizationId,
        ADMIN_USERNAME,
        passwordHash,
      ]
    );

    const userId = userResult.rows[0].id;

    console.log(`Utilisateur ADMIN : ${userId}`);

    /*
     * ============================================================
     * USER ROLE
     * ============================================================
     */

    await client.query(
      `
      INSERT INTO user_role (
        user_id,
        role_id,
        scope,
        site_id
      )
      VALUES (
        $1,
        $2,
        'ORGANIZATION',
        NULL
      )
      ON CONFLICT (
        user_id,
        role_id,
        site_id
      )
      DO NOTHING
      `,
      [userId, roleId]
    );

    await client.query("COMMIT");

    console.log("");
    console.log("========================================");
    console.log(" IAM INITIALISÉ AVEC SUCCÈS");
    console.log("========================================");
    console.log(`Username : ${ADMIN_USERNAME}`);
    console.log("Scope    : ORGANIZATION");
    console.log("Role     : ADMIN");
    console.log("========================================");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedAdmin().catch((error) => {
  console.error("Erreur seed IAM :", error);
  process.exit(1);
});




