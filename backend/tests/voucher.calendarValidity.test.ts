import test from "node:test";
import assert from "node:assert/strict";
import { enforceCalendarExpiry, isCalendarValidityProfile, isCalendarVoucherExpired } from "../src/modules/vouchers/calendarValidity.js";

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

test("expired voucher enforcement disables once and disconnects matching active sessions", async () => {
  let disableCalls = 0;
  const removed: string[] = [];
  const enforced = await enforceCalendarExpiry({
    profile: "profil_24H",
    expiresAt: "2026-10-17T17:00:00.000Z",
    now: new Date("2026-10-17T18:00:00.000Z"),
    username: "VOUCHER-01",
    disabled: false,
    disableUser: async () => { disableCalls += 1; },
    listActiveUsers: async () => [
      { username: "voucher-01", routerInternalId: "*A1" },
      { username: "other-user", routerInternalId: "*A2" },
      { username: "voucher-01", routerInternalId: null },
    ],
    removeActiveUser: async (id) => { removed.push(id); },
  });
  assert.equal(enforced, true);
  assert.equal(disableCalls, 1);
  assert.deepEqual(removed, ["*A1"]);
});

test("repeated synchronization is idempotent and never resets expiry after reconnect", async () => {
  const fixedExpiry = "2026-10-17T17:00:00.000Z";
  let disableCalls = 0;
  let removeCalls = 0;
  const runSync = (disabled: boolean, now: string) => enforceCalendarExpiry({
    profile: "profil_week",
    expiresAt: fixedExpiry,
    now: new Date(now),
    username: "week-01",
    disabled,
    disableUser: async () => { disableCalls += 1; },
    listActiveUsers: async () => [],
    removeActiveUser: async () => { removeCalls += 1; },
  });
  assert.equal(await runSync(false, "2026-10-17T18:00:00.000Z"), true);
  // RouterOS reports disabled on the next sync; expiry remains the original timestamp.
  assert.equal(await runSync(true, "2026-10-17T19:00:00.000Z"), true);
  assert.equal(disableCalls, 1);
  assert.equal(removeCalls, 0);
  assert.equal(isCalendarVoucherExpired("profil_week", fixedExpiry, new Date("2026-10-17T19:00:00.000Z")), true);
});

test("unexpired or non-target vouchers never trigger RouterOS enforcement", async () => {
  let calls = 0;
  const common = {
    expiresAt: "2026-10-18T17:00:00.000Z",
    now: new Date("2026-10-17T18:00:00.000Z"),
    username: "user-01",
    disabled: false,
    disableUser: async () => { calls += 1; },
    listActiveUsers: async () => { calls += 1; return []; },
    removeActiveUser: async () => { calls += 1; },
  };
  assert.equal(await enforceCalendarExpiry({ ...common, profile: "profil_24H" }), false);
  assert.equal(await enforceCalendarExpiry({ ...common, profile: "profil_3h" }), false);
  assert.equal(calls, 0);
});
