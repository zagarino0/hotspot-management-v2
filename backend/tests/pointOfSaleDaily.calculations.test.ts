import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDailyFinancials,
  calculateDailyStock,
  validatePosCurrency,
  validateRefundAmount,
  validateTicketEvent,
} from "../src/modules/sales/pointOfSaleDaily.calculations.js";

test("un ticket vendu exige un prix strictement positif", () => {
  assert.throws(() => validateTicketEvent({
    eventType: "SOLD", voucherCode: "CW-01", unitPrice: 0, currency: "MGA",
  }), /strictement positif/);
});

test("un remboursement doit être positif et dans la devise MGA", () => {
  assert.throws(() => validateTicketEvent({
    eventType: "REFUNDED", voucherCode: "CW-01", unitPrice: 0, currency: "MGA",
  }), /remboursement/);
  assert.throws(() => validatePosCurrency("EUR"), /MGA/);
});

test("un remplacement est gratuit et référence un code différent", () => {
  assert.deepEqual(validateTicketEvent({
    eventType: "REPLACED", voucherCode: "CW-01",
    replacementVoucherCode: "CW-02", unitPrice: 0, currency: "MGA",
  }), { unitPrice: 0, currency: "MGA" });
  assert.throws(() => validateTicketEvent({
    eventType: "REPLACED", voucherCode: "CW-01",
    replacementVoucherCode: "CW-01", unitPrice: 0, currency: "MGA",
  }), /code différent/);
  assert.throws(() => validateTicketEvent({
    eventType: "REPLACED", voucherCode: "CW-01",
    replacementVoucherCode: "CW-02", unitPrice: 100, currency: "MGA",
  }), /gratuit/);
});

test("la recette compte les tickets vendus distincts et les remboursements séparément", () => {
  const totals = calculateDailyFinancials([
    { eventType: "SOLD", voucherCode: "CW-01", unitPrice: 2500, currency: "MGA" },
    { eventType: "SOLD", voucherCode: "cw-01", unitPrice: 2500, currency: "MGA" },
    { eventType: "SOLD", voucherCode: "CW-02", unitPrice: 7000, currency: "MGA" },
    { eventType: "REFUNDED", voucherCode: "CW-02", unitPrice: 7000, currency: "MGA" },
  ]);
  assert.deepEqual(totals, {
    ticketsSold: 2, grossRevenue: 9500, refunds: 7000, netRevenue: 2500,
  });
});

test("une journée peut avoir des remboursements supérieurs aux ventes du jour", () => {
  assert.deepEqual(calculateDailyFinancials([
    { eventType: "SOLD", voucherCode: "CW-01", unitPrice: 2500, currency: "MGA" },
    { eventType: "REFUNDED", voucherCode: "CW-OLD", unitPrice: 7000, currency: "MGA" },
  ]), { ticketsSold: 1, grossRevenue: 2500, refunds: 7000, netRevenue: -4500 });
});

test("le stock calcule l'écart et identifie une clôture équilibrée", () => {
  assert.deepEqual(calculateDailyStock({
    openingStock: 10, ticketsReceived: 2, ticketsSold: 4,
    unsoldInStock: 3, rejectedPending: 1, unusableOrReplaced: 1,
    replacementTicketsIssued: 1, missingTickets: 2,
  }), {
    expectedStock: 12, accountedStock: 12, discrepancy: 0, stockBalanced: true,
  });
});

test("les compteurs de stock négatifs ou fractionnaires sont refusés", () => {
  assert.throws(() => calculateDailyStock({
    openingStock: -1, ticketsReceived: 0, ticketsSold: 0,
    unsoldInStock: 0, rejectedPending: 0, unusableOrReplaced: 0,
    replacementTicketsIssued: 0, missingTickets: 0,
  }), /entiers positifs/);
});

test("journée CASHPOINTWIFI complète : ventes, invendus, rejets, tickets manquants et remplacement gratuit", () => {
  const events = [
    ...Array.from({ length: 8 }, (_, i) => ({
      eventType: "SOLD", voucherCode: `CPW-SOLD-${i + 1}`, unitPrice: 2500, currency: "MGA",
    })),
    { eventType: "REPLACED", voucherCode: "CPW-REJECT-01", unitPrice: 0, currency: "MGA" },
    { eventType: "REJECTED", voucherCode: "CPW-REJECT-02", unitPrice: 0, currency: "MGA" },
  ];
  const financials = calculateDailyFinancials(events);
  const stock = calculateDailyStock({
    openingStock: 20, ticketsReceived: 0, ticketsSold: financials.ticketsSold,
    unsoldInStock: 5, rejectedPending: 2, unusableOrReplaced: 1,
    replacementTicketsIssued: 1, missingTickets: 3,
  });
  assert.deepEqual(financials, {
    ticketsSold: 8, grossRevenue: 20000, refunds: 0, netRevenue: 20000,
  });
  assert.deepEqual(stock, {
    expectedStock: 20, accountedStock: 20, discrepancy: 0, stockBalanced: true,
  });
});

test("un remboursement cumulé ne peut pas dépasser le prix vendu", () => {
  assert.equal(validateRefundAmount(7000, 2500, 4500), 7000);
  assert.throws(() => validateRefundAmount(7000, 2500, 4501), /dépasserait/);
  assert.throws(() => validateRefundAmount(7000, -1, 100), /invalides/);
});
