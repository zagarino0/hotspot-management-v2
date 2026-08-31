import { pool } from "../src/database/pool.js";

async function checkVoucherBatchColumns() {
  try {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'voucher_batch' ORDER BY ordinal_position`
    );
    console.log("Colonnes de la table voucher_batch:");
    result.rows.forEach((row) => {
      console.log(`- ${row.column_name}`);
    });
    process.exit(0);
  } catch (error) {
    console.error("Erreur:", error);
    process.exit(1);
  }
}

checkVoucherBatchColumns();
