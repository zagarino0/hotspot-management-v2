import type { RouterOSAPI } from "node-routeros";

/* ============================================================
   UTILISATEURS HOTSPOT ACTIFS (LIVE)

   Interroge /ip/hotspot/active/print sur le routeur.
   C'est la source de vérité "temps réel" : ce que MikroTik
   voit réellement connecté à cet instant, indépendamment de
   ce qui est en base PostgreSQL.

   Champs bruts RouterOS (noms avec tirets) :
     .id, user, address, mac-address, uptime,
     bytes-in, bytes-out

   Convention retenue (point de vue du CLIENT, pas du routeur) :
     - bytes-in  (reçu PAR le routeur DEPUIS le client) → upload
     - bytes-out (envoyé PAR le routeur VERS le client)  → download
============================================================ */

export interface MikrotikActiveUser {
  routerInternalId: string | null;
  username: string | null;
  macAddress: string | null;
  ipAddress: string | null;
  uploadBytes: number;
  downloadBytes: number;
}

export async function fetchActiveHotspotUsers(
  api: RouterOSAPI
): Promise<MikrotikActiveUser[]> {
  const rows = await api.write(
    "/ip/hotspot/active/print"
  );

  return rows.map((row: Record<string, unknown>) =>
    parseActiveUserRow(row)
  );
}

/* ============================================================
   DÉCONNEXION D'UN UTILISATEUR ACTIF
   Nécessite le ".id" interne RouterOS de la connexion active
   (obtenu via fetchActiveHotspotUsers ci-dessus), pas l'id de
   notre base PostgreSQL.
============================================================ */

export async function removeActiveHotspotUser(
  api: RouterOSAPI,
  routerInternalId: string
): Promise<void> {
  await api.write("/ip/hotspot/active/remove", [
    `=.id=${routerInternalId}`,
  ]);
}

function parseActiveUserRow(
  row: Record<string, unknown>
): MikrotikActiveUser {
  return {
    routerInternalId:
      typeof row[".id"] === "string"
        ? (row[".id"] as string)
        : null,

    username:
      typeof row.user === "string"
        ? (row.user as string)
        : null,

    macAddress:
      typeof row["mac-address"] === "string"
        ? (row["mac-address"] as string).toUpperCase()
        : null,

    ipAddress:
      typeof row.address === "string"
        ? (row.address as string)
        : null,

    uploadBytes: parseByteCount(row["bytes-in"]),
    downloadBytes: parseByteCount(row["bytes-out"]),
  };
}

function parseByteCount(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}
