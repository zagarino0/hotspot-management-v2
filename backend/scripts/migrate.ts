import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { pool } from "../src/database/pool.js";

/* ============================================================
   MIGRATION SCRIPT
   Exécute tous les fichiers SQL dans le dossier migrations
   dans l'ordre numérique
============================================================ */

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

async function runMigrations() {
  console.log("🚀 Début des migrations PostgreSQL...");

  try {
    // Récupérer tous les fichiers de migration
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort(); // Tri alphabétique (001, 002, etc.)

    console.log(`📁 ${files.length} fichier(s) de migration trouvé(s)`);

    for (const file of files) {
      const filePath = join(MIGRATIONS_DIR, file);
      const sql = readFileSync(filePath, "utf-8");

      console.log(`⚙️  Exécution de ${file}...`);

      try {
        await pool.query(sql);
        console.log(`✅ ${file} exécuté avec succès`);
      } catch (error: any) {
        // Ignorer les erreurs de relations existantes (42P07)
        // Ignorer les erreurs de clés dupliquées (23505) pour les fichiers de seed
        // Ignorer les erreurs de colonnes existantes (42701)
        if (error.code === '42P07' || error.code === '23505' || error.code === '42701' || error.message.includes('existe déjà')) {
          console.log(`⏭️  ${file} ignoré (colonne/objet existe déjà)`);
        } else {
          console.error(`❌ Erreur lors de l'exécution de ${file}:`, error.message);
          throw error;
        }
      }
    }

    console.log("✨ Toutes les migrations ont été exécutées avec succès!");
  } catch (error) {
    console.error("💥 Erreur lors des migrations:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
