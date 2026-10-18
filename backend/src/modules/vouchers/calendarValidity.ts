export const CALENDAR_VALIDITY_PROFILES = new Set([
  "profil_24h",
  "profil_week",
  "profil_mothe_1",
  "profil_mothe_2",
  "profil_bonus",
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

export interface CalendarExpiryEnforcement {
  profile: string | null | undefined;
  expiresAt: Date | string | null | undefined;
  now?: Date;
  username: string;
  disabled: boolean;
  disableUser: (username: string) => Promise<void>;
  listActiveUsers: () => Promise<Array<{ username: string | null; routerInternalId: string | null }>>;
  removeActiveUser: (routerInternalId: string) => Promise<void>;
}

/** Applies the calendar lock only to an expired voucher in a targeted profile. */
export async function enforceCalendarExpiry(input: CalendarExpiryEnforcement): Promise<boolean> {
  if (!isCalendarVoucherExpired(input.profile, input.expiresAt, input.now)) return false;

  if (!input.disabled) await input.disableUser(input.username);

  const activeUsers = await input.listActiveUsers();
  for (const active of activeUsers) {
    if (
      active.username?.trim().toLowerCase() === input.username.trim().toLowerCase() &&
      active.routerInternalId
    ) {
      await input.removeActiveUser(active.routerInternalId);
    }
  }
  return true;
}
