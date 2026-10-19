import test from "node:test";
import assert from "node:assert/strict";
import { firstUseSaleEventKey, matchesFirstUseSession, resolveFirstUseTariff } from "../src/modules/sales/posSalesDetection.rules.js";

const base = { voucherPriceSnapshot: null, voucherCurrencySnapshot: null, planPrice: 100, planCurrency: "MGA",
  siteProfile: { matchedRows: 2, distinctPositivePrices: 1, price: 500, distinctCurrencies: 1, currency: "MGA" } };

test("un tarif nul en doublon ne masque pas l'unique tarif positif", () => {
  assert.equal(resolveFirstUseTariff(base).unitPrice, 500);
  assert.equal(resolveFirstUseTariff(base).issue, null);
});
test("des tarifs positifs contradictoires bloquent la vente", () => {
  const r = resolveFirstUseTariff({ ...base, siteProfile: { ...base.siteProfile, distinctPositivePrices: 2 } });
  assert.equal(r.unitPrice, null);
  assert.match(r.issue ?? "", /ambigu/i);
});
test("sans tarif site, utilise le tarif du forfait", () => {
  const r = resolveFirstUseTariff({ ...base, siteProfile: { matchedRows: 0, distinctPositivePrices: 0, price: null, distinctCurrencies: 0, currency: null } });
  assert.equal(r.unitPrice, 100);
  assert.equal(r.priceSource, "CURRENT_PLAN");
});
test("le snapshot voucher est prioritaire", () => {
  const r = resolveFirstUseTariff({ ...base, voucherPriceSnapshot: 750, voucherCurrencySnapshot: "MGA",
    siteProfile: { ...base.siteProfile, distinctPositivePrices: 2 } });
  assert.equal(r.unitPrice, 750);
  assert.equal(r.issue, null);
});
test("session sans voucher_id rapprochée par site, routeur et username insensible à la casse", () => {
  assert.equal(matchesFirstUseSession({ voucherId: "v1", sessionVoucherId: null, voucherSiteId: "s1", sessionSiteId: "s1",
    voucherRouterId: "r1", sessionRouterId: "r1", voucherUsername: null, voucherCode: "AiHa", sessionUsername: "aiha" }), true);
});
test("session d'un autre site ou routeur refusée", () => {
  const b = { voucherId: "v1", sessionVoucherId: null, voucherSiteId: "s1", sessionSiteId: "s1",
    voucherRouterId: "r1", sessionRouterId: "r1", voucherUsername: null, voucherCode: "aiha", sessionUsername: "aiha" };
  assert.equal(matchesFirstUseSession({ ...b, sessionSiteId: "s2" }), false);
  assert.equal(matchesFirstUseSession({ ...b, sessionRouterId: "r2" }), false);
});
test("clé de vente stable entre les cycles", () => {
  assert.equal(firstUseSaleEventKey("v1"), "voucher-first-use:v1");
  assert.equal(firstUseSaleEventKey("v1"), firstUseSaleEventKey("v1"));
});
