import type { RouterOSAPI } from "node-routeros";

export interface MikrotikHotspotUser {
  username: string;
  profile: string | null;
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
    }))
    .filter((user) => user.username.length > 0);
}
