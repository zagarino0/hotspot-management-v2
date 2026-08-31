import { pool } from "../src/database/pool.js";

/* ============================================================
   CHECK ROUTER IP
   Vérifie l'IP actuelle du routeur dans la base de données
============================================================ */

async function checkRouterIp() {
  console.log("🔍 Vérification de l'IP du routeur...");

  try {
    const result = await pool.query(`
      SELECT id, name, management_ip::text as management_ip, api_port
      FROM router
    `);

    console.log(`📁 ${result.rows.length} routeur(s) trouvé(s)`);

    for (const router of result.rows) {
      console.log(`Routeur: ${router.name}`);
      console.log(`  ID: ${router.id}`);
      console.log(`  IP: ${router.management_ip}`);
      console.log(`  Port: ${router.apiPort}`);
    }
  } catch (error) {
    console.error("💥 Erreur:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkRouterIp();
