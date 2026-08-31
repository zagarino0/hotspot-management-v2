import { pool } from "../src/database/pool.js";

/* ============================================================
   FIX ROUTER SIMPLE
   Corrige l'IP et le port du routeur avec SQL direct
============================================================ */

async function fixRouterSimple() {
  console.log("🔧 Correction simple du routeur...");

  try {
    const routerId = "283bcdc5-ca99-49d4-8f12-fb25a9fc4e3e";

    // Corriger l'IP et le port avec SQL direct
    await pool.query(`
      UPDATE router
      SET management_ip = '192.168.88.1',
          api_port = 8728
      WHERE id = $1
    `, [routerId]);

    console.log("✅ Routeur corrigé");

    // Vérifier
    const result = await pool.query(`
      SELECT id, name, management_ip, api_port
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

fixRouterSimple();
