import { randomInt } from "node:crypto";

/** Identifiant MikroTik : exactement quatre lettres minuscules. */
export function generateVoucherUsername(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let username = "";
  for (let i = 0; i < 4; i++) username += alphabet[randomInt(alphabet.length)];
  return username;
}

/** Code / mot de passe imprimé : exactement quatre chiffres. */
export function generateVoucherPassword(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

/**
 * Ancienne API conservée pour les autres usages existants.
 * Les nouveaux vouchers utilisent séparément username et password.
 */
export function generateVoucherCode(prefix?: string | null): string {
  const cleanPrefix = prefix?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const code = generateVoucherPassword();
  return cleanPrefix ? `${cleanPrefix}-${code}` : code;
}
