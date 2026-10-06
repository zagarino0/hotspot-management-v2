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
  uptimeSeconds: number;
  sessionTimeLeftSeconds: number | null;
  loginMethod: string | null;
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
    uptimeSeconds: parseUptimeSeconds(row.uptime),
    sessionTimeLeftSeconds: parseOptionalTimeSeconds(
      row["session-time-left"]
    ),
    loginMethod:
      typeof row["login-by"] === "string"
        ? row["login-by"]
        : null,
  };
}

function parseUptimeSeconds(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const raw = value.trim().toLowerCase();

  if (!raw) {
    return 0;
  }

  let remaining = raw;
  let seconds = 0;

  const weeks = remaining.match(/^(\d+)w/);
  if (weeks) {
    seconds += Number(weeks[1]) * 7 * 24 * 60 * 60;
    remaining = remaining.slice(weeks[0].length);
  }

  const days = remaining.match(/^(\d+)d/);
  if (days) {
    seconds += Number(days[1]) * 24 * 60 * 60;
    remaining = remaining.slice(days[0].length);
  }

  remaining = remaining.trim();

  const timeParts = remaining.split(":");
  if (timeParts.length === 3) {
    const [hours, minutes, secs] = timeParts.map(Number);

    if ([hours, minutes, secs].every(Number.isFinite)) {
      return Math.max(
        0,
        Math.floor(
          seconds +
            hours * 60 * 60 +
            minutes * 60 +
            secs
        )
      );
    }
  }

  const durationPattern =
    /(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/;

  const match = remaining.match(durationPattern);

  if (match) {
    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2] ?? 0);
    const secs = Number(match[3] ?? 0);

    if ([hours, minutes, secs].every(Number.isFinite)) {
      return Math.max(
        0,
        Math.floor(
          seconds +
            hours * 60 * 60 +
            minutes * 60 +
            secs
        )
      );
    }
  }

  return seconds;
}

function parseOptionalTimeSeconds(
  value: unknown
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && !value.trim()) {
    return null;
  }

  return parseUptimeSeconds(value);
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
