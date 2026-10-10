import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/database/pool.js";
import { closeFinancialDay, refreshClosedDay } from "../src/modules/sales/posOperations.scheduler.js";
import { addDays, localDate } from "../src/modules/sales/posOperations.rules.js";

test("PostgreSQL: automatic financial closure and audited late correction", async (t) => {
  const suffix = randomUUID();
  const orgId = randomUUID();
  const siteId = randomUUID();
  const posId = randomUUID();
  const autoDate = addDays(localDate(), -1);
  let seeded = false;

  t.after(async () => {
    if (seeded) {
      await pool.query("DELETE FROM point_of_sale_closure_audit WHERE closure_id IN (SELECT id FROM point_of_sale_daily_closure WHERE point_of_sale_id=$1)", [posId]);
      await pool.query("DELETE FROM point_of_sale_ticket_event WHERE point_of_sale_id=$1", [posId]);
      await pool.query("DELETE FROM point_of_sale_daily_closure WHERE point_of_sale_id=$1", [posId]);
      await pool.query("DELETE FROM point_of_sale_remittance WHERE point_of_sale_id=$1", [posId]);
      await pool.query("DELETE FROM pos_sales_settings WHERE organization_id=$1", [orgId]);
      await pool.query("DELETE FROM point_of_sale WHERE id=$1", [posId]);
      await pool.query("DELETE FROM site WHERE id=$1", [siteId]);
      await pool.query("DELETE FROM organization WHERE id=$1", [orgId]);
    }
    await pool.end();
  });

  await pool.query("INSERT INTO organization (id,name,code) VALUES ($1,$2,$3)", [orgId, "POS closure integration", "POS-CLOSE-" + suffix]);
  seeded = true;
  await pool.query("INSERT INTO site (id,organization_id,name,code) VALUES ($1,$2,$3,$4)", [siteId, orgId, "POS closure site", "SITE-CLOSE-" + suffix]);
  await pool.query("INSERT INTO point_of_sale (id,organization_id,code,name,type) VALUES ($1,$2,$3,$4,'EXTERNAL')", [posId, orgId, "POS-CLOSE-" + suffix, "POS closure integration"]);

  await pool.query(
    "INSERT INTO point_of_sale_ticket_event (point_of_sale_id,site_id,voucher_code,event_type,unit_price,currency,source,event_key,metadata,occurred_at) VALUES ($1,$2,$3,'SOLD',1000,'MGA','SYSTEM',$4,'{}'::jsonb,($5::date + TIME '10:00') AT TIME ZONE 'Indian/Antananarivo')",
    [posId, siteId, "AUTO-" + suffix, "auto-sale-" + suffix, autoDate],
  );

  await closeFinancialDay(posId, autoDate);
  const initialResult = await pool.query(
    "SELECT id,status,tickets_sold,gross_revenue,stock_review_required FROM point_of_sale_daily_closure WHERE point_of_sale_id=$1 AND business_date=$2::date",
    [posId, autoDate],
  );
  assert.equal(initialResult.rows[0].status, "CLOSED");
  assert.equal(Number(initialResult.rows[0].tickets_sold), 1);
  assert.equal(Number(initialResult.rows[0].gross_revenue), 1000);
  assert.equal(initialResult.rows[0].stock_review_required, true);

  await pool.query(
    "INSERT INTO point_of_sale_ticket_event (point_of_sale_id,site_id,voucher_code,event_type,unit_price,currency,source,event_key,metadata,occurred_at) VALUES ($1,$2,$3,'SOLD',2500,'MGA','SYSTEM',$4,'{"lateDetection":true}'::jsonb,($5::date + TIME '11:00') AT TIME ZONE 'Indian/Antananarivo')",
    [posId, siteId, "LATE-" + suffix, "late-sale-" + suffix, autoDate],
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await refreshClosedDay(client, initialResult.rows[0].id, "Intégration: détection tardive");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const corrected = await pool.query(
    "SELECT status,tickets_sold,gross_revenue FROM point_of_sale_daily_closure WHERE id=$1",
    [initialResult.rows[0].id],
  );
  assert.equal(corrected.rows[0].status, "CLOSED");
  assert.equal(Number(corrected.rows[0].tickets_sold), 2);
  assert.equal(Number(corrected.rows[0].gross_revenue), 3500);

  const audit = await pool.query("SELECT action FROM point_of_sale_closure_audit WHERE closure_id=$1", [initialResult.rows[0].id]);
  assert.deepEqual(audit.rows.map((row) => row.action).sort(), ["AUTO_CLOSED", "RECALCULATED", "REOPENED"]);
});
