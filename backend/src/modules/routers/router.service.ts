import {
  connectMikroTik,
} from "../../mikrotik/connection.js";
import { decryptSecret } from "../../lib/crypto.js";

import {
  deleteRouter,
  findRouterById,
  findRouters,
  insertRouter,
  saveRouterDnsName,
  findRouterCredential,
  updateRouter,
  type UpdateRouterData,
} from "./router.repository.js";

import { conflict, notFoundError } from "../../lib/errors.js";
import { isForeignKeyViolation } from "../../lib/dbErrors.js";

import type {
  CreateRouterData,
} from "../../routes/router.types.js";

/* ============================================================
   LIST
============================================================ */

export async function getRouters() {
  const routers = await findRouters();

  // Répare les anciens enregistrements sans DNS, à partir du vrai profil MikroTik.
  await Promise.all(routers.filter((router) => !router.dnsName && router.managementIp).map(async (router) => {
    let api: Awaited<ReturnType<typeof connectMikroTik>> | null = null;
    try {
      const credential = await findRouterCredential(router.id);
      if (!credential) return;
      api = await connectMikroTik({
        host: router.managementIp,
        port: router.apiPort,
        user: credential.username,
        password: decryptSecret(credential.encryptedSecret),
      });
      const profiles = await api.write("/ip/hotspot/profile/print");
      const dnsName = profiles
        .map((profile: Record<string, unknown>) => profile["dns-name"])
        .find((value): value is string => typeof value === "string" && value.trim().length > 0);
      if (dnsName) await saveRouterDnsName(router.id, dnsName.trim());
    } catch (error) {
      // La liste des routeurs reste disponible même si un équipement est injoignable.
      console.warn("[routers] Détection DNS ignorée pour", router.name, error);
    } finally {
      if (api) await api.close().catch(() => undefined);
    }
  }));

  return findRouters();
}

/* ============================================================
   FIND
============================================================ */

export async function getRouterById(
  id: string
) {
  return findRouterById(id);
}

/* ============================================================
   UPDATE
============================================================ */

export async function updateRouterData(
  id: string,
  data: UpdateRouterData
) {
  const existing = await findRouterById(id);

  if (!existing) {
    throw notFoundError("Routeur introuvable.");
  }

  const updated = await updateRouter(id, data);

  if (!updated) {
    throw notFoundError("Routeur introuvable.");
  }

  return updated;
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteRouterById(id: string) {
  const existing = await findRouterById(id);

  if (!existing) {
    throw notFoundError("Routeur introuvable.");
  }

  try {
    await deleteRouter(id);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw conflict(
        "Impossible de supprimer ce routeur : des sessions ou points d'accès y sont encore rattachés."
      );
    }

    throw error;
  }
}

/* ============================================================
   TEST MIKROTIK
============================================================ */

export async function testRouterConnection(
  data: CreateRouterData
) {
  const api = await connectMikroTik({
    host: data.host,
    port: data.port,
    user: data.username,
    password: data.password,
  });

  try {
    const identityResult = await api.write(
      "/system/identity/print"
    );

    const resourceResult = await api.write(
      "/system/resource/print"
    );

    const identity =
      identityResult[0]?.name ?? null;

    const resource =
      resourceResult[0] ?? {};

    const uptime =
      resource.uptime ?? null;

    const hotspotProfiles = await api.write(
      "/ip/hotspot/profile/print"
    );
    const dnsNames = hotspotProfiles
      .map((profile: Record<string, unknown>) => profile["dns-name"])
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    const dnsName = dnsNames[0] ?? null;

    return {
      connected: true,

      identity,
      dnsName,

      model:
        resource["board-name"] ??
        null,

      routerOsVersion:
        resource.version ??
        null,

      uptime,

      uptimeSeconds:
        parseRouterOSUptime(uptime),
    };
  } finally {
    await api.close();
  }
}

/* ============================================================
   CREATE
============================================================ */

export async function createRouter(
  data: CreateRouterData
) {
  const mikrotik =
    await testRouterConnection(data);

  return insertRouter({
    ...data,

    identity:
      mikrotik.identity,

    model:
      mikrotik.model,

    routerOsVersion:
      mikrotik.routerOsVersion,

    dnsName: mikrotik.dnsName,

    uptimeSeconds:
      mikrotik.uptimeSeconds,
  });
}

/* ============================================================
   ROUTEROS UPTIME
============================================================ */

function parseRouterOSUptime(
  uptime: unknown
): number | null {
  if (typeof uptime !== "string") {
    return null;
  }

  let seconds = 0;

  const weeks =
    uptime.match(/(\d+)w/);

  const days =
    uptime.match(/(\d+)d/);

  const hours =
    uptime.match(/(\d+)h/);

  const minutes =
    uptime.match(/(\d+)m/);

  const secs =
    uptime.match(/(\d+)s/);

  if (weeks) {
    seconds +=
      Number(weeks[1]) *
      7 *
      24 *
      3600;
  }

  if (days) {
    seconds +=
      Number(days[1]) *
      24 *
      3600;
  }

  if (hours) {
    seconds +=
      Number(hours[1]) *
      3600;
  }

  if (minutes) {
    seconds +=
      Number(minutes[1]) *
      60;
  }

  if (secs) {
    seconds +=
      Number(secs[1]);
  }

  return seconds;
}