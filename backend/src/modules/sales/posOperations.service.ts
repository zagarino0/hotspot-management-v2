import { pool } from "../../database/pool.js";
import { badRequest, forbidden, notFoundError } from "../../lib/errors.js";
import { isValidClosureTime } from "./posOperations.rules.js";

const TIME_ZONE = "Indian/Antananarivo";

async function assertPermission(userId: string, organizationId: string, code: string) {
  const result = await pool.query(
    `SELECT 1
       FROM user_role ur
       JOIN role r ON r.id = ur.role_id AND r.status = 'ACTIVE'
       JOIN role_permission rp ON rp.role_id = r.id
       JOIN permission p ON p.id = rp.permission_id
      WHERE ur.user_id = $1 AND p.code = $2
        AND (r.organization_id = $3 OR r.organization_id IS NULL)
      LIMIT 1`,
    [userId, code, organizationId],
  );
  if (!result.rows[0]) throw forbidden("Permission insuffisante pour cette opération.");
}

async function readSettingsRow(organizationId: string) {
  await pool.query(
    `INSERT INTO pos_sales_settings (organization_id) VALUES ($1)
     ON CONFLICT (organization_id) DO NOTHING`,
    [organizationId],
  );
  const result = await pool.query(
    `SELECT organization_id AS "organizationId",
            auto_closure_enabled AS "autoClosureEnabled",
            to_char(closure_time, 'HH24:MI') AS "closureTime",
            timezone,
            detect_sale_on_first_use AS "detectSaleOnFirstUse",
            updated_by AS "updatedBy",
            updated_at AS "updatedAt"
       FROM pos_sales_settings WHERE organization_id = $1`,
    [organizationId],
  );
  return result.rows[0];
}

export async function getPosSalesSettings(userId: string, organizationId: string) {
  await assertPermission(userId, organizationId, "POS_SALES_SETTINGS_READ");
  return readSettingsRow(organizationId);
}

export async function updatePosSalesSettings(
  userId: string,
  organizationId: string,
  input: { autoClosureEnabled?: boolean; closureTime?: string; detectSaleOnFirstUse?: boolean },
) {
  await assertPermission(userId, organizationId, "POS_SALES_SETTINGS_UPDATE");
  if (input.autoClosureEnabled !== undefined && typeof input.autoClosureEnabled !== "boolean") {
    throw badRequest("autoClosureEnabled doit être un booléen.");
  }
  if (input.detectSaleOnFirstUse !== undefined && typeof input.detectSaleOnFirstUse !== "boolean") {
    throw badRequest("detectSaleOnFirstUse doit être un booléen.");
  }
  if (input.closureTime !== undefined && !isValidClosureTime(input.closureTime)) {
    throw badRequest("L'heure de clôture doit respecter le format HH:mm (00:00–23:59).");
  }

  await pool.query(
    `INSERT INTO pos_sales_settings
       (organization_id, auto_closure_enabled, closure_time, timezone, detect_sale_on_first_use, updated_by, updated_at)
     VALUES ($1, COALESCE($2, TRUE), COALESCE($3::time, TIME '20:00'), $4, COALESCE($5, TRUE), $6, NOW())
     ON CONFLICT (organization_id) DO UPDATE SET
       auto_closure_enabled = COALESCE($2, pos_sales_settings.auto_closure_enabled),
       closure_time = COALESCE($3::time, pos_sales_settings.closure_time),
       detect_sale_on_first_use = COALESCE($5, pos_sales_settings.detect_sale_on_first_use),
       updated_by = $6,
       updated_at = NOW()`,
    [organizationId, input.autoClosureEnabled ?? null, input.closureTime ?? null, TIME_ZONE, input.detectSaleOnFirstUse ?? null, userId],
  );
  return readSettingsRow(organizationId);
}

export async function listPosRemittances(
  userId: string,
  organizationId: string,
  pointOfSaleId: string,
  from?: string,
  to?: string,
) {
  await assertPermission(userId, organizationId, "POS_REMITTANCES_READ");
  const pos = await pool.query(
    `SELECT id FROM point_of_sale
      WHERE id = $1 AND organization_id = $2 AND type = 'EXTERNAL'`,
    [pointOfSaleId, organizationId],
  );
  if (!pos.rows[0]) throw notFoundError("Point de vente externe introuvable.");
  const result = await pool.query(
    `SELECT r.* FROM point_of_sale_remittance r
      WHERE r.point_of_sale_id = $1
        AND ($2::date IS NULL OR r.business_date >= $2::date)
        AND ($3::date IS NULL OR r.business_date <= $3::date)
      ORDER BY r.business_date DESC, r.remitted_at DESC LIMIT 120`,
    [pointOfSaleId, from ?? null, to ?? null],
  );
  return result.rows;
}

export async function listPosClosureAudit(
  userId: string,
  organizationId: string,
  pointOfSaleId: string,
  from?: string,
  to?: string,
) {
  await assertPermission(userId, organizationId, "POS_DAILY_CLOSURES_READ");
  const pos = await pool.query(
    `SELECT id FROM point_of_sale
      WHERE id = $1 AND organization_id = $2 AND type = 'EXTERNAL'`,
    [pointOfSaleId, organizationId],
  );
  if (!pos.rows[0]) throw notFoundError("Point de vente externe introuvable.");
  const result = await pool.query(
    `SELECT a.*, c.business_date AS "businessDate", c.point_of_sale_id AS "pointOfSaleId"
       FROM point_of_sale_closure_audit a
       JOIN point_of_sale_daily_closure c ON c.id = a.closure_id
      WHERE c.point_of_sale_id = $1
        AND ($2::date IS NULL OR c.business_date >= $2::date)
        AND ($3::date IS NULL OR c.business_date <= $3::date)
      ORDER BY a.created_at DESC LIMIT 200`,
    [pointOfSaleId, from ?? null, to ?? null],
  );
  return result.rows;
}

export async function recordPosRemittance(
  userId: string,
  organizationId: string,
  pointOfSaleId: string,
  input: { businessDate: string; remittedAmount: number; remittedBy?: string | null; note?: string | null },
) {
  await assertPermission(userId, organizationId, "POS_REMITTANCES_CREATE");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.businessDate)) {
    throw badRequest("La date doit respecter le format YYYY-MM-DD.");
  }
  const date = new Date(input.businessDate + "T00:00:00Z");
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.businessDate) {
    throw badRequest("Date de versement invalide.");
  }
  if (!Number.isFinite(input.remittedAmount) || input.remittedAmount < 0) {
    throw badRequest("Le montant versé doit être positif ou nul.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pos = await client.query(
      `SELECT id FROM point_of_sale
        WHERE id = $1 AND organization_id = $2 AND type = 'EXTERNAL' FOR UPDATE`,
      [pointOfSaleId, organizationId],
    );
    if (!pos.rows[0]) throw notFoundError("Point de vente externe introuvable.");

    const closure = await client.query<{ netRevenue: string }>(
      `SELECT net_revenue::text AS "netRevenue"
         FROM point_of_sale_daily_closure
        WHERE point_of_sale_id = $1 AND business_date = $2::date AND status = 'CLOSED'
        FOR UPDATE`,
      [pointOfSaleId, input.businessDate],
    );
    if (!closure.rows[0]) {
      throw badRequest("La clôture de cette journée doit exister avant l'enregistrement du versement.");
    }
    const expectedAmount = Number(closure.rows[0].netRevenue);
    if (expectedAmount < 0) {
      throw badRequest("La recette nette est négative; vérifiez les remboursements avant d'enregistrer le versement.");
    }
    const remittedBy = input.remittedBy?.trim() || null;
    if (remittedBy) {
      const remitter = await client.query(
        `SELECT id FROM "user" WHERE id = $1 AND organization_id = $2 LIMIT 1`,
        [remittedBy, organizationId],
      );
      if (!remitter.rows[0]) throw badRequest("Le remettant doit appartenir à l'organisation du point de vente.");
    }
    const result = await client.query(
      `INSERT INTO point_of_sale_remittance
        (point_of_sale_id, business_date, currency, expected_amount, remitted_amount, remitted_by, recorded_by, note)
       VALUES ($1, $2::date, 'MGA', $3, $4, $5, $6, $7)
       RETURNING *`,
      [pointOfSaleId, input.businessDate, expectedAmount, input.remittedAmount, remittedBy, userId, input.note?.trim() || null],
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
