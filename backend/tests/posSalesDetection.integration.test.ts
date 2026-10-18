import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/database/pool.js";
import { detectFirstUse } from "../src/modules/sales/posOperations.scheduler.js";

test("PostgreSQL first-use detection: matches an unlinked session, records one sale, and blocks ambiguous tariffs", async (t) => {
  const suffix = randomUUID();
  const orgId = randomUUID();
  const siteId = randomUUID();
  const routerId = randomUUID();
  const posId = randomUUID();
  const normalVoucherId = randomUUID();
  const ambiguousVoucherId = randomUUID();
  const normalSessionId = randomUUID();
  const ambiguousSessionId = randomUUID();
  const normalCode = `IT-FIRST-${suffix}`;
  const ambiguousCode = `IT-AMBIG-${suffix}`;
  const normalUsername = `it-user-${suffix}`;
  const ambiguousUsername = `it-ambig-user-${suffix}`;
  const uniqueProfile = `it_prof_${suffix.replaceAll("-", "").slice(0, 18)}`.toLowerCase();
  const ambiguousProfileLower = `it_amb_${suffix.replaceAll("-", "").slice(0, 12)}`.toLowerCase();
  const ambiguousProfileUpper = ambiguousProfileLower.toUpperCase();
  let seeded = false;

  t.after(async () => {
    if (seeded) {
      await pool.query("DELETE FROM point_of_sale_ticket_event WHERE voucher_id = ANY($1::uuid[])", [[normalVoucherId, ambiguousVoucherId]]);
      await pool.query("DELETE FROM session WHERE id = ANY($1::uuid[])", [[normalSessionId, ambiguousSessionId]]);
      await pool.query("DELETE FROM voucher WHERE id = ANY($1::uuid[])", [[normalVoucherId, ambiguousVoucherId]]);
      await pool.query("DELETE FROM site_hotspot_profile_price WHERE site_id = $1", [siteId]);
      await pool.query("DELETE FROM hotspot_profile WHERE code = ANY($1::text[])", [[uniqueProfile, ambiguousProfileLower, ambiguousProfileUpper]]);
      await pool.query("DELETE FROM point_of_sale WHERE id = $1", [posId]);
      await pool.query("DELETE FROM router WHERE id = $1", [routerId]);
      await pool.query("DELETE FROM site WHERE id = $1", [siteId]);
      await pool.query("DELETE FROM organization WHERE id = $1", [orgId]);
    }
    await pool.end();
  });

  await pool.query("INSERT INTO organization (id,name,code) VALUES ($1,$2,$3)", [orgId, "First-use integration test", `IT-FIRST-${suffix}`]);
  seeded = true;
  await pool.query("INSERT INTO site (id,organization_id,name,code) VALUES ($1,$2,$3,$4)", [siteId, orgId, "First-use test site", `SITE-FIRST-${suffix}`]);
  await pool.query("INSERT INTO router (id,site_id,name,code) VALUES ($1,$2,$3,$4)", [routerId, siteId, "First-use test router", `R-FIRST-${suffix}`]);
  await pool.query("INSERT INTO point_of_sale (id,organization_id,code,name,type,status,closing_time) VALUES ($1,$2,$3,$4,'EXTERNAL','ACTIVE','23:59')", [posId, orgId, `POS-FIRST-${suffix}`, "First-use test POS"]);

  await pool.query(
    "INSERT INTO hotspot_profile (code,name,default_price,currency) VALUES ($1,$2,500,'MGA'),($3,$4,100,'MGA'),($5,$6,200,'MGA')",
    [uniqueProfile, "Unique integration profile", ambiguousProfileLower, "Ambiguous lowercase profile", ambiguousProfileUpper, "Ambiguous uppercase profile"],
  );
  await pool.query(
    "INSERT INTO site_hotspot_profile_price (site_id,profile_code,price,currency) VALUES ($1,$2,500,'MGA'),($1,$3,100,'MGA'),($1,$4,200,'MGA')",
    [siteId, uniqueProfile, ambiguousProfileLower, ambiguousProfileUpper],
  );

  await pool.query(
    `INSERT INTO voucher (id,site_id,code,router_id,mikrotik_username,mikrotik_profile,point_of_sale_id,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'UNUSED'),($8,$2,$9,$4,$10,$11,$7,'UNUSED')`,
    [normalVoucherId, siteId, normalCode, routerId, normalUsername, uniqueProfile, posId,
      ambiguousVoucherId, ambiguousCode, ambiguousUsername, ambiguousProfileLower.toUpperCase()],
  );
  await pool.query(
    `INSERT INTO session (id,site_id,router_id,voucher_id,username,started_at,status)
     VALUES ($1,$2,$3,NULL,$4,NOW() - INTERVAL '2 minutes','COMPLETED'),
            ($5,$2,$3,NULL,$6,NOW() - INTERVAL '1 minute','COMPLETED')`,
    [normalSessionId, siteId, routerId, normalUsername.toUpperCase(), ambiguousSessionId, ambiguousUsername.toUpperCase()],
  );

  await detectFirstUse(normalVoucherId);
  const firstSale = await pool.query(
    "SELECT event_type,unit_price,currency,event_key,metadata FROM point_of_sale_ticket_event WHERE voucher_id=$1",
    [normalVoucherId],
  );
  assert.equal(firstSale.rows.length, 1, "the unlinked session must create exactly one sale");
  assert.equal(firstSale.rows[0].event_type, "SOLD");
  assert.equal(Number(firstSale.rows[0].unit_price), 500);
  assert.equal(firstSale.rows[0].currency, "MGA");
  assert.equal(firstSale.rows[0].event_key, `voucher-first-use:${normalVoucherId}`);
  assert.equal(firstSale.rows[0].metadata.priceSource, "CURRENT_SITE_PROFILE");

  await detectFirstUse(normalVoucherId);
  const repeatedSaleCount = await pool.query(
    "SELECT COUNT(*)::int AS count FROM point_of_sale_ticket_event WHERE voucher_id=$1 AND event_type='SOLD'",
    [normalVoucherId],
  );
  assert.equal(repeatedSaleCount.rows[0].count, 1, "repeated detection must not duplicate the sale");

  await detectFirstUse(ambiguousVoucherId);
  const ambiguousSaleCount = await pool.query(
    "SELECT COUNT(*)::int AS count FROM point_of_sale_ticket_event WHERE voucher_id=$1 AND event_type='SOLD'",
    [ambiguousVoucherId],
  );
  const ambiguousVoucher = await pool.query(
    "SELECT first_use_detection_issue FROM voucher WHERE id=$1",
    [ambiguousVoucherId],
  );
  assert.equal(ambiguousSaleCount.rows[0].count, 0, "conflicting positive tariffs must not create a sale");
  assert.match(ambiguousVoucher.rows[0].first_use_detection_issue, /ambigu/i);
});
