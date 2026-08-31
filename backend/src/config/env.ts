import "dotenv/config";

/* ============================================================
   HELPERS
============================================================ */

function getEnv(
  name: string,
  defaultValue?: string
): string {
  const value =
    process.env[name] ?? defaultValue;

  if (
    value === undefined ||
    value.trim() === ""
  ) {
    throw new Error(
      `Variable d'environnement manquante : ${name}`
    );
  }

  return value.trim();
}

function getOptionalEnv(
  name: string
): string | undefined {
  const value = process.env[name];

  if (
    !value ||
    value.trim() === ""
  ) {
    return undefined;
  }

  return value.trim();
}

function getNumberEnv(
  name: string,
  defaultValue: number
): number {
  const raw = process.env[name];

  if (
    raw === undefined ||
    raw.trim() === ""
  ) {
    return defaultValue;
  }

  const value = Number(raw);

  if (!Number.isInteger(value)) {
    throw new Error(
      `Variable d'environnement invalide : ${name}=${raw}`
    );
  }

  return value;
}

/* ============================================================
   ENVIRONMENT
============================================================ */

export const env = {
  nodeEnv:
    process.env.NODE_ENV ??
    "development",

  port: getNumberEnv(
    "PORT",
    4000
  ),

  /* ==========================================================
     DATABASE
  ========================================================== */

  database: {
    host: getEnv(
      "DATABASE_HOST",
      "localhost"
    ),

    port: getNumberEnv(
      "DATABASE_PORT",
      5432
    ),

    name: getEnv(
      "DATABASE_NAME",
      "hotspot_management_v2"
    ),

    user: getEnv(
      "DATABASE_USER",
      "postgres"
    ),

    password: getEnv(
      "DATABASE_PASSWORD"
    ),
  },

  /* ==========================================================
     MIKROTIK
     
     Les routeurs sont configurés dynamiquement
     depuis PostgreSQL.
     
     Ces valeurs sont donc optionnelles.
  ========================================================== */

  mikrotik: {
    host: getOptionalEnv(
      "MIKROTIK_HOST"
    ),

    port: getNumberEnv(
      "MIKROTIK_PORT",
      8728
    ),

    user: getOptionalEnv(
      "MIKROTIK_USER"
    ),

    password: getOptionalEnv(
      "MIKROTIK_PASSWORD"
    ),
  },

  /* ==========================================================
     JWT
  ========================================================== */

  jwtSecret: getEnv(
    "JWT_SECRET"
  ),

  /* ==========================================================
     CHIFFREMENT DES SECRETS
     Clé hex 32 octets (64 caractères) utilisée pour chiffrer
     les mots de passe MikroTik stockés en base.
     Générer avec : openssl rand -hex 32
  ========================================================== */

  credentialsEncryptionKey: getEnv(
    "CREDENTIALS_ENCRYPTION_KEY"
  ),

  /* ==========================================================
     LIVE SYNC
     Intervalle (en secondes) entre deux synchronisations
     automatiques des sessions actives MikroTik.
     0 = désactive la synchronisation automatique en tâche de
     fond (utile en développement / tests).
  ========================================================== */

  liveSyncIntervalSeconds: getNumberEnv(
    "LIVE_SYNC_INTERVAL_SECONDS",
    30
  ),
};