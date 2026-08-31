import { pool } from "../src/database/pool.js";

/* ============================================================
   FIX ROUTER IP
   Corrige les IP de management qui contiennent un masque CIDR
   Ex: 192.168.88.1/32 → 192.168.88.1
============================================================ */

async function fixRouterIp() {
  console.log("🔧 Correction des IP de routeur...");

  try {
    // Voir les routeurs actuels
    const result = await pool.query(`
      SELECT id, name, management_ip::text as management_ip, api_port
      FROM router
    `);

    console.log(`📁 ${result.rows.length} routeur(s) trouvé(s)`);

    for (const router of result.rows) {
      const currentIp = router.management_ip;
      console.log(`Routeur: ${router.name}`);
      console.log(`  IP actuelle: ${currentIp}`);

      // Extraire l'IP sans le masque CIDR
      const cleanIp = currentIp?.split('/')[0];

      if (cleanIp && cleanIp !== currentIp) {
        console.log(`  Correction: ${currentIp} → ${cleanIp}`);

        await pool.query(`
          UPDATE router
          SET management_ip = $1::inet
          WHERE id = $2
        `, [cleanIp, router.id]);

        console.log(`  ✅ IP corrigée`);
      } else {
        console.log(`  ℹ️  IP déjà correcte`);
      }
    }

    console.log("✨ Correction terminée!");
  } catch (error) {
    console.error("💥 Erreur lors de la correction:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixRouterIp();
