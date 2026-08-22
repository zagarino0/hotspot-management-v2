import { RouterOSAPI } from "node-routeros";
import { env } from "../config/env.js";

/* ============================================================
   TYPES
============================================================ */

export interface MikroTikConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

/* ============================================================
   CONFIGURATION PAR DÉFAUT
============================================================ */

function getDefaultConfig(): MikroTikConnectionConfig {
  if (!env.mikrotik.host) {
    throw new Error("MIKROTIK_HOST n'est pas configuré.");
  }

  if (!env.mikrotik.user) {
    throw new Error("MIKROTIK_USER n'est pas configuré.");
  }

  if (!env.mikrotik.password) {
    throw new Error("MIKROTIK_PASSWORD n'est pas configuré.");
  }

  return {
    host: env.mikrotik.host,
    port: env.mikrotik.port || 8728,
    user: env.mikrotik.user,
    password: env.mikrotik.password,
  };
}

/* ============================================================
   CONNECTION
============================================================ */

export async function connectMikroTik(
  config: MikroTikConnectionConfig
): Promise<RouterOSAPI> {
  const api = new RouterOSAPI({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    timeout: 5,
  });

  await api.connect();

  return api;
}

/* ============================================================
   CONNECTION PAR .ENV
============================================================ */

export async function connectDefaultMikroTik(): Promise<RouterOSAPI> {
  const config = getDefaultConfig();

  return connectMikroTik(config);
}