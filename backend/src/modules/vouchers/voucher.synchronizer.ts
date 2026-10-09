import { pool } from "../../database/pool.js";
import type { RouterForSync } from "../routers/router.repository.js";
import type { MikrotikHotspotUser } from "../../mikrotik/hotspotUsers.js";
import type { RouterOSAPI } from "node-routeros";
import { setHotspotUserDisabled } from "../../mikrotik/hotspotUsers.js";

interface PointOfSaleRef {
  id: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
}

interface ExistingVoucher {
  id: string;
  pointOfSaleId: string | null;
  mikrotikDisabled: boolean;
}

function deriveVoucherStatus(user: MikrotikHotspotUser): "UNUSED" | "ACTIVE" | "EXPIRED" | "DISABLED" {
  if (user.disabled) return "DISABLED";

  const quotaExhausted =
    user.limitUptimeSeconds !== null &&
    user.limitUptimeSeconds > 0 &&
    user.uptimeSeconds >= user.limitUptimeSeconds;

  if (quotaExhausted) return "EXPIRED";
  if (user.macAddress?.trim() || user.uptimeSeconds > 0) return "ACTIVE";
  return "UNUSED";
}

function findPointOfSale(
  comment: string | null,
  pointOfSales: PointOfSaleRef[]
): PointOfSaleRef | null {
  const normalized = comment?.trim().toLowerCase();
  if (!normalized) return null;

  const matches = pointOfSales.filter((pos) =>
    normalized.includes(pos.code.trim().toLowerCase())
  );

  if (matches.length === 0) return null;

  // Prefer the most specific code. For example, "CASH" is contained in
  // "CASHPOINTWIFI", so the shorter code must not make the match ambiguous.
  const longestCodeLength = Math.max(
    ...matches.map((pos) => pos.code.trim().length)
  );
  const mostSpecificMatches = matches.filter(
    (pos) => pos.code.trim().length === longestCodeLength
  );

  return mostSpecificMatches.length === 1 ? mostSpecificMatches[0] : null;
}

async function appendVoucherEvent(data: {
  voucherId?: string | null;
  siteId: string;
  routerId: string;
  username: string;
  voucherCode: string;
  pointOfSaleId?: string | null;
  pointOfSaleCode?: string | null;
  eventType:
    | "DISCOVERED"
    | "POS_IDENTIFIED"
    | "DISABLED"
    | "ENABLED"
    | "DELETED_FROM_MIKROTIK"
    | "SYNC_ANOMALY";
  eventKey: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO voucher_event (
       voucher_id, site_id, router_id, username, voucher_code,
       point_of_sale_id, point_of_sale_code, event_type, source,
       event_key, metadata
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'SYNCHRONIZER',$9,$10::jsonb)
     ON CONFLICT (event_key) DO NOTHING`,
    [
      data.voucherId ?? null,
      data.siteId,
      data.routerId,
      data.username,
      data.voucherCode,
      data.pointOfSaleId ?? null,
      data.pointOfSaleCode ?? null,
      data.eventType,
      data.eventKey,
      JSON.stringify(data.metadata ?? {}),
    ]
  );
}

async function findPlanIdForProfile(
  siteId: string,
  profile: string | null
): Promise<string | null> {
  if (!profile?.trim()) return null;

  const result = await pool.query<{ id: string }>(
    `SELECT p.id
       FROM plan p
      WHERE p.site_id = $1
        AND p.mikrotik_profile_code = $2
        AND p.status = 'ACTIVE'
      ORDER BY p.created_at ASC
      LIMIT 2`,
    [siteId, profile.trim()]
  );

  return result.rows.length === 1 ? result.rows[0].id : null;
}

async function findExistingVoucher(
  routerId: string,
  siteId: string,
  username: string
): Promise<ExistingVoucher | null> {
  const byIdentity = await pool.query<ExistingVoucher>(
    `SELECT id,
            point_of_sale_id AS "pointOfSaleId",
            mikrotik_disabled AS "mikrotikDisabled"
       FROM voucher
      WHERE router_id = $1
        AND mikrotik_username = $2
      LIMIT 1`,
    [routerId, username]
  );

  if (byIdentity.rows[0]) return byIdentity.rows[0];

  const byCode = await pool.query<ExistingVoucher>(
    `SELECT id,
            point_of_sale_id AS "pointOfSaleId",
            mikrotik_disabled AS "mikrotikDisabled"
       FROM voucher
      WHERE site_id = $1
        AND code = $2
        AND router_id IS NULL
      LIMIT 1`,
    [siteId, username]
  );

  return byCode.rows[0] ?? null;
}

async function upsertVoucher(
  router: RouterForSync,
  user: MikrotikHotspotUser,
  pointOfSale: PointOfSaleRef | null,
  planId: string | null
): Promise<{
  id: string;
  created: boolean;
  previousDisabled: boolean | null;
  previousPointOfSaleId: string | null;
  stateChangedAt: string | null;
}> {
  const existing = await findExistingVoucher(router.id, router.siteId, user.username);
  const status = deriveVoucherStatus(user);

  if (existing) {
    const result = await pool.query<{ id: string; stateChangedAt: string | null }>(
      `UPDATE voucher
          SET plan_id = COALESCE($2, plan_id),
              router_id = $3,
              mikrotik_username = $4,
              mikrotik_profile = $5,
              mikrotik_comment = $6,
              mikrotik_state_changed_at = CASE
                WHEN mikrotik_disabled IS DISTINCT FROM $7 THEN clock_timestamp()
                ELSE mikrotik_state_changed_at
              END,
              mikrotik_disabled = $7,
              mikrotik_disabled_reason = CASE
                WHEN $7 = false THEN NULL
                ELSE mikrotik_disabled_reason
              END,
              mikrotik_last_seen_at = NOW(),
              -- A missing/ambiguous comment match must not erase a known POS link.
              point_of_sale_id = COALESCE($8, point_of_sale_id),
              duration_seconds = COALESCE($9, duration_seconds),
              status = $10,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id,
                  to_char(
                    mikrotik_state_changed_at AT TIME ZONE 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                  ) AS "stateChangedAt"
      `,
      [
        existing.id, planId, router.id, user.username, user.profile,
        user.comment, user.disabled, pointOfSale?.id ?? null,
        user.limitUptimeSeconds, status,
      ]
    );

    return {
      id: result.rows[0].id,
      created: false,
      previousDisabled: existing.mikrotikDisabled,
      previousPointOfSaleId: existing.pointOfSaleId,
      stateChangedAt: result.rows[0].stateChangedAt,
    };
  }

  const result = await pool.query<{ id: string; stateChangedAt: string | null }>(
    `INSERT INTO voucher (
       site_id, plan_id, code, mikrotik_profile, router_id,
       mikrotik_username, mikrotik_comment, mikrotik_disabled,
       mikrotik_state_changed_at, mikrotik_last_seen_at, point_of_sale_id, duration_seconds, status
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp(),NOW(),$9,$10,$11,$12)
     RETURNING id,
                to_char(
                  mikrotik_state_changed_at AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                ) AS "stateChangedAt"
    `,
    [
      router.siteId, planId, user.username, user.profile, router.id,
      user.username, user.comment, user.disabled, pointOfSale?.id ?? null,
      user.limitUptimeSeconds, status,
    ]
  );

  return {
    id: result.rows[0].id,
    created: true,
    previousDisabled: null,
    previousPointOfSaleId: null,
    stateChangedAt: result.rows[0].stateChangedAt,
  };
}

export async function syncMikrotikVouchers(
  router: RouterForSync,
  hotspotUsers: MikrotikHotspotUser[],
  api?: RouterOSAPI
): Promise<{ discovered: number; updated: number; deleted: number; anomalies: number }> {
  const posResult = await pool.query<PointOfSaleRef>(
    `SELECT id, code, status
       FROM point_of_sale
      WHERE organization_id = $1
        AND type = 'EXTERNAL'`,
    [router.organizationId]
  );

  const pointOfSales = posResult.rows;
  const seen = new Set(hotspotUsers.map((u) => u.username.trim().toLowerCase()));

  let discovered = 0;
  let updated = 0;
  let deleted = 0;
  let anomalies = 0;

  for (const user of hotspotUsers) {
    const username = user.username.trim();
    if (!username) continue;

    let pointOfSale = findPointOfSale(user.comment, pointOfSales);

    // Prefer the existing database association when the comment match is
    // ambiguous or missing. This keeps already-linked POS vouchers enforceable.
    if (!pointOfSale) {
      const linkedPos = await pool.query<PointOfSaleRef>(
        `SELECT p.id, p.code, p.status
           FROM voucher v
           JOIN point_of_sale p ON p.id = v.point_of_sale_id
          WHERE v.router_id = $1
            AND v.mikrotik_username = $2
            AND p.organization_id = $3
            AND p.type = 'EXTERNAL'
          LIMIT 1`,
        [router.id, username, router.organizationId]
      );
      pointOfSale = linkedPos.rows[0] ?? null;
    }

    const planId = await findPlanIdForProfile(router.siteId, user.profile);
    // An inactive external POS is authoritative: never trust a possibly stale
    // enabled state returned by a sync cycle that overlaps POS deactivation.
    const posInactive = pointOfSale?.status === "INACTIVE";
    if (posInactive && api) {
      if (!user.disabled) {
        await setHotspotUserDisabled(api, username, true);
      }
      user.disabled = true;
    }

    let sync: Awaited<ReturnType<typeof upsertVoucher>>;
    try {
      sync = await upsertVoucher(router, user, pointOfSale, planId);
    } catch (error) {
      anomalies += 1;
      await appendVoucherEvent({
        siteId: router.siteId,
        routerId: router.id,
        username,
        voucherCode: username,
        pointOfSaleId: pointOfSale?.id ?? null,
        pointOfSaleCode: pointOfSale?.code ?? null,
        eventType: "SYNC_ANOMALY",
        eventKey: `voucher:${router.id}:${username}:sync-anomaly`,
        metadata: {
          reason: error instanceof Error ? error.message : "Erreur inconnue.",
          mikrotikProfile: user.profile,
        },
      });
      continue;
    }

    if (sync.created) {
      discovered += 1;
      await appendVoucherEvent({
        voucherId: sync.id,
        siteId: router.siteId,
        routerId: router.id,
        username,
        voucherCode: username,
        pointOfSaleId: pointOfSale?.id ?? null,
        pointOfSaleCode: pointOfSale?.code ?? null,
        eventType: "DISCOVERED",
        eventKey: `voucher:${router.id}:${username}:discovered`,
        metadata: { mikrotikProfile: user.profile, disabled: user.disabled },
      });
    } else {
      updated += 1;
    }

    // Persist the POS lock on every sync while the POS is inactive, including
    // vouchers already disabled on MikroTik whose reason was previously missing.
    if (posInactive) {
      await pool.query(
        `UPDATE voucher
            SET mikrotik_disabled = true,
                mikrotik_disabled_reason = 'POINT_OF_SALE_DISABLED',
                status = 'DISABLED',
                updated_at = NOW()
          WHERE id = $1`,
        [sync.id]
      );
    }

    if (pointOfSale && pointOfSale.id !== sync.previousPointOfSaleId) {
      await appendVoucherEvent({
        voucherId: sync.id,
        siteId: router.siteId,
        routerId: router.id,
        username,
        voucherCode: username,
        pointOfSaleId: pointOfSale.id,
        pointOfSaleCode: pointOfSale.code,
        eventType: "POS_IDENTIFIED",
        eventKey: `voucher:${router.id}:${username}:pos:${pointOfSale.id}`,
        metadata: { comment: user.comment },
      });
    }

    if (sync.previousDisabled !== null && sync.previousDisabled !== user.disabled) {
      await appendVoucherEvent({
        voucherId: sync.id,
        siteId: router.siteId,
        routerId: router.id,
        username,
        voucherCode: username,
        pointOfSaleId: pointOfSale?.id ?? null,
        pointOfSaleCode: pointOfSale?.code ?? null,
        eventType: user.disabled ? "DISABLED" : "ENABLED",
        eventKey: [
          "voucher",
          router.id,
          username,
          user.disabled ? "disabled" : "enabled",
          sync.stateChangedAt ?? "unknown",
        ].join(":"),
        metadata: {
          comment: user.comment,
          stateChangedAt: sync.stateChangedAt,
        },
      });
    }
  }

  const tracked = await pool.query<{
    id: string;
    username: string;
    code: string;
    pointOfSaleId: string | null;
  }>(
    `SELECT id,
            mikrotik_username AS username,
            code,
            point_of_sale_id AS "pointOfSaleId"
       FROM voucher
      WHERE router_id = $1
        AND mikrotik_username IS NOT NULL`,
    [router.id]
  );

  for (const voucher of tracked.rows) {
    if (seen.has(voucher.username.trim().toLowerCase())) continue;

    await appendVoucherEvent({
      voucherId: voucher.id,
      siteId: router.siteId,
      routerId: router.id,
      username: voucher.username,
      voucherCode: voucher.code,
      pointOfSaleId: voucher.pointOfSaleId,
      eventType: "DELETED_FROM_MIKROTIK",
      eventKey: `voucher:${router.id}:${voucher.username}:deleted-from-mikrotik`,
      metadata: { reason: "Absent de /ip/hotspot/user/print." },
    });

    await pool.query(`DELETE FROM voucher WHERE id = $1`, [voucher.id]);
    deleted += 1;
  }

  return { discovered, updated, deleted, anomalies };
}
