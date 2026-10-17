import test from "node:test";
import assert from "node:assert/strict";
import { isCalendarValidityProfile, isCalendarVoucherExpired } from "../src/modules/vouchers/calendarValidity.js";

test("calendar validity applies only to the four configured profiles, case-insensitively", () => {
  for (const profile of ["profil_24H", "PROFIL_WEEK", "profil_mothe_1", "profil_mothe_2"]) {
    assert.equal(isCalendarValidityProfile(profile), true, profile);
  }
  for (const profile of ["profil_3h", "default", "", null, undefined]) {
    assert.equal(isCalendarValidityProfile(profile), false, String(profile));
  }
});

test("calendar expiry uses absolute expiry time, including while the voucher is offline", () => {
  const now = new Date("2026-10-17T18:00:00.000Z");
  assert.equal(isCalendarVoucherExpired("profil_24H", "2026-10-17T17:59:59.000Z", now), true);
  assert.equal(isCalendarVoucherExpired("profil_week", "2026-10-17T18:00:00.000Z", now), true);
  assert.equal(isCalendarVoucherExpired("profil_mothe_1", "2026-10-17T18:00:01.000Z", now), false);
  assert.equal(isCalendarVoucherExpired("profil_3h", "2026-10-16T00:00:00.000Z", now), false);
  assert.equal(isCalendarVoucherExpired("profil_24h", null, now), false);
});

test("repeated expiry evaluation is stable and does not extend the deadline", () => {
  const expiresAt = "2026-10-17T17:00:00.000Z";
  const first = isCalendarVoucherExpired("profil_24h", expiresAt, new Date("2026-10-17T18:00:00.000Z"));
  const afterReconnect = isCalendarVoucherExpired("profil_24h", expiresAt, new Date("2026-10-17T19:00:00.000Z"));
  assert.equal(first, true);
  assert.equal(afterReconnect, true);
});
