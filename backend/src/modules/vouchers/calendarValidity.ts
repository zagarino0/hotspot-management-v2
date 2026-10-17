export const CALENDAR_VALIDITY_PROFILES = new Set([
  "profil_24h",
  "profil_week",
  "profil_mothe_1",
  "profil_mothe_2",
]);

export function isCalendarValidityProfile(profile: string | null | undefined): boolean {
  return profile != null && CALENDAR_VALIDITY_PROFILES.has(profile.trim().toLowerCase());
}

export function isCalendarVoucherExpired(
  profile: string | null | undefined,
  expiresAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!isCalendarValidityProfile(profile) || expiresAt == null) return false;
  const expiryMs = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
  return Number.isFinite(expiryMs) && expiryMs <= now.getTime();
}
