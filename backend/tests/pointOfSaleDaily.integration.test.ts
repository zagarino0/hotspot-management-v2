import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/database/pool.js";
import {
  closeDailySales,
  createTicketEvent,
  listDailyClosures,
  listTicketEvents,
} from "../src/modules/sales/pointOfSaleDaily.service.js";
import { AppError } from "../src/lib/errors.js";

const localBusinessDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Indian/Antananarivo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

test("PostgreSQL POS integration: permissions, duplicate sales, refunds, closure and concurrent writes", async (t) => {
  const suffix = randomUUID();
  const orgId = randomUUID();
  const siteId = randomUUID();
  const posId = randomUUID();
  const userId = randomUUID();
  const noPermissionUserId = randomUUID();
  const roleId = randomUUID();
  const codes = {
    sold: `IT-SOLD-${suffix}`,
    refund: `IT-REFUND-${suffix}`,
    concurrent: `IT-CONCURRENT-${suffix}`,
    replacementSource: `IT-REJECT-${suffix}`,
    replacement: `IT-REPLACEMENT-${suffix}`,
  };
  let seeded = false;

  t.after(async () => {
    if (seeded) {
      await pool.query("DELETE FROM point_of_sale_daily_closure WHERE point_of_sale_id=$1", [posId]);
      await pool.query("DELETE FROM point_of_sale_ticket_event WHERE point_of_sale_id=$1", [posId]);
      await pool.query("DELETE FROM user_role WHERE user_id=$1", [userId]);
      await pool.query("DELETE FROM role_permission WHERE role_id=$1", [roleId]);
      await pool.query("DELETE FROM \"user\" WHERE id=ANY($1::uuid[])", [[userId, noPermissionUserId]]);
      await pool.query("DELETE FROM role WHERE id=$1", [roleId]);
      await pool.query("DELETE FROM point_of_sale WHERE id=$1", [posId]);
      await pool.query("DELETE FROM site WHERE id=$1", [siteId]);
      await pool.query("DELETE FROM organization WHERE id=$1", [orgId]);
    }
    await pool.end();
  });

  await pool.query("INSERT INTO organization (id,name,code) VALUES ($1,$2,$3)", [orgId, "POS integration test", `IT-${suffix}`]);
  seeded = true;
  await pool.query("INSERT INTO site (id,organization_id,name,code) VALUES ($1,$2,$3,$4)", [siteId, orgId, "POS test site", `SITE-${suffix}`]);
  await pool.query("INSERT INTO point_of_sale (id,organization_id,code,name,type) VALUES ($1,$2,$3,$4,'EXTERNAL')", [posId, orgId, `POS-${suffix}`, "CASHPOINTWIFI integration"]);
  await pool.query("INSERT INTO \"user\" (id,organization_id,username,password_hash,status) VALUES ($1,$2,$3,'test-only-hash','ACTIVE')", [userId, orgId, `it-${suffix}`]);
  await pool.query("INSERT INTO role (id,organization_id,name,code,status) VALUES ($1,$2,'POS integration role',$3,'ACTIVE')", [roleId, orgId, `POS_IT_${suffix}`]);
  await pool.query("INSERT INTO \"user\" (id,organization_id,username,password_hash,status) VALUES ($1,$2,$3,'test-only-hash','ACTIVE')", [noPermissionUserId, orgId, `it-no-perm-${suffix}`]);
  const permissionCodes = [
    "POS_TICKET_EVENTS_READ",
    "POS_TICKET_EVENTS_CREATE",
    "POS_DAILY_CLOSURES_READ",
    "POS_DAILY_CLOSURES_CLOSE",
  ];
  const permissions = await pool.query("SELECT id,code FROM permission WHERE code=ANY($1::text[])", [permissionCodes]);
  assert.equal(permissions.rows.length, permissionCodes.length, "migration 023 must create all POS permissions");
  for (const permission of permissions.rows) {
    await pool.query("INSERT INTO role_permission (role_id,permission_id) VALUES ($1,$2)", [roleId, permission.id]);
  }
  await pool.query("INSERT INTO user_role (user_id,role_id,scope) VALUES ($1,$2,'ORGANIZATION')", [userId, roleId]);

  type EventInput = Parameters<typeof createTicketEvent>[2];
  const event = (
    eventType: EventInput["eventType"],
    voucherCode: string,
    unitPrice: number,
    key: string,
    extra: Pick<EventInput, "replacementVoucherCode" | "reason"> = {},
  ): EventInput => ({
    ...extra, siteId, voucherCode, eventType, unitPrice, currency: "MGA", eventKey: key,
  });
  const create = (input: EventInput) => createTicketEvent(posId, userId, input);

  await assert.rejects(listTicketEvents(posId, noPermissionUserId), (error) => error instanceof AppError && error.statusCode === 403, "users without read permission must be denied");
  await assert.rejects(createTicketEvent(posId, noPermissionUserId, event("SOLD", `IT-DENIED-${suffix}`, 1000, `evt-${suffix}-denied`)), (error) => error instanceof AppError && error.statusCode === 403, "users without create permission must be denied");

  const sold = await create(event("SOLD", codes.sold, 2500, `evt-${suffix}-sold`));
  assert.equal(sold.event_type, "SOLD");
  await assert.rejects(
    create(event("SOLD", codes.sold.toLowerCase(), 2500, `evt-${suffix}-sold-duplicate`)),
    (error) => error instanceof AppError && error.statusCode === 409,
    "a ticket cannot be sold twice, even with different casing",
  );

  await create(event("SOLD", codes.refund, 7000, `evt-${suffix}-refund-sale`));
  await create(event("REFUNDED", codes.refund, 2500, `evt-${suffix}-refund-1`));
  await create(event("REFUNDED", codes.refund, 4500, `evt-${suffix}-refund-2`));
  await assert.rejects(
    create(event("REFUNDED", codes.refund, 1, `evt-${suffix}-refund-over`)),
    (error) => error instanceof AppError && error.statusCode === 409,
    "cumulative refunds cannot exceed the original sale",
  );

  const concurrentSale = event("SOLD", codes.concurrent, 1000, `evt-${suffix}-concurrent-sale`);
  await create(concurrentSale);
  const concurrentRefunds = await Promise.allSettled([
    create(event("REFUNDED", codes.concurrent, 700, `evt-${suffix}-concurrent-refund-700`)),
    create(event("REFUNDED", codes.concurrent, 500, `evt-${suffix}-concurrent-refund-500`)),
  ]);
  assert.equal(concurrentRefunds.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(concurrentRefunds.filter((result) => result.status === "rejected").length, 1);

  await create(event("REPLACED", codes.replacementSource, 0, `evt-${suffix}-replacement`, {
    replacementVoucherCode: codes.replacement,
    reason: "Remplacement gratuit de test",
  }));

  // Le registre d'événements, et non les compteurs envoyés par le client,
  // détermine les catégories de tickets de la clôture.
  for (let i = 1; i <= 3; i++) {
    await create(event("UNSOLD_CONFIRMED", `IT-UNSOLD-${suffix}-${i}`, 0, `evt-${suffix}-unsold-${i}`));
  }
  await create(event("REJECTED", `IT-REJECTED-${suffix}`, 0, `evt-${suffix}-rejected`));
  for (let i = 1; i <= 2; i++) {
    await create(event("UNUSABLE", `IT-UNUSABLE-${suffix}-${i}`, 0, `evt-${suffix}-unusable-${i}`));
  }

  await assert.rejects(
    closeDailySales(posId, noPermissionUserId, {
      businessDate: localBusinessDate(), currency: "MGA", openingStock: 0,
      unsoldInStock: 0, rejectedPending: 0, unusableOrReplaced: 0, missingTickets: 0,
    }),
    (error) => error instanceof AppError && error.statusCode === 403,
    "users without close permission must be denied",
  );

  const events = await listTicketEvents(posId, userId, localBusinessDate());
  assert.ok(events.length >= 7, "the authorized reader can see recorded events");
  const date = localBusinessDate();
  const closure = await closeDailySales(posId, userId, {
    businessDate: date,
    currency: "MGA",
    openingStock: 10,
    ticketsReceived: 0,
    physicalStockCount: 3,
    // Valeurs legacy volontairement différentes : les catégories sont calculées
    // à partir des événements enregistrés en PostgreSQL.
    unsoldInStock: 99,
    rejectedPending: 99,
    unusableOrReplaced: 99,
    missingTickets: 99,
    notes: "Automated PostgreSQL integration test",
  });
  assert.equal(Number(closure.tickets_sold), 3);
  assert.equal(Number(closure.gross_revenue), 10500);
  const successfulConcurrentRefund = concurrentRefunds.find((result) => result.status === "fulfilled");
  assert.ok(successfulConcurrentRefund && successfulConcurrentRefund.status === "fulfilled");
  assert.equal(Number(closure.refunds), 7000 + Number(successfulConcurrentRefund.value.unit_price));
  assert.equal(Number(closure.unsold_in_stock), 3);
  assert.equal(Number(closure.rejected_pending), 1);
  assert.equal(Number(closure.unusable_or_replaced), 2);
  assert.equal(Number(closure.missing_tickets), 0);
  assert.equal(Number(closure.physical_stock_count), 3);
  assert.equal(Number(closure.theoretical_stock), 3);
  assert.equal(Number(closure.stock_discrepancy), 0);
  assert.equal(Number(closure.event_stock_discrepancy), 0);
  assert.equal(closure.stock_review_required, false);
  assert.equal(closure.stockBalanced, true);

  await assert.rejects(
    closeDailySales(posId, userId, {
      businessDate: date, currency: "MGA", openingStock: 10, ticketsReceived: 0,
      unsoldInStock: 3, rejectedPending: 1, unusableOrReplaced: 2, missingTickets: 0,
    }),
    (error) => error instanceof AppError && error.statusCode === 409,
    "the same POS/date cannot be closed twice",
  );

  const closures = await listDailyClosures(posId, userId, date, date);
  assert.equal(closures.length, 1);
});
