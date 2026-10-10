import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/database/pool.js";
import { createSale, getSales, getSaleDetails, recordPayment } from "../src/modules/sales/sale.service.js";
import { AppError } from "../src/lib/errors.js";

test("PostgreSQL sales integration: filters, payment lifecycle, pending payments, overpayment and concurrency", async (t) => {
  const suffix = randomUUID();
  const orgA = randomUUID();
  const orgB = randomUUID();
  const siteA = randomUUID();
  const siteB = randomUUID();
  const posA = randomUUID();
  const posA2 = randomUUID();
  const posB = randomUUID();
  const createdSaleIds: string[] = [];
  let seeded = false;

  t.after(async () => {
    if (seeded) {
      await pool.query("DELETE FROM payment WHERE sale_id = ANY($1::uuid[])", [createdSaleIds]);
      await pool.query("DELETE FROM sale WHERE id = ANY($1::uuid[])", [createdSaleIds]);
      await pool.query("DELETE FROM point_of_sale WHERE id = ANY($1::uuid[])", [[posA, posA2, posB]]);
      await pool.query("DELETE FROM site WHERE id = ANY($1::uuid[])", [[siteA, siteB]]);
      await pool.query("DELETE FROM organization WHERE id = ANY($1::uuid[])", [[orgA, orgB]]);
    }
    await pool.end();
  });

  await pool.query("INSERT INTO organization (id,name,code) VALUES ($1,$2,$3),($4,$5,$6)", [
    orgA, "Sales integration A", `SALE-IT-A-${suffix}`,
    orgB, "Sales integration B", `SALE-IT-B-${suffix}`,
  ]);
  seeded = true;
  await pool.query("INSERT INTO site (id,organization_id,name,code) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)", [
    siteA, orgA, "Sales test site A", `SITE-A-${suffix}`,
    siteB, orgB, "Sales test site B", `SITE-B-${suffix}`,
  ]);
  await pool.query(
    "INSERT INTO point_of_sale (id,organization_id,code,name,type) VALUES ($1,$2,$3,$4,'EXTERNAL'),($5,$6,$7,$8,'EXTERNAL'),($9,$10,$11,$12,'EXTERNAL')",
    [posA, orgA, `POS-A-${suffix}`, "Sales POS A", posA2, orgA, `POS-A2-${suffix}`, "Sales POS A2", posB, orgB, `POS-B-${suffix}`, "Sales POS B"],
  );

  const makeSale = async (siteId: string, pointOfSaleId: string, unitPrice = 1000) => {
    const sale = await createSale({
      siteId,
      pointOfSaleId,
      profileCode: "profil_1h",
      quantity: 1,
      unitPrice,
    });
    createdSaleIds.push(sale.id);
    return sale;
  };
  const saleA = await makeSale(siteA, posA);
  const saleA2 = await makeSale(siteA, posA2);
  const saleB = await makeSale(siteB, posB);

  assert.deepEqual((await getSales({ siteId: siteA })).map((sale) => sale.id).sort(), [saleA.id, saleA2.id].sort());
  assert.deepEqual((await getSales({ pointOfSaleId: posA })).map((sale) => sale.id), [saleA.id]);
  assert.deepEqual((await getSales({ siteId: siteA, pointOfSaleId: posA2 })).map((sale) => sale.id), [saleA2.id]);
  assert.deepEqual((await getSales({ siteId: siteB, pointOfSaleId: posB })).map((sale) => sale.id), [saleB.id]);

  const partial = await recordPayment({
    saleId: saleA.id, amount: 400, method: "CASH", markAsPaid: true,
  });
  assert.equal(partial.status, "SUCCESS");
  let details = await getSaleDetails(saleA.id);
  assert.equal(details.sale.status, "PARTIALLY_PAID");
  assert.equal(details.sale.paidAmount, 400);

  await recordPayment({ saleId: saleA.id, amount: 600, method: "MVOLA", markAsPaid: true });
  details = await getSaleDetails(saleA.id);
  assert.equal(details.sale.status, "PAID");
  assert.equal(details.sale.paidAmount, 1000);
  assert.equal(details.payments.length, 2);

  const pendingSale = await makeSale(siteA, posA, 1000);
  const pending = await recordPayment({
    saleId: pendingSale.id, amount: 300, method: "ORANGE_MONEY", markAsPaid: false,
  });
  assert.equal(pending.status, "PENDING");
  details = await getSaleDetails(pendingSale.id);
  assert.equal(details.sale.status, "PENDING");
  assert.equal(details.sale.paidAmount, 0);
  await assert.rejects(
    recordPayment({ saleId: pendingSale.id, amount: 701, method: "CASH", markAsPaid: true }),
    (error) => error instanceof AppError && error.statusCode === 409,
    "successful plus pending payments must not reserve more than the sale total",
  );

  const overpaymentSale = await makeSale(siteA, posA, 1000);
  await assert.rejects(
    recordPayment({ saleId: overpaymentSale.id, amount: 1001, method: "CASH", markAsPaid: true }),
    (error) => error instanceof AppError && error.statusCode === 409,
    "payments above the total must be rejected",
  );
  details = await getSaleDetails(overpaymentSale.id);
  assert.equal(details.payments.length, 0);
  assert.equal(details.sale.status, "PENDING");

  const concurrentSale = await makeSale(siteA, posA, 1000);
  const concurrent = await Promise.allSettled([
    recordPayment({ saleId: concurrentSale.id, amount: 700, method: "CASH", markAsPaid: true }),
    recordPayment({ saleId: concurrentSale.id, amount: 600, method: "MVOLA", markAsPaid: true }),
  ]);
  assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(concurrent.filter((result) => result.status === "rejected").length, 1);
  details = await getSaleDetails(concurrentSale.id);
  assert.equal(details.payments.length, 1);
  assert.equal(details.sale.paidAmount, 700);
  assert.equal(details.sale.status, "PARTIALLY_PAID");
});
