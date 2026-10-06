import { pool } from "../src/database/pool.js";

/* ============================================================
   FIX ROUTER PORT
   Corrige uniquement le port du routeur
============================================================ */

async function fixRouterPort() {
  console.log("🔧 Correction du port du routeur...");

  try {
    const routerId = "283bcdc5-ca99-49d4-8f12-fb25a9fc4e3e";

    // Corriger le port
    await pool.query(`
      UPDATE router
      SET api_port = 8728
      WHERE id = $1
    `, [routerId]);

    console.log("✅ Port corrigé");

    // Vérifier
    const result = await pool.query(`
      SELECT id, name, management_ip, api_port
      FROM router
      WHERE id = $1
    `, [routerId]);

    const router = result.rows[0];
    console.log(`📋 Vérification complète:`);
    console.log(`  IP: ${router.management_ip}`);
    console.log(`  Port: ${router.apiPort}`);
  } catch (error) {
    console.error("💥 Erreur:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixRouterPort();
