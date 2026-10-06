import type { RouterOSAPI } from "node-routeros";

export interface MikrotikHotspotUser {
  username: string;
  profile: string | null;
  limitUptimeSeconds: number | null;
  macAddress: string | null;
  comment: string | null;
  createdAt: string | null;
}

export async function fetchHotspotUsers(
  api: RouterOSAPI
): Promise<MikrotikHotspotUser[]> {
  const rows = await api.write("/ip/hotspot/user/print");

  return rows
    .map((row: Record<string, unknown>) => ({
      username:
        typeof row.name === "string"
          ? row.name.trim()
          : "",
      profile:
        typeof row.profile === "string"
          ? row.profile.trim() || null
          : null,
      limitUptimeSeconds: parseOptionalTimeSeconds(
        row["limit-uptime"]
      ),
      macAddress:
        typeof row["mac-address"] === "string"
          ? row["mac-address"].trim().toUpperCase() || null
          : null,
      comment:
        typeof row.comment === "string"
          ? row.comment.trim() || null
          : null,
      createdAt:
        typeof row.comment === "string"
          ? parseCreationDate(row.comment)
          : null,
    }))
    .filter((user) => user.username.length > 0);
}

function parseOptionalTimeSeconds(
  value: unknown
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? Math.max(0, Math.floor(value))
      : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim().toLowerCase();

  if (!raw || raw === "0" || raw === "0s") {
    return null;
  }

  const parts = raw.split(":");

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts.map(Number);

    if ([hours, minutes, seconds].every(Number.isFinite)) {
      return Math.max(
        0,
        Math.floor(
          hours * 3600 +
            minutes * 60 +
            seconds
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

  const seconds =
    Number(match[1] ?? 0) * 7 * 24 * 3600 +
    Number(match[2] ?? 0) * 24 * 3600 +
    Number(match[3] ?? 0) * 3600 +
    Number(match[4] ?? 0) * 60 +
    Number(match[5] ?? 0);

  return Number.isFinite(seconds)
    ? Math.max(0, Math.floor(seconds))
    : null;
}


function parseCreationDate(comment: string): string | null {
  const match = comment.match(
    /(?:^|[^0-9])(\d{2})\.(\d{2})\.(\d{2}|\d{4})(?:[^0-9]|$)/
  );

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = Number(match[3]);
  const year =
    match[3].length === 2 ? 2000 + rawYear : rawYear;

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString();
}
