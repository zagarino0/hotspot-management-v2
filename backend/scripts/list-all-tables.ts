import { pool } from "../src/database/pool.js";

async function listAllTables() {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log("Toutes les tables de la base de données:");
    result.rows.forEach((row) => {
      console.log(`- ${row.table_name}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("Erreur:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

listAllTables();
