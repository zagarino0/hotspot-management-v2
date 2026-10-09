export type DailyTicketEvent = {
  eventType: string;
  voucherCode: string;
  unitPrice: number;
  currency: string;
};

export type DailyStockInput = {
  openingStock: number;
  ticketsReceived: number;
  ticketsSold: number;
  unsoldInStock: number;
  rejectedPending: number;
  unusableOrReplaced: number;
  replacementTicketsIssued: number;
  missingTickets: number;
};

export type DailyStockResult = {
  expectedStock: number;
  accountedStock: number;
  discrepancy: number;
  stockBalanced: boolean;
};

export function validatePosCurrency(currency: string | undefined): string {
  const normalized = (currency ?? "MGA").trim().toUpperCase();
  if (normalized !== "MGA") {
    throw new Error("La devise de ce point de vente doit être MGA.");
  }
  return normalized;
}

export function validateTicketEvent(input: {
  eventType: string;
  unitPrice?: number;
  currency?: string;
  replacementVoucherCode?: string | null;
  voucherCode: string;
}): { unitPrice: number; currency: string } {
  const unitPrice = input.unitPrice ?? 0;
  const currency = validatePosCurrency(input.currency);

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error("Le prix doit être un nombre positif ou nul.");
  }
  if (input.eventType === "SOLD" && unitPrice <= 0) {
    throw new Error("Un ticket vendu doit avoir un prix strictement positif.");
  }
  if (input.eventType === "REFUNDED" && unitPrice <= 0) {
    throw new Error("Le montant du remboursement doit être strictement positif.");
  }
  if (input.eventType === "REPLACED") {
    if (unitPrice !== 0) throw new Error("Le remplacement doit toujours être gratuit (0 MGA).");
    const replacementCode = input.replacementVoucherCode?.trim();
    if (!replacementCode) throw new Error("Un remplacement doit référencer le nouveau ticket.");
    if (replacementCode.toLowerCase() === input.voucherCode.trim().toLowerCase()) {
      throw new Error("Le ticket de remplacement doit avoir un code différent du ticket remplacé.");
    }
  }

  return { unitPrice, currency };
}

export function calculateDailyStock(input: DailyStockInput): DailyStockResult {
  const counts = Object.values(input);
  if (counts.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("Les compteurs de stock doivent être des entiers positifs ou nuls.");
  }
  const expectedStock = input.openingStock + input.ticketsReceived;
  const accountedStock = input.ticketsSold + input.unsoldInStock
    + input.rejectedPending + input.unusableOrReplaced
    + input.replacementTicketsIssued + input.missingTickets;
  const discrepancy = expectedStock - accountedStock;
  return { expectedStock, accountedStock, discrepancy, stockBalanced: discrepancy === 0 };
}

export function calculateDailyFinancials(events: DailyTicketEvent[], currency = "MGA") {
  const normalizedCurrency = validatePosCurrency(currency);
  const soldCodes = new Set<string>();
  let grossRevenue = 0;
  let refunds = 0;

  for (const event of events) {
    if (event.currency.toUpperCase() !== normalizedCurrency) {
      throw new Error("La clôture contient des événements dans une devise incohérente.");
    }
    if (event.eventType === "SOLD") {
      const code = event.voucherCode.trim().toLowerCase();
      if (!soldCodes.has(code)) {
        soldCodes.add(code);
        grossRevenue += event.unitPrice;
      }
    } else if (event.eventType === "REFUNDED") {
      refunds += event.unitPrice;
    }
  }

  return {
    ticketsSold: soldCodes.size,
    grossRevenue: roundMoney(grossRevenue),
    refunds: roundMoney(refunds),
    netRevenue: roundMoney(grossRevenue - refunds),
  };
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function validateRefundAmount(originalSaleAmount: number, alreadyRefunded: number, requestedRefund: number): number {
  if (![originalSaleAmount, alreadyRefunded, requestedRefund].every(Number.isFinite)
      || originalSaleAmount <= 0 || alreadyRefunded < 0 || requestedRefund <= 0) {
    throw new Error("Les montants de remboursement sont invalides.");
  }
  const total = roundMoney(alreadyRefunded + requestedRefund);
  if (total > roundMoney(originalSaleAmount)) {
    throw new Error("Le remboursement cumulé dépasserait le montant de la vente initiale.");
  }
  return total;
}
