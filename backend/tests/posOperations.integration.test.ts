import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/database/pool.js";
import {
  getPosSalesSettings,
  recordPosRemittance,
  listPosRemittances,
  updatePosSalesSettings,
} from "../src/modules/sales/posOperations.service.js";
import { AppError } from "../src/lib/errors.js";
import { listDailyClosures } from "../src/modules/sales/pointOfSaleDaily.service.js";

test("PostgreSQL POS operations integration: configurable closure time and remittance difference", async (t) => {
  const suffix = randomUUID();
  const orgId = randomUUID();
  const posId = randomUUID();
  const internalPosId = randomUUID();
  const internalClosureId = randomUUID();
  const noPermissionUserId = randomUUID();
  const userId = randomUUID();
  const roleId = randomUUID();
  const closureId = randomUUID();
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Indian/Antananarivo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const dateValues = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
  const businessDate = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
  let seeded = false;

  t.after(async () => {
    if (seeded) {
      await pool.query("DELETE FROM point_of_sale_remittance WHERE point_of_sale_id=ANY($1::uuid[])", [[posId, internalPosId]]);
      await pool.query("DELETE FROM point_of_sale_closure_audit WHERE closure_id=$1", [closureId]);
      await pool.query("DELETE FROM point_of_sale_daily_closure WHERE id=ANY($1::uuid[])", [[closureId, internalClosureId]]);
      await pool.query("DELETE FROM pos_sales_settings WHERE organization_id=$1", [orgId]);
      await pool.query("DELETE FROM user_role WHERE user_id=$1", [userId]);
      await pool.query("DELETE FROM role_permission WHERE role_id=$1", [roleId]);
      await pool.query('DELETE FROM "user" WHERE id=$1', [userId]);
      await pool.query("DELETE FROM role WHERE id=$1", [roleId]);
      await pool.query("DELETE FROM point_of_sale WHERE id=ANY($1::uuid[])", [[posId, internalPosId]]);
      await pool.query("DELETE FROM organization WHERE id=$1", [orgId]);
    }
    await pool.end();
  });

  await pool.query("INSERT INTO organization (id,name,code) VALUES ($1,$2,$3)", [orgId, "POS operations integration", `POS-OPS-${suffix}`]);
  seeded = true;
  await pool.query("INSERT INTO point_of_sale (id,organization_id,code,name,type) VALUES ($1,$2,$3,$4,'EXTERNAL')", [posId, orgId, `POS-${suffix}`, "POS operations integration"]);
  await pool.query("INSERT INTO point_of_sale (id,organization_id,code,name,type) VALUES ($1,$2,$3,$4,'INTERNAL')", [internalPosId, orgId, `INT-${suffix}`, "Internal POS operations integration"]);
  await pool.query('INSERT INTO "user" (id,organization_id,username,password_hash,status) VALUES ($1,$2,$3,$4,$5)', [userId, orgId, `pos-ops-${suffix}`, "test-only-hash", "ACTIVE"]);
  await pool.query("INSERT INTO role (id,organization_id,name,code,status) VALUES ($1,$2,$3,$4,'ACTIVE')", [roleId, orgId, "POS operations test", `POS_OPS_IT_${suffix}`]);

  const codes = ["POS_SALES_SETTINGS_READ", "POS_SALES_SETTINGS_UPDATE", "POS_REMITTANCES_CREATE", "POS_REMITTANCES_READ", "POS_DAILY_CLOSURES_READ"];
  const permissions = await pool.query("SELECT id,code FROM permission WHERE code=ANY($1::text[])", [codes]);
  assert.equal(permissions.rows.length, codes.length, "migration 025 must create the required permissions");
  for (const permission of permissions.rows) {
    await pool.query("INSERT INTO role_permission (role_id,permission_id) VALUES ($1,$2)", [roleId, permission.id]);
  }
  await pool.query("INSERT INTO user_role (user_id,role_id,scope) VALUES ($1,$2,'ORGANIZATION')", [userId, roleId]);

  const initial = await getPosSalesSettings(userId, orgId);
  assert.equal(initial.closureTime, "20:00");
  assert.equal(initial.timezone, "Indian/Antananarivo");

  const updated = await updatePosSalesSettings(userId, orgId, {
    closureTime: "21:15",
    autoClosureEnabled: true,
    detectSaleOnFirstUse: true,
  });
  assert.equal(updated.closureTime, "21:15");

  await pool.query(
    `INSERT INTO point_of_sale_daily_closure
      (id,point_of_sale_id,business_date,currency,net_revenue,gross_revenue,refunds,status,closed_at)
     VALUES ($1,$2,$3::date,'MGA',20000,20000,0,'CLOSED',NOW())`,
    [closureId, posId, businessDate],
  );
  await pool.query("INSERT INTO point_of_sale_daily_closure (id,point_of_sale_id,business_date,currency,net_revenue,gross_revenue,refunds,status,closed_at) VALUES ($1,$2,$3::date,'MGA',2500,2500,0,'CLOSED',NOW())", [internalClosureId, internalPosId, businessDate]);
  const remittance = await recordPosRemittance(userId, orgId, posId, {
    businessDate,
    remittedAmount: 18000,
    note: "Test d'écart de versement",
  });
  assert.equal(Number(remittance.expected_amount), 20000);
  assert.equal(Number(remittance.remitted_amount), 18000);
  assert.equal(Number(remittance.difference), -2000);

  const internalRemittance = await recordPosRemittance(userId, orgId, internalPosId, { businessDate, remittedAmount: 2500, note: "Versement interne" });
  assert.equal(Number(internalRemittance.expected_amount), 2500);
  assert.equal(Number(internalRemittance.remitted_amount), 2500);
  assert.equal(Number(internalRemittance.difference), 0);
  const internalRemittances = await listPosRemittances(userId, orgId, internalPosId, businessDate, businessDate);
  assert.equal(internalRemittances.length, 1, "authorized users can read internal POS remittances");
  const internalClosures = await listDailyClosures(internalPosId, userId, businessDate, businessDate);
  assert.equal(internalClosures.length, 1, "authorized users can read internal POS daily closures");
  await assert.rejects(recordPosRemittance(userId, orgId, internalPosId, { businessDate, remittedAmount: 2500 }), (error) => error instanceof AppError && error.statusCode === 409, "duplicate internal remittance must be rejected");
  await assert.rejects(recordPosRemittance(noPermissionUserId, orgId, internalPosId, { businessDate, remittedAmount: 2500 }), (error) => error instanceof AppError && error.statusCode === 403, "unauthorized internal remittance must be rejected");

  await assert.rejects(
    updatePosSalesSettings(userId, orgId, { closureTime: "25:61" }),
    (error) => error instanceof AppError && error.statusCode === 400,
    "invalid closure times must be rejected",
  );
});
