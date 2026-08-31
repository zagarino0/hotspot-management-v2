import { pool } from "../src/database/pool.js";

async function checkRouterColumns() {
  try {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'router' ORDER BY ordinal_position`
    );
    console.log("Colonnes de la table router:");
    result.rows.forEach((row) => {
      console.log(`- ${row.column_name}`);
    });
    process.exit(0);
  } catch (error) {
    console.error("Erreur:", error);
    process.exit(1);
  }
}

checkRouterColumns();
