import {
  deleteVoucher,
  findVoucherById,
  findVouchers,
  findVouchersByBatchId,
  generateVoucherBatch,
  updateVoucherStatus,
} from "./voucher.repository.js";

import { findPlanById } from "../plans/plan.repository.js";
import { pool } from "../../database/pool.js";
import { randomInt } from "node:crypto";
import { encryptSecret } from "../../lib/crypto.js";

import {
  findRoutersForSync,
  findRouterCredential,
} from "../routers/router.repository.js";

import { connectMikroTik } from "../../mikrotik/connection.js";
import { fetchHotspotUsers, updateHotspotUserComment, createHotspotUser } from "../../mikrotik/hotspotUsers.js";
import { decryptSecret } from "../../lib/crypto.js";

import { badRequest, conflict, notFoundError } from "../../lib/errors.js";

import type {
  GenerateVouchersData,
  VoucherStatus,
} from "../../routes/voucher.types.js";

const MAX_BATCH_QUANTITY = 1000;


export interface MikrotikVoucherRow {
  id: string;
  code: string;
  profile: string | null;
  durationSeconds: number | null;
  siteId: string;
  siteName: string;
  routerId: string;
  routerName: string;
  macAddress: string | null;
  comment: string | null;
  createdAt: string | null;
  status: "UNUSED" | "ACTIVE" | "EXPIRED";
}

export async function getMikrotikVouchers(): Promise<MikrotikVoucherRow[]> {
  const routers = await findRoutersForSync();
  const rows: MikrotikVoucherRow[] = [];

  for (const router of routers) {
    const credential = await findRouterCredential(router.id);

    if (!credential) {
      continue;
    }

    const api = await connectMikroTik({
      host: router.managementIp.split("/")[0].trim(),
      port: router.apiPort,
      user: credential.username,
      password: decryptSecret(credential.encryptedSecret),
    });

    try {
      const users = await fetchHotspotUsers(api);

      for (const user of users) {
        // Règle métier définitive, basée sur les valeurs MikroTik :
        // 1. Uptime = Limit Uptime -> EXPIRED (prioritaire)
        // 2. MAC renseignée + Uptime <= Limit Uptime -> ACTIVE/Utilisé
        // 3. MAC vide + Uptime = 0 -> UNUSED/Disponible
        let status: MikrotikVoucherRow["status"] = "UNUSED";

        const quotaExhausted =
          user.limitUptimeSeconds !== null &&
          user.limitUptimeSeconds > 0 &&
          user.uptimeSeconds === user.limitUptimeSeconds;

        const hasMac = Boolean(user.macAddress?.trim());
        const withinQuota =
          user.limitUptimeSeconds === null ||
          user.uptimeSeconds <= user.limitUptimeSeconds;

        if (quotaExhausted) {
          status = "EXPIRED";
        } else if (hasMac && withinQuota) {
          status = "ACTIVE";
        } else if (!hasMac && user.uptimeSeconds === 0) {
          status = "UNUSED";
        }

        rows.push({
          id: `${router.id}:${user.username}`,
          code: user.username,
          profile: user.profile,
          durationSeconds: user.limitUptimeSeconds,
          siteId: router.siteId,
          siteName: router.name,
          routerId: router.id,
          routerName: router.name,
          macAddress: user.macAddress,
          comment: user.comment,
          createdAt: user.createdAt,
          status,
        });
      }
    } finally {
      await api.close();
    }
  }

  return rows;
}

export async function updateMikrotikVoucherComment(
  routerId: string,
  username: string,
  comment: string
): Promise<MikrotikVoucherRow> {
  const router = await findRoutersForSync().then((routers) =>
    routers.find((item) => item.id === routerId)
  );

  if (!router) {
    throw notFoundError("Routeur introuvable.");
  }

  const credential = await findRouterCredential(router.id);

  if (!credential) {
    throw new Error(
      `Aucun identifiant MikroTik enregistré pour le routeur "${router.name}".`
    );
  }

  const api = await connectMikroTik({
    host: router.managementIp.split("/")[0].trim(),
    port: router.apiPort,
    user: credential.username,
    password: decryptSecret(credential.encryptedSecret),
  });

  try {
    await updateHotspotUserComment(api, username, comment.trim());

    const users = await fetchHotspotUsers(api);
    const user = users.find(
      (item) => item.username.toLowerCase() === username.trim().toLowerCase()
    );

    if (!user) {
      throw notFoundError("Voucher introuvable sur MikroTik.");
    }

    const quotaExhausted =
      user.limitUptimeSeconds !== null &&
      user.limitUptimeSeconds > 0 &&
      user.uptimeSeconds === user.limitUptimeSeconds;

    const hasMac = Boolean(user.macAddress?.trim());
    const withinQuota =
      user.limitUptimeSeconds === null ||
      user.uptimeSeconds <= user.limitUptimeSeconds;

    let status: MikrotikVoucherRow["status"] = "UNUSED";

    if (quotaExhausted) {
      status = "EXPIRED";
    } else if (hasMac && withinQuota) {
      status = "ACTIVE";
    } else if (!hasMac && user.uptimeSeconds === 0) {
      status = "UNUSED";
    }

    return {
      id: `${router.id}:${user.username}`,
      code: user.username,
      profile: user.profile,
      durationSeconds: user.limitUptimeSeconds,
      siteId: router.siteId,
      siteName: router.name,
      routerId: router.id,
      routerName: router.name,
      macAddress: user.macAddress,
      comment: user.comment,
      createdAt: user.createdAt,
      status,
    };
  } finally {
    await api.close();
  }
}

export async function getVouchers(filter?: {
  status?: VoucherStatus;
  siteId?: string;
  planId?: string;
}) {
  return findVouchers(filter);
}

export interface VoucherStats {
  total: number;
  available: number;
  used: number;
  expired: number;
}

export async function getVoucherStats(): Promise<VoucherStats> {
  const routers = await findRoutersForSync();

  let total = 0;
  let available = 0;
  let used = 0;
  let expired = 0;

  for (const router of routers) {
    const credential = await findRouterCredential(router.id);

    if (!credential) {
      throw new Error(
        `Aucun identifiant MikroTik enregistré pour le routeur "${router.name}".`
      );
    }

    const password = decryptSecret(credential.encryptedSecret);
    const host = router.managementIp.split("/")[0].trim();

    const api = await connectMikroTik({
      host,
      port: router.apiPort,
      user: credential.username,
      password,
    });

    try {
      const hotspotUsers = await fetchHotspotUsers(api);

      const isQuotaExhausted = (user: Awaited<ReturnType<typeof fetchHotspotUsers>>[number]) =>
        user.limitUptimeSeconds !== null &&
        user.limitUptimeSeconds > 0 &&
        user.uptimeSeconds === user.limitUptimeSeconds;

      const expiredUsers = hotspotUsers.filter(isQuotaExhausted);

      const usedCount = hotspotUsers.filter(
        (user) => {
          if (isQuotaExhausted(user) || !user.macAddress?.trim()) {
            return false;
          }

          return (
            user.limitUptimeSeconds === null ||
            user.uptimeSeconds <= user.limitUptimeSeconds
          );
        }
      ).length;

      const availableCount = hotspotUsers.filter(
        (user) =>
          !isQuotaExhausted(user) &&
          !user.macAddress?.trim() &&
          user.uptimeSeconds === 0
      ).length;

      total += hotspotUsers.length;
      used += usedCount;
      available += availableCount;
      expired += expiredUsers.length;
    } finally {
      await api.close();
    }
  }

  return { total, available, used, expired };
}

/* ============================================================
   CHANGE STATUS (désactiver / révoquer)
============================================================ */

const ALLOWED_TARGET_STATUSES: readonly VoucherStatus[] = [
  "DISABLED",
  "REVOKED",
];

export async function changeVoucherStatus(
  id: string,
  targetStatus: VoucherStatus
) {
  if (!ALLOWED_TARGET_STATUSES.includes(targetStatus)) {
    throw badRequest(
      `Impossible de changer manuellement le statut vers "${targetStatus}".`
    );
  }

  const voucher = await findVoucherById(id);

  if (!voucher) {
    throw notFoundError("Voucher introuvable.");
  }

  if (voucher.status !== "UNUSED" && voucher.status !== "ACTIVE") {
    throw conflict(
      `Ce voucher est déjà "${voucher.status}", son statut ne peut plus être modifié.`
    );
  }

  const updated = await updateVoucherStatus(id, targetStatus);

  if (!updated) {
    throw notFoundError("Voucher introuvable.");
  }

  return updated;
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteVoucherById(id: string) {
  const voucher = await findVoucherById(id);

  if (!voucher) {
    throw notFoundError("Voucher introuvable.");
  }

  if (voucher.status !== "UNUSED") {
    throw conflict(
      `Ce voucher est "${voucher.status}" : seuls les vouchers jamais utilisés peuvent être supprimés. Utilisez la désactivation à la place.`
    );
  }

  await deleteVoucher(id);
}

export interface IssueMikrotikVouchersData {
  siteId: string;
  planId: string;
  routerId: string;
  pointOfSaleId: string;
  quantity: number;
  batchName: string;
  createdBy: string;
}

/**
 * Creates the Hotspot users on the selected router first, then persists
 * their references and encrypted credentials. This is deliberately separate
 * from the legacy database-only batch generator.
 */
export async function issueMikrotikVoucherBatch(data: IssueMikrotikVouchersData) {
  if (!Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > MAX_BATCH_QUANTITY) {
    throw badRequest(`La quantité doit être comprise entre 1 et ${MAX_BATCH_QUANTITY}.`);
  }

  const target = await pool.query<{
    routerId: string; siteId: string; routerName: string; managementIp: string;
    apiPort: number; organizationId: string; posId: string; posCode: string;
    posName: string; profileCode: string; planId: string; planName: string;
    price: number; currency: string; durationSeconds: number | null;
    dataLimitBytes: number | null; downloadSpeedBps: number | null; uploadSpeedBps: number | null;
  }>(
    `SELECT r.id AS "routerId", s.id AS "siteId", r.name AS "routerName",
            host(r.management_ip) AS "managementIp", r.api_port AS "apiPort",
            s.organization_id AS "organizationId", pos.id AS "posId",
            pos.code AS "posCode", pos.name AS "posName",
            COALESCE(p.mikrotik_profile_code, p.code) AS "profileCode",
            p.id AS "planId", p.name AS "planName", p.price::float8 AS price,
            p.currency, p.duration_seconds AS "durationSeconds",
            p.data_limit_bytes AS "dataLimitBytes",
            p.download_speed_bps AS "downloadSpeedBps",
            p.upload_speed_bps AS "uploadSpeedBps"
       FROM router r
       JOIN site s ON s.id = r.site_id
       JOIN "user" u ON u.organization_id = s.organization_id AND u.id = $4
       JOIN point_of_sale pos ON pos.organization_id = s.organization_id
       JOIN plan p ON p.site_id = s.id
       WHERE s.id = $1 AND p.id = $2 AND r.id = $3
         AND pos.id = $5 AND pos.status = 'ACTIVE'
         AND r.management_ip IS NOT NULL
       LIMIT 1`,
    [data.siteId, data.planId, data.routerId, data.createdBy, data.pointOfSaleId]
  );
  const selected = target.rows[0];
  if (!selected) throw notFoundError("Site, forfait, routeur ou point de vente actif introuvable pour votre organisation.");

  const credential = await findRouterCredential(selected.routerId);
  if (!credential) throw conflict(`Aucun identifiant MikroTik actif pour le routeur "${selected.routerName}".`);
  if (!selected.profileCode?.trim()) throw badRequest("Le forfait n'est associé à aucun profil MikroTik.");

  const plan = await findPlanById(data.planId);
  if (!plan || plan.siteId !== data.siteId) throw badRequest("Le forfait ne correspond pas au site.");

  const api = await connectMikroTik({
    host: selected.managementIp.split("/")[0].trim(),
    port: selected.apiPort,
    user: credential.username,
    password: decryptSecret(credential.encryptedSecret),
  });

  const issued: Array<{ username: string; password: string; comment: string; encryptedPassword: string }> = [];
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const makeUsername = () => Array.from({length:4}, () => alphabet[randomInt(alphabet.length)]).join("");
  const makePassword = () => String(randomInt(10000)).padStart(4, "0");
  const today = new Date();
  const datePart = `${String(today.getDate()).padStart(2,"0")}.${String(today.getMonth()+1).padStart(2,"0")}.${String(today.getFullYear()).slice(-2)}`;
  const batchReference = `up-${randomInt(100, 1000)}-${datePart}`;
  const comment = `${batchReference} - ${selected.posCode}`;

  try {
    const profiles = await api.write("/ip/hotspot/user/profile/print");
    const profileExists = profiles.some((row: Record<string, unknown>) => typeof row.name === "string" && row.name.trim().toLowerCase() === selected.profileCode.trim().toLowerCase());
    if (!profileExists) throw badRequest("Le profil MikroTik associé au forfait n'existe pas sur le routeur cible.");
    const routerUsers = await fetchHotspotUsers(api);
    const usedNames = new Set(routerUsers.map((user) => user.username.toLowerCase()));
    for (let i = 0; i < data.quantity; i++) {
      let username = "";
      for (let attempt = 0; attempt < 100; attempt++) {
        const candidate = makeUsername();
        if (!usedNames.has(candidate)) { username = candidate; usedNames.add(candidate); break; }
      }
      if (!username) throw conflict("Impossible de trouver un nom d'utilisateur libre sur ce routeur.");
      const password = makePassword();
      await createHotspotUser(api, { username, password, profile: selected.profileCode, comment,
        limitUptime: selected.durationSeconds ? `${Math.floor(selected.durationSeconds / 3600)}h${Math.floor((selected.durationSeconds % 3600) / 60)}m` : null });
      issued.push({ username, password, comment, encryptedPassword: encryptSecret(password) });
    }
  } catch (error) {
    // Best-effort compensation: remove users created in this request if any step fails.
    for (const item of issued.reverse()) {
      try {
        const rows = await api.write("/ip/hotspot/user/print");
        const targetUser = rows.find((row: Record<string, unknown>) => row.name === item.username);
        if (targetUser && typeof targetUser[".id"] === "string") {
          await api.write("/ip/hotspot/user/remove", [`=.id=${targetUser[".id"]}`]);
        }
      } catch { /* preserve original failure; report for manual reconciliation if needed */ }
    }
    throw error;
  } finally {
    await api.close();
  }

  const db = await pool.connect();
  let batchId = "";
  try {
    await db.query("BEGIN");
    const batch = await db.query<{id:string}>(
      `INSERT INTO voucher_batch (site_id, plan_id, name, prefix, mikrotik_profile, quantity, created_by, status)
       VALUES ($1,$2,$3,NULL,$4,$5,$6,'ACTIVE') RETURNING id`,
      [data.siteId, data.planId, data.batchName, selected.profileCode, issued.length, data.createdBy]
    );
    batchId = batch.rows[0].id;
    const voucherIds: string[] = [];
    for (const item of issued) {
      const inserted = await db.query<{id:string}>(
        `INSERT INTO voucher (site_id, plan_id, batch_id, code, mikrotik_profile,
           price_snapshot, currency_snapshot, duration_seconds, data_limit_bytes,
           download_speed_bps, upload_speed_bps, status, router_id, mikrotik_username,
           mikrotik_comment, point_of_sale_id, mikrotik_password_encrypted)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'UNUSED',$12,$13,$14,$15,$16)
         RETURNING id`,
        [data.siteId, data.planId, batchId, item.username, selected.profileCode,
         selected.price, selected.currency, selected.durationSeconds, selected.dataLimitBytes,
         selected.downloadSpeedBps, selected.uploadSpeedBps, selected.routerId,
         item.username, item.comment, selected.posId, item.encryptedPassword]
      );
      voucherIds.push(inserted.rows[0].id);
    }
    await db.query("COMMIT");
    const vouchers = await findVouchersByBatchId(batchId);
    return {
      batchId, quantity: vouchers.length,
      vouchers: vouchers.map((voucher) => {
        const issuedVoucher = issued.find((item) => item.username === voucher.code);
        return { ...voucher, password: issuedVoucher?.password ?? null, mikrotikUsername: voucher.code,
          mikrotikComment: issuedVoucher?.comment ?? null, pointOfSaleId: selected.posId,
          pointOfSaleName: selected.posName, routerId: selected.routerId, routerName: selected.routerName,
          batchReference };
      }),
    };
  } catch (error) {
    await db.query("ROLLBACK");
    // PostgreSQL failure after router creation: compensate on MikroTik.
    try {
      const compensationApi = await connectMikroTik({
        host: selected.managementIp.split("/")[0].trim(), port: selected.apiPort,
        user: credential.username, password: decryptSecret(credential.encryptedSecret),
      });
      try {
        const rows = await compensationApi.write("/ip/hotspot/user/print");
        for (const item of issued) {
          const targetUser = rows.find((row: Record<string, unknown>) => row.name === item.username);
          if (targetUser && typeof targetUser[".id"] === "string") {
            await compensationApi.write("/ip/hotspot/user/remove", [`=.id=${targetUser[".id"]}`]);
          }
        }
      } finally { await compensationApi.close(); }
    } catch { /* database failure is primary; router cleanup may require reconciliation */ }
    throw error;
  } finally {
    db.release();
  }
}

export async function createVoucherBatch(
  data: GenerateVouchersData
) {
  if (!Number.isInteger(data.quantity) || data.quantity < 1) {
    throw badRequest(
      "La quantité de vouchers doit être un entier positif."
    );
  }

  if (data.quantity > MAX_BATCH_QUANTITY) {
    throw badRequest(
      `Impossible de générer plus de ${MAX_BATCH_QUANTITY} vouchers en un seul lot.`
    );
  }

  const plan = await findPlanById(data.planId);

  if (!plan) {
    throw notFoundError("Forfait introuvable.");
  }

  if (plan.siteId !== data.siteId) {
    throw badRequest(
      "Ce forfait n'appartient pas au site sélectionné."
    );
  }

  const { batchId, voucherIds } = await generateVoucherBatch(
    data,
    {
      id: plan.id,
      siteId: plan.siteId,
      price: plan.price,
      currency: plan.currency,
      durationSeconds: plan.durationSeconds,
      dataLimitBytes: plan.dataLimitBytes,
      downloadSpeedBps: plan.downloadSpeedBps,
      uploadSpeedBps: plan.uploadSpeedBps,
    }
  );

  const vouchers = await findVouchersByBatchId(batchId);

  return {
    batchId,
    quantity: voucherIds.length,
    vouchers,
  };
}
