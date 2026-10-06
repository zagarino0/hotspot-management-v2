import { RouterOSAPI } from "node-routeros";

/* ============================================================
   TYPES
============================================================ */

export interface HotspotProfile {
  name: string;
  "default-profile"?: string;
  "rate-limit"?: string;
  "session-timeout"?: string;
  "idle-timeout"?: string;
  "keepalive-timeout"?: string;
  status?: string;
}

/* ============================================================
   FETCH HOTSPOT PROFILES
============================================================ */

export async function fetchHotspotProfiles(
  api: RouterOSAPI
): Promise<HotspotProfile[]> {
  try {
    const profiles = await api.write("/ip/hotspot/user/profile/print");
    return profiles as HotspotProfile[];
  } catch (error) {
    console.error("Erreur lors de la récupération des profils Hotspot:", error);
    throw error;
  }
}

/* ============================================================
   FETCH HOTSPOT USERS
============================================================ */

export async function fetchHotspotUsers(
  api: RouterOSAPI
): Promise<any[]> {
  try {
    const users = await api.write("/ip/hotspot/user/print");
    return users;
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs Hotspot:", error);
    throw error;
  }
}
