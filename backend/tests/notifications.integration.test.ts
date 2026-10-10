import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/database/pool.js";
import { countRecentOfflineRouters, hasOfflineRoutersForSite, updateRouterHealth } from "../src/modules/routers/router.repository.js";
import {
  getNotificationSettings,
  publishNotification,
  resolveNotificationEvent,
  updateNotificationSettings,
} from "../src/modules/notifications/notification.service.js";

test("PostgreSQL notifications integration: preferences, site/org isolation, deduplication and resolution", async (t) => {
  const suffix = randomUUID();
  const orgA = randomUUID();
  const orgB = randomUUID();
  const siteA = randomUUID();
  const siteA2 = randomUUID();
  const siteB = randomUUID();
  const userA = randomUUID();
  const userA2 = randomUUID();
  const userB = randomUUID();
  const routerA1 = randomUUID();
  const routerA2 = randomUUID();
  const routerA2Site = randomUUID();
  const routerB = randomUUID();
  let seeded = false;

  t.after(async () => {
    if (seeded) {
      await pool.query("DELETE FROM router WHERE id = ANY($1::uuid[])", [[routerA1, routerA2, routerA2Site, routerB]]);
      await pool.query('DELETE FROM "user" WHERE id = ANY($1::uuid[])', [[userA, userA2, userB]]);
      await pool.query("DELETE FROM site WHERE id = ANY($1::uuid[])", [[siteA, siteA2, siteB]]);
      await pool.query("DELETE FROM organization WHERE id = ANY($1::uuid[])", [[orgA, orgB]]);
    }
    await pool.end();
  });

  await pool.query(
    "INSERT INTO organization (id,name,code) VALUES ($1,$2,$3),($4,$5,$6)",
    [orgA, "Notifications integration A", `NOTIF-A-${suffix}`, orgB, "Notifications integration B", `NOTIF-B-${suffix}`],
  );
  seeded = true;

  await pool.query(
    "INSERT INTO site (id,organization_id,name,code) VALUES ($1,$2,$3,$4),($5,$2,$6,$7),($8,$9,$10,$11)",
    [siteA, orgA, "Notifications site A", `SITE-A-${suffix}`,
     siteA2, "Notifications site A2", `SITE-A2-${suffix}`,
     siteB, orgB, "Notifications site B", `SITE-B-${suffix}`],
  );
  await pool.query(
    'INSERT INTO "user" (id,organization_id,username,password_hash,status) VALUES ($1,$2,$3,$4,$5),($6,$2,$7,$4,$5),($8,$9,$10,$4,$5)',
    [userA, orgA, `notif-a-${suffix}`, "integration-test-hash", "ACTIVE",
     userA2, `notif-a2-${suffix}`, userB, orgB, `notif-b-${suffix}`],
  );

  await pool.query(
    "INSERT INTO router (id,site_id,name,code,management_ip) VALUES ($1,$2,$3,$4,$5),($6,$2,$7,$8,$9),($10,$11,$12,$13,$14),($15,$16,$17,$18,$19)",
    [routerA1, siteA, "Router A1", `ROUTER-A1-${suffix}`, "192.0.2.11",
     routerA2, "Router A2", `ROUTER-A2-${suffix}`, "192.0.2.12",
     routerA2Site, siteA2, "Router A2 site", `ROUTER-A2S-${suffix}`, "192.0.2.13",
     routerB, siteB, "Router B", `ROUTER-B-${suffix}`, "192.0.2.14"],
  );
  const savedSettings = await updateNotificationSettings(userA, {
    enabled: true,
    newSessionEnabled: true,
    networkProblemEnabled: true,
    routerOfflineEnabled: true,
    routerOnlineEnabled: true,
    syncErrorEnabled: true,
    allSites: false,
    siteIds: [siteA],
  });
  assert.equal(savedSettings.allSites, false);
  assert.deepEqual(savedSettings.siteIds, [siteA]);

  const defaultSettings = await getNotificationSettings(userA2);
  assert.equal(defaultSettings.enabled, true);
  assert.equal(defaultSettings.allSites, true);

  const eventKey = `integration:router:${suffix}:sync-error`;
  const notification = {
    type: "SYNC_ERROR",
    severity: "WARNING",
    title: "Integration sync error",
    message: "PostgreSQL integration test",
    eventKey,
  } as const;

  const firstPublish = await publishNotification(orgA, { ...notification, siteId: siteA });
  assert.equal(firstPublish.length, 2, "both eligible users in the organization receive the site A event");
  const duplicatePublish = await publishNotification(orgA, { ...notification, siteId: siteA });
  assert.equal(duplicatePublish.length, 0, "an active event must not create duplicate notifications");

  const siteScopedPublish = await publishNotification(orgA, {
    ...notification,
    siteId: siteA2,
    eventKey: `integration:site-a2:${suffix}`,
  });
  assert.equal(siteScopedPublish.length, 1, "only the user whose site selection includes site A2 should receive the event");
  assert.equal(siteScopedPublish[0].userId, userA2);

  const otherOrgPublish = await publishNotification(orgB, {
    ...notification,
    siteId: siteB,
  });
  assert.equal(otherOrgPublish.length, 1, "notifications must be delivered only within their organization");
  assert.equal(otherOrgPublish[0].userId, userB);

  const resolvedCount = await resolveNotificationEvent(orgA, eventKey);
  assert.equal(resolvedCount, 2, "resolving an incident should resolve all eligible users' active copies");

  const resolvedRows = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM notification WHERE user_id = ANY($1::uuid[]) AND event_key = $2 AND resolved_at IS NOT NULL",
    [[userA, userA2], eventKey],
  );
  assert.equal(Number(resolvedRows.rows[0].count), 2);

  const otherOrgRows = await pool.query<{ resolved_at: string | null }>(
    'SELECT resolved_at FROM notification WHERE user_id = $1 AND event_key = $2',
    [userB, eventKey],
  );
  assert.equal(otherOrgRows.rows.length, 1);
  assert.equal(otherOrgRows.rows[0].resolved_at, null, "resolving an event in org A must not resolve org B's incident");

  const republished = await publishNotification(orgA, { ...notification, siteId: siteA });
  assert.equal(republished.length, 2, "a new occurrence after resolution may create a fresh active event");
  const failConnection = (routerId: string) => updateRouterHealth({
    routerId, reachable: false, connectionFailure: true, errorMessage: "integration connection failure",
  });
  const firstFailure = await failConnection(routerA1);
  assert.equal(firstFailure?.consecutiveConnectionFailures, 1);
  assert.equal(await countRecentOfflineRouters(orgA, siteA), 1, "one failed router is not yet a site-wide network incident");
  const secondFailure = await failConnection(routerA1);
  assert.equal(secondFailure?.consecutiveConnectionFailures, 2);

  await failConnection(routerA2);
  const secondRouterFailure = await failConnection(routerA2);
  assert.equal(secondRouterFailure?.consecutiveConnectionFailures, 2);
  assert.equal(await countRecentOfflineRouters(orgA, siteA), 2, "two routers offline within 30 seconds satisfy the site threshold");

  await failConnection(routerA2Site);
  await failConnection(routerA2Site);
  assert.equal(await countRecentOfflineRouters(orgA, siteA2), 1, "another site is counted independently");
  assert.equal(await countRecentOfflineRouters(orgA, siteA), 2, "another site does not affect site A");

  await failConnection(routerB);
  await failConnection(routerB);
  assert.equal(await countRecentOfflineRouters(orgA, siteB), 0, "an organization cannot count another organization site");
  assert.equal(await countRecentOfflineRouters(orgB, siteB), 1);

  const recoveredA1 = await updateRouterHealth({ routerId: routerA1, reachable: true });
  assert.equal(recoveredA1?.currentStatus, "ONLINE");
  assert.equal(recoveredA1?.consecutiveConnectionFailures, 0);
  assert.equal(await countRecentOfflineRouters(orgA, siteA), 1, "recovered routers leave the offline count");
  assert.equal(await hasOfflineRoutersForSite(orgA, siteA), true, "the incident remains while another router is offline");

  await updateRouterHealth({ routerId: routerA2, reachable: true });
  assert.equal(await countRecentOfflineRouters(orgA, siteA), 0);
  assert.equal(await hasOfflineRoutersForSite(orgA, siteA), false, "the site incident clears after all configured routers recover");
});
