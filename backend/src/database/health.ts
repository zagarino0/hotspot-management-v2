import { pool } from "./pool.js";

export async function checkDatabase(): Promise<{
  connected: boolean;
  database: string;
  version: string;
}> {
  const result = await pool.query<{
    current_database: string;
    version: string;
  }>(`
    SELECT
      current_database(),
      version()
  `);

  return {
    connected: true,
    database: result.rows[0].current_database,
    version: result.rows[0].version,
  };
}