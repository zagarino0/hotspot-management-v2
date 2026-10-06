import type { RouterOSAPI } from "node-routeros";

export interface MikrotikHotspotCookie {
  username: string | null;
  macAddress: string | null;
  expiresInSeconds: number | null;
}

export async function fetchHotspotCookies(
  api: RouterOSAPI
): Promise<MikrotikHotspotCookie[]> {
  const rows = await api.write("/ip/hotspot/cookie/print");

  return rows.map((row: Record<string, unknown>) => ({
    username:
      typeof row.user === "string"
        ? row.user.trim() || null
        : null,
    macAddress:
      typeof row["mac-address"] === "string"
        ? row["mac-address"].toUpperCase()
        : null,
    expiresInSeconds: parseTimeSeconds(row["expires-in"]),
  }));
}

function parseTimeSeconds(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const raw = value.trim().toLowerCase();
  const parts = raw.split(":");

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts.map(Number);

    if ([hours, minutes, seconds].every(Number.isFinite)) {
      return Math.max(
        0,
        Math.floor(
          hours * 3600 + minutes * 60 + seconds
        )
      );
    }
  }

  const match = raw.match(
    /(?:(\d+)w)?\s*(?:(\d+)d)?\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/
  );

  if (!match) {
    return null;
  }

  return (
    Number(match[1] ?? 0) * 7 * 24 * 3600 +
    Number(match[2] ?? 0) * 24 * 3600 +
    Number(match[3] ?? 0) * 3600 +
    Number(match[4] ?? 0) * 60 +
    Number(match[5] ?? 0)
  );
}
