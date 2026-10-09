import type { RouterOSAPI } from "node-routeros";

import { pool } from "../../database/pool.js";
import { decryptSecret } from "../../lib/crypto.js";
import { badRequest, conflict, notFoundError } from "../../lib/errors.js";
import { connectMikroTik } from "../../mikrotik/connection.js";
import {
  fetchHotspotUsers,
  setHotspotUserDisabled,
  type MikrotikHotspotUser,
} from "../../mikrotik/hotspotUsers.js";
import { fetchActiveHotspotUsers, removeActiveHotspotUser } from "../../mikrotik/hotspotActive.js";
import {
  findRouterCredential,
  type RouterCredentialRow,
} from "../routers/router.repository.js";

interface PointOfSaleTarget {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: "INTERNAL" | "EXTERNAL";
  status: "ACTIVE" | "INACTIVE";
}

interface RouterTarget {
  id: string;
  siteId: string;
  name: string;
  managementIp: string;
  apiPort: number;
}

interface ActionSummary {
  routersProcessed: number;
  vouchersMatched: number;
  vouchersChanged: number;
  sessionsDisconnected: number;
}

async function findPointOfSaleById(
  id: string,
  userId: string
): Promise<PointOfSaleTarget> {
  const result = await pool.query<PointOfSaleTarget>(
    `
      SELECT
        pos.id,
        pos.organization_id AS "organizationId",
        pos.code,
        pos.name,
        pos.type,
        pos.status
      FROM point_of_sale pos
      JOIN "user" u
        ON u.organization_id = pos.organization_id
      WHERE pos.id = $1
        AND u.id = $2
      LIMIT 1
    `,
    [id, userId]
  );

  const pos = result.rows[0];

  if (!pos) {
    throw notFoundError("Point de vente introuvable.");
  }

  if (pos.type !== "EXTERNAL") {
    throw badRequest(
      "Seuls les points de vente externes peuvent être contrôlés par cette fonction."
    );
  }

  return pos;
}

async function findOrganizationRouters(
  organizationId: string
): Promise<RouterTarget[]> {
  const result = await pool.query<RouterTarget>(
    `
      SELECT
        r.id,
        r.site_id AS "siteId",
        r.name,
        r.management_ip::text AS "managementIp",
        r.api_port AS "apiPort"
      FROM router r
      JOIN site s ON s.id = r.site_id
      WHERE s.organization_id = $1
        AND r.management_ip IS NOT NULL
      ORDER BY r.name ASC
    `,
    [organizationId]
  );

  return result.rows;
}

async function connectRouter(
  router: RouterTarget
): Promise<{ api: RouterOSAPI; credential: RouterCredentialRow }> {
  const credential = await findRouterCredential(router.id);

  if (!credential) {
    throw conflict(
      `Aucun identifiant MikroTik actif pour le routeur "${router.name}".`
    );
  }

  let password: string;

  try {
    password = decryptSecret(credential.encryptedSecret);
  } catch {
    throw conflict(
      `Le secret MikroTik du routeur "${router.name}" est illisible.`
    );
  }

  const host = router.managementIp.split("/")[0].trim();

  const api = await connectMikroTik({
    host,
    port: router.apiPort,
    user: credential.username,
    password,
  });

  return { api, credential };
}

async function appendVoucherEvent(data: {
  voucherId?: string | null;
  siteId: string;
  routerId: string;
  username: string;
  voucherCode: string;
  pointOfSaleId: string;
  pointOfSaleCode: string;
  eventType: "DISABLED" | "ENABLED" | "SESSION_ENDED";
  eventKey: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO voucher_event (
       voucher_id, site_id, router_id, username, voucher_code,
       point_of_sale_id, point_of_sale_code, event_type, source,
       event_key, metadata
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'APPLICATION',$9,$10::jsonb)
     ON CONFLICT (event_key) DO NOTHING`,
    [
      data.voucherId ?? null,
      data.siteId,
      data.routerId,
      data.username,
      data.voucherCode,
      data.pointOfSaleId,
      data.pointOfSaleCode,
      data.eventType,
      data.eventKey,
      JSON.stringify(data.metadata),
    ]
  );
}

async function findVoucherForRouterUser(
  routerId: string,
  username: string
): Promise<{
  id: string;
  code: string;
  disabled: boolean;
  disabledReason: string | null;
} | null> {
  const result = await pool.query<{
    id: string;
    code: string;
    disabled: boolean;
    disabledReason: string | null;
  }>(
    `
      SELECT
        id,
        code,
        mikrotik_disabled AS disabled,
        mikrotik_disabled_reason AS "disabledReason"
      FROM voucher
      WHERE router_id = $1
        AND mikrotik_username = $2
      LIMIT 1
    `,
    [routerId, username]
  );

  return result.rows[0] ?? null;
}

async function disconnectVoucherSessions(
  router: RouterTarget,
  api: RouterOSAPI,
  username: string,
  voucher: { id: string; code: string } | null,
  pointOfSale: PointOfSaleTarget
): Promise<number> {
  const activeUsers = await fetchActiveHotspotUsers(api);
  const matches = activeUsers.filter(
    (active) =>
      active.username?.trim().toLowerCase() === username.trim().toLowerCase()
  );

  if (matches.length === 0) {
    return 0;
  }

  const sessionResult = await pool.query<{
    id: string;
  }>(
    `
      SELECT id
      FROM session
      WHERE router_id = $1
        AND LOWER(username) = LOWER($2)
        AND status = 'ACTIVE'
    `,
    [router.id, username]
  );

  for (const active of matches) {
    if (active.routerInternalId) {
      await removeActiveHotspotUser(api, active.routerInternalId);
    }
  }

  await pool.query(
    `
      UPDATE session
      SET
        status = 'TERMINATED',
        ended_at = NOW(),
        termination_reason = 'POINT_OF_SALE_DISABLED',
        updated_at = NOW()
      WHERE router_id = $1
        AND LOWER(username) = LOWER($2)
        AND status = 'ACTIVE'
    `,
    [router.id, username]
  );

  for (const session of sessionResult.rows) {
    await appendVoucherEvent({
      voucherId: voucher?.id ?? null,
      siteId: router.siteId,
      routerId: router.id,
      username,
      voucherCode: voucher?.code ?? username,
      pointOfSaleId: pointOfSale.id,
      pointOfSaleCode: pointOfSale.code,
      eventType: "SESSION_ENDED",
      eventKey: `session:${session.id}:ended:pos:${pointOfSale.id}`,
      metadata: {
        reason: "POINT_OF_SALE_DISABLED",
        pointOfSaleCode: pointOfSale.code,
      },
    });
  }

  return matches.length;
}

async function disablePointOfSaleOnRouter(
  pointOfSale: PointOfSaleTarget,
  router: RouterTarget
): Promise<{ matched: number; changed: number; disconnected: number }> {
  const { api } = await connectRouter(router);

  try {
    const hotspotUsers = await fetchHotspotUsers(api);
    const normalizedCode = pointOfSale.code.trim().toLowerCase();

    const matches = hotspotUsers.filter(
      (user) =>
        user.comment?.trim().toLowerCase().includes(normalizedCode)
    );

    let changed = 0;
    let disconnected = 0;

    for (const user of matches) {
      const voucher = await findVoucherForRouterUser(router.id, user.username);

      if (!user.disabled) {
        await setHotspotUserDisabled(api, user.username, true);
        changed += 1;

        if (voucher) {
          await pool.query(
            `
              UPDATE voucher
              SET
                mikrotik_disabled = true,
                mikrotik_disabled_reason = 'POINT_OF_SALE_DISABLED',
                mikrotik_last_seen_at = NOW(),
                updated_at = NOW()
              WHERE id = $1
            `,
            [voucher.id]
          );
        }

        await appendVoucherEvent({
          voucherId: voucher?.id ?? null,
          siteId: router.siteId,
          routerId: router.id,
          username: user.username,
          voucherCode: voucher?.code ?? user.username,
          pointOfSaleId: pointOfSale.id,
          pointOfSaleCode: pointOfSale.code,
          eventType: "DISABLED",
          eventKey: `voucher:${router.id}:${user.username}:disabled:pos:${pointOfSale.id}:${Date.now()}`,
          metadata: {
            reason: "POINT_OF_SALE_DISABLED",
            pointOfSaleCode: pointOfSale.code,
            comment: user.comment,
          },
        });
      }

      disconnected += await disconnectVoucherSessions(
        router,
        api,
        user.username,
        voucher,
        pointOfSale
      );
    }

    return {
      matched: matches.length,
      changed,
      disconnected,
    };
  } finally {
    await api.close();
  }
}

async function enablePointOfSaleOnRouter(
  pointOfSale: PointOfSaleTarget,
  router: RouterTarget
): Promise<{ matched: number; changed: number }> {
  const { api } = await connectRouter(router);

  try {
    const hotspotUsers = await fetchHotspotUsers(api);
    const normalizedCode = pointOfSale.code.trim().toLowerCase();

    const matches = hotspotUsers.filter(
      (user) =>
        user.comment?.trim().toLowerCase().includes(normalizedCode)
    );

    let changed = 0;

    for (const user of matches) {
      const voucher = await findVoucherForRouterUser(router.id, user.username);

      if (!voucher || voucher.disabledReason !== "POINT_OF_SALE_DISABLED") {
        continue;
      }

      if (user.disabled) {
        await setHotspotUserDisabled(api, user.username, false);
        changed += 1;

        await appendVoucherEvent({
          voucherId: voucher.id,
          siteId: router.siteId,
          routerId: router.id,
          username: user.username,
          voucherCode: voucher.code,
          pointOfSaleId: pointOfSale.id,
          pointOfSaleCode: pointOfSale.code,
          eventType: "ENABLED",
          eventKey: `voucher:${router.id}:${user.username}:enabled:pos:${pointOfSale.id}:${Date.now()}`,
          metadata: {
            reason: "POINT_OF_SALE_REACTIVATED",
            pointOfSaleCode: pointOfSale.code,
            comment: user.comment,
          },
        });
      }

      await pool.query(
        `
          UPDATE voucher
          SET
            mikrotik_disabled = false,
            mikrotik_disabled_reason = NULL,
            mikrotik_last_seen_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `,
        [voucher.id]
      );
    }

    return {
      matched: matches.length,
      changed,
    };
  } finally {
    await api.close();
  }
}

async function updatePointOfSaleStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<PointOfSaleTarget> {
  const result = await pool.query<PointOfSaleTarget>(
    `
      UPDATE point_of_sale
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        organization_id AS "organizationId",
        code,
        name,
        type,
        status
    `,
    [id, status]
  );

  if (!result.rows[0]) {
    throw notFoundError("Point de vente introuvable.");
  }

  return result.rows[0];
}

export async function deactivatePointOfSale(
  userId: string,
  id: string
) {
  const pointOfSale = await findPointOfSaleById(id, userId);
  const routers = await findOrganizationRouters(pointOfSale.organizationId);

  if (routers.length === 0) {
    throw conflict(
      "Aucun routeur MikroTik configuré pour cette organisation : la désactivation réseau ne peut pas être appliquée."
    );
  }

  const summary: ActionSummary = {
    routersProcessed: 0,
    vouchersMatched: 0,
    vouchersChanged: 0,
    sessionsDisconnected: 0,
  };

  // Persist the desired state before touching routers. The synchronizer reads
  // point_of_sale.status on every cycle; updating it afterwards lets a sync
  // cycle re-enable vouchers while this deactivation is disabling them.
  const updatedPointOfSale = await updatePointOfSaleStatus(id, "INACTIVE");

  for (const router of routers) {
    const result = await disablePointOfSaleOnRouter(updatedPointOfSale, router);
    summary.routersProcessed += 1;
    summary.vouchersMatched += result.matched;
    summary.vouchersChanged += result.changed;
    summary.sessionsDisconnected += result.disconnected;
  }

  return {
    pointOfSale: updatedPointOfSale,
    summary,
  };
}

export async function activatePointOfSale(
  userId: string,
  id: string
) {
  const pointOfSale = await findPointOfSaleById(id, userId);
  const routers = await findOrganizationRouters(pointOfSale.organizationId);

  if (routers.length === 0) {
    throw conflict(
      "Aucun routeur MikroTik configuré pour cette organisation : la réactivation réseau ne peut pas être appliquée."
    );
  }

  const summary = {
    routersProcessed: 0,
    vouchersMatched: 0,
    vouchersChanged: 0,
  };

  // Publish the desired state before enabling users on MikroTik. Otherwise
  // the synchronizer still sees INACTIVE and can disable users immediately
  // after this service enables them, producing contradictory audit events.
  const updatedPointOfSale = await updatePointOfSaleStatus(id, "ACTIVE");

  for (const router of routers) {
    const result = await enablePointOfSaleOnRouter(updatedPointOfSale, router);
    summary.routersProcessed += 1;
    summary.vouchersMatched += result.matched;
    summary.vouchersChanged += result.changed;
  }

  return {
    pointOfSale: updatedPointOfSale,
    summary,
  };
}
