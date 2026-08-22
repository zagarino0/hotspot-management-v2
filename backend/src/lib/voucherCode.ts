import { randomInt } from "node:crypto";

/*
 * Alphabet volontairement privé des caractères ambigus à l'oral/
 * à l'écrit sur un petit ticket imprimé : 0/O, 1/I/L.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomSegment(length: number): string {
  let segment = "";

  for (let i = 0; i < length; i++) {
    segment += ALPHABET[randomInt(ALPHABET.length)];
  }

  return segment;
}

/**
 * Génère un code voucher au format PREFIX-XXXX-XXXX.
 * Le préfixe est optionnel (ex: nom court du site/forfait).
 */
export function generateVoucherCode(
  prefix?: string | null
): string {
  const segments = [randomSegment(4), randomSegment(4)];

  const cleanPrefix = prefix
    ?.trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (cleanPrefix) {
    return `${cleanPrefix}-${segments.join("-")}`;
  }

  return segments.join("-");
}
