import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

import { env } from "../config/env.js";

/* ============================================================
   CHIFFREMENT DES SECRETS (mots de passe MikroTik, etc.)

   AES-256-GCM :
   - clé : 32 octets, dérivée de CREDENTIALS_ENCRYPTION_KEY (hex)
   - iv  : 12 octets aléatoires, généré à chaque chiffrement
   - authTag : garantit l'intégrité (détecte toute altération)

   Format stocké : "<iv>:<authTag>:<ciphertext>" (tout en hex)
============================================================ */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = Buffer.from(
    env.credentialsEncryptionKey,
    "hex"
  );

  if (key.length !== 32) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY doit être une clé hexadécimale de 32 octets (64 caractères hex)."
    );
  }

  return key;
}

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");

  if (parts.length !== 3) {
    throw new Error(
      "Format de secret chiffré invalide."
    );
  }

  const [ivHex, authTagHex, dataHex] = parts;

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
