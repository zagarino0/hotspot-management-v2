import { pool } from "../src/database/pool.js";

/* ============================================================
   CHECK ROUTER PORT RAW
   Vérifie la valeur brute du port
============================================================ */

async function checkRouterPortRaw() {
  console.log("🔍 Vérification brute du port...");

  try {
    const result = await pool.query(`
      SELECT api_port
      FROM router
      WHERE id = '283bcdc5-ca99-49d4-8f12-fb25a9fc4e3e'
    `);

    console.log(`📁 ${result.rows.length} résultat(s)`);

    if (result.rows.length > 0) {
      const port = result.rows[0].api_port;
      console.log(`  Port brut: ${port}`);
      console.log(`  Type: ${typeof port}`);
      console.log(`  Est NULL: ${port === null}`);
    }
  } catch (error) {
    console.error("💥 Erreur:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkRouterPortRaw();
