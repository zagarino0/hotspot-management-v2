import type { RouterOSAPI } from "node-routeros";

export interface MikrotikHotspotUser {
  username: string;
  profile: string | null;
  limitUptimeSeconds: number | null;
  uptimeSeconds: number;
  macAddress: string | null;
  comment: string | null;
  disabled: boolean;
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
      uptimeSeconds:
        parseOptionalTimeSeconds(row.uptime) ?? 0,
      macAddress:
        typeof row["mac-address"] === "string"
          ? row["mac-address"].trim().toUpperCase() || null
          : null,
      comment:
        typeof row.comment === "string"
          ? row.comment.trim() || null
          : null,
      disabled:
        row.disabled === true ||
        row.disabled === "true" ||
        row.disabled === "yes" ||
        row.disabled === 1 ||
        row.disabled === "1",
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
  // Les commentaires générés utilisent MM.DD.YY (ex. "up-573-06.20.26-").
  // On conserve aussi le format DD.MM.YY pour les anciens commentaires
  // lorsque le format américain est invalide.
  const match = comment.match(
    /(?:^|[^0-9])(\d{2})\.(\d{2})\.(\d{2}|\d{4})(?:[^0-9]|$)/
  );

  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = match[3].length === 2 ? 2000 + rawYear : rawYear;

  const toIsoDate = (month: number, day: number): string | null => {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) return null;
    return date.toISOString();
  };

  return toIsoDate(first, second) ?? toIsoDate(second, first);
}


export interface CreateHotspotUserInput {
  username: string;
  password?: string;
  profile: string;
  limitUptimeSeconds?: number | null;
  comment: string;
}

export async function createHotspotUser(
  api: RouterOSAPI,
  input: CreateHotspotUserInput,
  skipDuplicateCheck = false
): Promise<void> {
  const username = input.username.trim();
  if (!skipDuplicateCheck) {
    const existing = await api.write("/ip/hotspot/user/print");
    if (existing.some((row: Record<string, unknown>) =>
      typeof row.name === "string" &&
      row.name.trim().toLowerCase() === username.toLowerCase()
    )) {
      throw new Error(`L'utilisateur MikroTik "${username}" existe déjà.`);
    }
  }

  const args = [
    `=name=${username}`,
    `=password=${(input.password ?? username).trim()}`,
    `=profile=${input.profile.trim()}`,
    `=comment=${input.comment.trim()}`,
  ];
  if (input.limitUptimeSeconds && input.limitUptimeSeconds > 0) {
    args.push(`=limit-uptime=${formatRouterOsDuration(input.limitUptimeSeconds)}`);
  }
  await api.write("/ip/hotspot/user/add", args);
}

export async function deleteHotspotUser(
  api: RouterOSAPI,
  username: string
): Promise<void> {
  const rows = await api.write("/ip/hotspot/user/print");
  const target = rows.find((row: Record<string, unknown>) =>
    typeof row.name === "string" &&
    row.name.trim().toLowerCase() === username.trim().toLowerCase()
  );
  if (!target) return;
  if (typeof target[".id"] !== "string") {
    throw new Error(`Impossible d'identifier l'utilisateur MikroTik "${username}".`);
  }
  await api.write("/ip/hotspot/user/remove", [`=.id=${target[".id"]}`]);
}

function formatRouterOsDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [days ? `${days}d` : "", hours ? `${hours}h` : "",
    minutes ? `${minutes}m` : "", remainder ? `${remainder}s` : ""]
    .filter(Boolean).join("") || "0s";
}

export async function updateHotspotUserComment(
  api: RouterOSAPI,
  username: string,
  comment: string
): Promise<void> {
  const rows = await api.write("/ip/hotspot/user/print");
  const target = rows.find(
    (row: Record<string, unknown>) =>
      typeof row.name === "string" &&
      row.name.trim() === username.trim()
  );

  if (!target || typeof target[".id"] !== "string") {
    throw new Error(`Utilisateur MikroTik "${username}" introuvable.`);
  }

  await api.write("/ip/hotspot/user/set", [
    `=.id=${target[".id"]}`,
    `=comment=${comment}`,
  ]);
}


export async function setHotspotUserDisabled(
  api: RouterOSAPI,
  username: string,
  disabled: boolean
): Promise<void> {
  const rows = await api.write("/ip/hotspot/user/print");
  const target = rows.find(
    (row: Record<string, unknown>) =>
      typeof row.name === "string" &&
      row.name.trim().toLowerCase() === username.trim().toLowerCase()
  );

  if (!target || typeof target[".id"] !== "string") {
    throw new Error(`Utilisateur MikroTik "${username}" introuvable.`);
  }

  await api.write("/ip/hotspot/user/set", [
    `=.id=${target[".id"]}`,
    `=disabled=${disabled ? "yes" : "no"}`,
  ]);
}
