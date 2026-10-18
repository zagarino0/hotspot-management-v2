export function resolveFirstUseTariff(input: {
  voucherPriceSnapshot: number | null;
  voucherCurrencySnapshot: string | null;
  planPrice: number | null;
  planCurrency: string | null;
  siteProfile: { matchedRows: number; distinctPositivePrices: number; price: number | null; distinctCurrencies: number; currency: string | null };
}) {
  const s = input.siteProfile;
  const hasPriceSnapshot = input.voucherPriceSnapshot !== null;
  const hasCurrencySnapshot = input.voucherCurrencySnapshot !== null;
  const priceSource = hasPriceSnapshot ? "VOUCHER_SNAPSHOT" as const : s.matchedRows === 0 ? "CURRENT_PLAN" as const : "CURRENT_SITE_PROFILE" as const;
  const unitPrice = hasPriceSnapshot ? input.voucherPriceSnapshot : s.matchedRows === 0 ? input.planPrice : s.distinctPositivePrices === 1 ? s.price : null;
  const currency = hasCurrencySnapshot ? input.voucherCurrencySnapshot : s.matchedRows === 0 ? input.planCurrency : s.distinctCurrencies === 1 ? s.currency : null;
  let issue: string | null = null;
  if (!hasPriceSnapshot && s.matchedRows > 0 && s.distinctPositivePrices !== 1) issue = "Tarif du profil ambigu ou non positif dans la configuration du site.";
  else if (!hasCurrencySnapshot && s.matchedRows > 0 && s.distinctCurrencies !== 1) issue = "Devises contradictoires pour le profil dans la configuration du site.";
  else if (unitPrice === null || unitPrice <= 0 || currency !== "MGA") issue = "Prix ou devise du forfait non résolu pour la détection de vente.";
  return { unitPrice, currency, priceSource, issue };
}

export function matchesFirstUseSession(input: {
  voucherId: string; sessionVoucherId: string | null; voucherSiteId: string; sessionSiteId: string;
  voucherRouterId: string; sessionRouterId: string; voucherUsername: string | null; voucherCode: string; sessionUsername: string;
}): boolean {
  if (input.sessionVoucherId === input.voucherId) return true;
  if (input.sessionVoucherId !== null) return false;
  const expected = (input.voucherUsername ?? input.voucherCode).trim().toLocaleLowerCase("en");
  return input.sessionSiteId === input.voucherSiteId && input.sessionRouterId === input.voucherRouterId
    && input.sessionUsername.trim().toLocaleLowerCase("en") === expected;
}

export function firstUseSaleEventKey(voucherId: string): string {
  return `voucher-first-use:${voucherId}`;
}
