import bcrypt from "bcryptjs";
import { pool } from "../src/database/pool.js";

/*
 * ============================================================
 * SEED ADMIN
 *
 * Ce script ne fait QUE :
 *   1. Créer/mettre à jour l'organisation par défaut
 *   2. Créer/mettre à jour l'utilisateur admin
 *   3. Lui attribuer le rôle système "ADMIN"
 *
 * Les permissions et les rôles système (SUPER_ADMIN, ADMIN,
 * TECHNICIAN, OPERATOR) sont déjà créés par la migration
 * `007_iam_seed.sql` — ce script ne les recrée PAS.
 *
 * AVANT : ce script recréait sa propre copie des permissions et
 * du rôle ADMIN avec une convention de code différente
 * ("site:write") de celle de la migration ("SITE_MANAGE"),
 * produisant deux jeux de permissions redondants et
 * incohérents en base après un `npm run migrate && npm run seed`.
 * ============================================================
 */

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  throw new Error(
    "ADMIN_PASSWORD est obligatoire pour exécuter le seed."
  );
}

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
        name, code, description, country, timezone, currency, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
      ON CONFLICT (code)
      DO UPDATE SET updated_at = NOW()
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

    console.log(`Organisation : ${organizationId}`);

    /*
     * ============================================================
     * RÔLE SYSTÈME "ADMIN"
     * Déjà créé par la migration 007_iam_seed.sql
     * (organization_id IS NULL, is_system = true). On le
     * recherche, on ne le recrée jamais ici.
     * ============================================================
     */

    const roleResult = await client.query(
      `
      SELECT id
      FROM role
      WHERE code = 'ADMIN'
        AND organization_id IS NULL
      LIMIT 1
      `
    );

    if (roleResult.rowCount === 0) {
      throw new Error(
        "Rôle système ADMIN introuvable. Avez-vous bien exécuté toutes les migrations (007_iam_seed.sql) avant ce script ?"
      );
    }

    const roleId = roleResult.rows[0].id;

    console.log(`Rôle ADMIN (système) : ${roleId}`);

    /*
     * ============================================================
     * ADMIN USER
     * ============================================================
     */

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const userResult = await client.query(
      `
      INSERT INTO "user" (
        organization_id, username, password_hash, status, email_verified
      )
      VALUES ($1, $2, $3, 'ACTIVE', false)
      ON CONFLICT (organization_id, username)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        status = 'ACTIVE',
        updated_at = NOW()
      RETURNING id
      `,
      [organizationId, ADMIN_USERNAME, passwordHash]
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
      INSERT INTO user_role (user_id, role_id, scope, site_id)
      VALUES ($1, $2, 'ORGANIZATION', NULL)
      ON CONFLICT (user_id, role_id, site_id)
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
    console.log("Role     : ADMIN (système)");
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
