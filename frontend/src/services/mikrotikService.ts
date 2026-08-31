import api from "./api";

export interface HotspotProfile {
  name: string;
  "default-profile"?: string;
  "rate-limit"?: string;
  "session-timeout"?: string;
  "idle-timeout"?: string;
  "keepalive-timeout"?: string;
  status?: string;
}

export interface HotspotProfilesResponse {
  profiles: HotspotProfile[];
  count: number;
}

export async function getHotspotProfiles(
  siteId: string
): Promise<HotspotProfile[]> {
  const response = await api.get<HotspotProfilesResponse>(
    `/api/mikrotik/profiles/${siteId}`
  );
  return response.data.profiles;
}
