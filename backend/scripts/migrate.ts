import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { pool } from "../src/database/pool.js";

/* ============================================================
   MIGRATION SCRIPT
   Exécute les fichiers SQL dans l'ordre numérique :
   004_network.sql doit précéder 004_1_network_integrity.sql.
============================================================ */

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

function compareMigrationNames(a: string, b: string): number {
  const parse = (file: string) => {
    const match = /^(\d+)(?:_(\d+))?_/.exec(file);
    return {
      major: match ? Number(match[1]) : Number.MAX_SAFE_INTEGER,
      minor: match?.[2] ? Number(match[2]) : 0,
      name: file,
    };
  };

  const left = parse(a);
  const right = parse(b);

  return (
    left.major - right.major ||
    left.minor - right.minor ||
    left.name.localeCompare(right.name)
  );
}

async function runMigrations() {
  console.log("🚀 Début des migrations PostgreSQL...");

  try {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort(compareMigrationNames);

    console.log(`📁 ${files.length} fichier(s) de migration trouvé(s)`);

    for (const file of files) {
      const filePath = join(MIGRATIONS_DIR, file);
      const sql = readFileSync(filePath, "utf-8");

      console.log(`⚙️  Exécution de ${file}...`);

      try {
        await pool.query(sql);
        console.log(`✅ ${file} exécuté avec succès`);
      } catch (error: any) {
        // Ignorer les objets/colonnes déjà présents et les doublons de seed.
        if (
          error.code === "42P07" ||
          error.code === "23505" ||
          error.code === "42701" ||
          error.message.includes("existe déjà")
        ) {
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
