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
  siteId: string,
  routerId?: string
): Promise<HotspotProfile[]> {
  const response = await api.get<HotspotProfilesResponse>(
    `/api/mikrotik/profiles/${siteId}`,
    { params: routerId ? { routerId } : undefined }
  );
  return response.data.profiles;
}
