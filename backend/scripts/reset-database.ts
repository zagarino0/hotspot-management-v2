import { pool } from "../src/database/pool.js";

async function resetDatabase() {
  console.log("⚠️  REMISE À ZÉRO DE LA BASE DE DONNÉES ⚠️");
  console.log("Suppression de toutes les données... (structure conservée)");

  try {
    await pool.query("BEGIN");

    // Désactiver temporairement les contraintes de clé étrangère
    await pool.query("SET CONSTRAINTS ALL DEFERRED");

    // Liste des tables à vider dans l'ordre pour respecter les contraintes de clé étrangère
    const tables = [
      "voucher",
      "voucher_batch",
      "session",
      "sale",
      "payment_transaction",
      "payment",
      "access_point",
      "ap_radio",
      "device",
      "router_credential",
      "router",
      "plan",
      "site",
      "client",
      "user_role",
      "role_permission",
      "role",
      "permission",
      "\"user\"",
      "organization",
    ];

    for (const table of tables) {
      try {
        // Utiliser TRUNCATE avec CASCADE pour ignorer les contraintes
        const result = await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
        console.log(`✅ Table ${table} vidée`);
      } catch (error: any) {
        if (error.code === "42P01") {
          console.log(`⏭️  Table ${table} n'existe pas (ignorée)`);
        } else {
          console.error(`❌ Erreur pour la table ${table}:`, error.message);
        }
      }
    }

    // Réactiver les contraintes
    await pool.query("SET CONSTRAINTS ALL IMMEDIATE");

    await pool.query("COMMIT");
    console.log("✨ Base de données remise à zéro avec succès !");
    console.log("ℹ️  Structure des tables conservée");
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("💥 Erreur lors de la remise à zéro:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetDatabase();
