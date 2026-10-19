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


/** Parse RouterOS expiry comments in the router's Madagascar local timezone. */
export function parseRouterOsExpiryComment(comment: string | null | undefined): string | null {
  if (!comment?.trim()) return null;
  const match = comment.trim().match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/i);
  if (!match) return null;
  const months: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const month = months[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const localDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (localDate.getUTCFullYear() !== year || localDate.getUTCMonth() !== month - 1 || localDate.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return null;
  // Indian/Antananarivo is UTC+03:00 year-round.
  return new Date(localDate.getTime() - 3 * 60 * 60 * 1000).toISOString();
}
