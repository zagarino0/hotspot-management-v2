export interface Settings {
  platformName: string;
  organization: string;
  language: string;
  timezone: string;
  hotspotName: string;
  captivePortalEnabled: boolean;
  voucherExpirationEnabled: boolean;
  rateLimitEnabled: boolean;
  systemAlertsEnabled: boolean;
  routerOfflineAlertsEnabled: boolean;
  syncErrorsEnabled: boolean;
  authRequired: boolean;
  sessionExpirationMinutes: number;
  httpsEnabled: boolean;
  mikrotikSyncEnabled: boolean;
  theme: "light" | "dark" | "system";
  animationsEnabled: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  platformName: "Hotspot Management V2",
  organization: "NetConnect Solutions",
  language: "fr",
  timezone: "Indian/Antananarivo",
  hotspotName: "WIFI MAHAVOKY",
  captivePortalEnabled: true,
  voucherExpirationEnabled: true,
  rateLimitEnabled: true,
  systemAlertsEnabled: true,
  routerOfflineAlertsEnabled: true,
  syncErrorsEnabled: true,
  authRequired: true,
  sessionExpirationMinutes: 60,
  httpsEnabled: true,
  mikrotikSyncEnabled: true,
  theme: "light",
  animationsEnabled: true,
};

const SETTINGS_KEY = "hotspot_settings";

/* ============================================================
   GET SETTINGS
============================================================ */

export async function getSettings(): Promise<Settings> {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }

  return { ...DEFAULT_SETTINGS };
}

/* ============================================================
   UPDATE SETTINGS
============================================================ */

export async function updateSettings(
  settings: Partial<Settings>
): Promise<Settings> {
  try {
    const current = await getSettings();
    const updated = { ...current, ...settings };

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));

    return updated;
  } catch (error) {
    console.error("Error saving settings:", error);
    throw new Error("Failed to save settings");
  }
}

/* ============================================================
   RESET SETTINGS
============================================================ */

export async function resetSettings(): Promise<Settings> {
  try {
    localStorage.removeItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS };
  } catch (error) {
    console.error("Error resetting settings:", error);
    throw new Error("Failed to reset settings");
  }
}
