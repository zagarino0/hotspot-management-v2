import { pool } from "../src/database/pool.js";

/* ============================================================
   FIX ROUTER COMPLETE
   Corrige l'IP et le port du routeur
============================================================ */

async function fixRouterComplete() {
  console.log("🔧 Correction complète du routeur...");

  try {
    const routerId = "283bcdc5-ca99-49d4-8f12-fb25a9fc4e3e";

    // Corriger l'IP et le port
    await pool.query(`
      UPDATE router
      SET management_ip = '192.168.88.1'::inet,
          api_port = 8728
      WHERE id = $1
    `, [routerId]);

    console.log("✅ Routeur corrigé : IP et port mis à jour");

    // Vérifier
    const result = await pool.query(`
      SELECT id, name, management_ip::text as management_ip, api_port
      FROM router
      WHERE id = $1
    `, [routerId]);

    const router = result.rows[0];
    console.log(`📋 Vérification:`);
    console.log(`  IP: ${router.management_ip}`);
    console.log(`  Port: ${router.apiPort}`);
  } catch (error) {
    console.error("💥 Erreur:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixRouterComplete();
