import { pool } from "../src/database/pool.js";
import { encryptSecret } from "../src/lib/crypto.js";

/* ============================================================
   UPDATE ROUTER PASSWORD
   Met à jour le mot de passe du routeur dans la base de données
============================================================ */

async function updateRouterPassword() {
  console.log("🔧 Mise à jour du mot de passe du routeur...");

  try {
    // Trouver le routeur
    const routerResult = await pool.query(`
      SELECT id, name
      FROM router
      WHERE name ILIKE '%MAHAVOKY%'
    `);

    if (routerResult.rows.length === 0) {
      console.log("❌ Aucun routeur trouvé");
      process.exit(1);
    }

    const router = routerResult.rows[0];
    console.log(`📋 Routeur trouvé: ${router.name} (${router.id})`);

    // Chiffrer le nouveau mot de passe
    const newPassword = "admin";
    const encryptedPassword = encryptSecret(newPassword);

    // Désactiver les anciens credentials
    await pool.query(`
      UPDATE router_credential
      SET is_active = false
      WHERE router_id = $1
    `, [router.id]);

    // Insérer le nouveau credential
    await pool.query(`
      INSERT INTO router_credential (router_id, username, encrypted_secret, is_active)
      VALUES ($1, $2, $3, true)
    `, [router.id, "admin", encryptedPassword]);

    console.log("✅ Mot de passe mis à jour avec succès!");
  } catch (error) {
    console.error("💥 Erreur lors de la mise à jour:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateRouterPassword();
