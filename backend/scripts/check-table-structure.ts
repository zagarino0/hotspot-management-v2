import { pool } from "../src/database/pool.js";

/* ============================================================
   CHECK TABLE STRUCTURE
   Vérifie la structure de la table router
============================================================ */

async function checkTableStructure() {
  console.log("🔍 Vérification de la structure de la table router...");

  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'router'
      ORDER BY ordinal_position
    `);

    console.log(`📁 ${result.rows.length} colonne(s) trouvée(s)`);

    for (const column of result.rows) {
      console.log(`  ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`);
    }
  } catch (error) {
    console.error("💥 Erreur:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkTableStructure();
