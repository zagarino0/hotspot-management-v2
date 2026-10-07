import { pool } from "../../database/pool.js";

export interface SiteProfilePriceRow {
  code: string;
  name: string;
  durationSeconds: number | null;
  price: number;
  currency: string;
  defaultPrice: number;
}

export async function findSiteProfilePrices(
  siteId: string
): Promise<SiteProfilePriceRow[]> {
  const result = await pool.query<SiteProfilePriceRow>(
    `
      SELECT
        p.code,
        p.name,
        p.duration_seconds AS "durationSeconds",
        COALESCE(sp.price, p.default_price)::float8 AS price,
        COALESCE(sp.currency, p.currency) AS currency,
        p.default_price::float8 AS "defaultPrice"
      FROM hotspot_profile p
      LEFT JOIN site_hotspot_profile_price sp
        ON sp.profile_code = p.code
       AND sp.site_id = $1
      WHERE p.status = 'ACTIVE'
      ORDER BY p.duration_seconds NULLS LAST, p.code
    `,
    [siteId]
  );

  return result.rows;
}

export async function upsertSiteProfilePrice(
  siteId: string,
  profileCode: string,
  price: number,
  currency = "MGA"
): Promise<SiteProfilePriceRow | null> {
  await pool.query(
    `
      INSERT INTO site_hotspot_profile_price (
        site_id,
        profile_code,
        price,
        currency,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (site_id, profile_code)
      DO UPDATE SET
        price = EXCLUDED.price,
        currency = EXCLUDED.currency,
        updated_at = NOW()
    `,
    [siteId, profileCode, price, currency]
  );

  const result = await pool.query<SiteProfilePriceRow>(
    `
      SELECT
        p.code,
        p.name,
        p.duration_seconds AS "durationSeconds",
        sp.price::float8 AS price,
        sp.currency,
        p.default_price::float8 AS "defaultPrice"
      FROM site_hotspot_profile_price sp
      JOIN hotspot_profile p
        ON p.code = sp.profile_code
      WHERE sp.site_id = $1
        AND sp.profile_code = $2
    `,
    [siteId, profileCode]
  );

  return result.rows[0] ?? null;
}

export async function findSiteById(siteId: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM site WHERE id = $1 LIMIT 1",
    [siteId]
  );

  return result.rowCount === 1;
}
