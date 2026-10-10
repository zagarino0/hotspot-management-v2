import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/database/pool.js";
import {
  getPosSalesSettings,
  recordPosRemittance,
  updatePosSalesSettings,
} from "../src/modules/sales/posOperations.service.js";
import { AppError } from "../src/lib/errors.js";

test("PostgreSQL POS operations integration: configurable closure time and remittance difference", async (t) => {
  const suffix = randomUUID();
  const orgId = randomUUID();
  const posId = randomUUID();
  const userId = randomUUID();
  const roleId = randomUUID();
  const closureId = randomUUID();
  const businessDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Indian/Antananarivo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  let seeded = false;

  t.after(async () => {
    if (seeded) {
      await pool.query("DELETE FROM point_of_sale_remittance WHERE point_of_sale_id=$1", [posId]);
      await pool.query("DELETE FROM point_of_sale_closure_audit WHERE closure_id=$1", [closureId]);
      await pool.query("DELETE FROM point_of_sale_daily_closure WHERE id=$1", [closureId]);
      await pool.query("DELETE FROM pos_sales_settings WHERE organization_id=$1", [orgId]);
      await pool.query("DELETE FROM user_role WHERE user_id=$1", [userId]);
      await pool.query("DELETE FROM role_permission WHERE role_id=$1", [roleId]);
      await pool.query('DELETE FROM "user" WHERE id=$1', [userId]);
      await pool.query("DELETE FROM role WHERE id=$1", [roleId]);
      await pool.query("DELETE FROM point_of_sale WHERE id=$1", [posId]);
      await pool.query("DELETE FROM organization WHERE id=$1", [orgId]);
    }
    await pool.end();
  });

  await pool.query("INSERT INTO organization (id,name,code) VALUES ($1,$2,$3)", [orgId, "POS operations integration", `POS-OPS-${suffix}`]);
  seeded = true;
  await pool.query("INSERT INTO point_of_sale (id,organization_id,code,name,type) VALUES ($1,$2,$3,$4,'EXTERNAL')", [posId, orgId, `POS-${suffix}`, "POS operations integration"]);
  await pool.query('INSERT INTO "user" (id,organization_id,username,password_hash,status) VALUES ($1,$2,$3,$4,$5)', [userId, orgId, `pos-ops-${suffix}`, "test-only-hash", "ACTIVE"]);
  await pool.query("INSERT INTO role (id,organization_id,name,code,status) VALUES ($1,$2,$3,$4,'ACTIVE')", [roleId, orgId, "POS operations test", `POS_OPS_IT_${suffix}`]);

  const codes = ["POS_SALES_SETTINGS_READ", "POS_SALES_SETTINGS_UPDATE", "POS_REMITTANCES_CREATE"];
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
  const remittance = await recordPosRemittance(userId, orgId, posId, {
    businessDate,
    remittedAmount: 18000,
    note: "Test d'écart de versement",
  });
  assert.equal(Number(remittance.expected_amount), 20000);
  assert.equal(Number(remittance.remitted_amount), 18000);
  assert.equal(Number(remittance.difference), -2000);

  await assert.rejects(
    updatePosSalesSettings(userId, orgId, { closureTime: "25:61" }),
    (error) => error instanceof AppError && error.statusCode === 400,
    "invalid closure times must be rejected",
  );
});
