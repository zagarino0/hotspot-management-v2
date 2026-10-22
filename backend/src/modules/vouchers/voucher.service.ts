import {
  deleteVoucher,
  findVoucherById,
  findVouchers,
  findVouchersByBatchId,
  generateVoucherBatch,
  deleteGeneratedVoucherBatch,
  updateVoucherStatus,
} from "./voucher.repository.js";

import { findPlanById, findPlans } from "../plans/plan.repository.js";

import {
  findRoutersForSync,
  findRouterCredential,
} from "../routers/router.repository.js";

import { connectMikroTik } from "../../mikrotik/connection.js";
import { createHotspotUser, deleteHotspotUser, fetchHotspotUsers, updateHotspotUserComment, setHotspotUserDisabled } from "../../mikrotik/hotspotUsers.js";
import { fetchActiveHotspotUsers, removeActiveHotspotUser } from "../../mikrotik/hotspotActive.js";
import { enforceCalendarExpiry, isCalendarValidityProfile } from "./calendarValidity.js";
import { pool } from "../../database/pool.js";
import { decryptSecret } from "../../lib/crypto.js";

import { badRequest, conflict, notFoundError } from "../../lib/errors.js";

import type {
  GenerateVouchersData,
  VoucherStatus,
} from "../../routes/voucher.types.js";

const MAX_BATCH_QUANTITY = 1000;

function parseRouterOsDurationSeconds(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim().toLowerCase();
  if (raw === "0" || raw === "0s") return null;

  const clock = raw.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/);
  if (clock) {
    const hours = Number(clock[1] ?? 0);
    const minutes = Number(clock[2]);
    const seconds = Number(clock[3]);
    if (minutes < 60 && seconds < 60) return hours * 3600 + minutes * 60 + seconds;
    return null;
  }

  const units = raw.match(/^(?:(\d+)w)?\s*(?:(\d+)d)?\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/);
  if (!units || !units.slice(1).some((part) => part !== undefined)) return null;

  const seconds =
    Number(units[1] ?? 0) * 7 * 86400 +
    Number(units[2] ?? 0) * 86400 +
    Number(units[3] ?? 0) * 3600 +
    Number(units[4] ?? 0) * 60 +
    Number(units[5] ?? 0);
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}


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
        // MikroTik reste la source de vérité pour l'uptime et la limite.
        // Pour les profils à validité calendaire, le backend vérifie aussi
        // la première activation/session et applique l'expiration sur MikroTik.
        let calendarExpired = false;
        if (isCalendarValidityProfile(user.profile)) {
          const expiryResult = await pool.query<{ id: string; expiresAt: string; activatedAt: string }>(
            `WITH activation AS (
               SELECT v.id,
                      COALESCE(first_session.first_connected_at, v.activated_at) AS activated_at,
                      COALESCE(v.duration_seconds, first_session.limit_uptime_seconds) AS duration_seconds,
                      v.expires_at
                 FROM voucher v
                 LEFT JOIN LATERAL (
                   SELECT MIN(s.started_at) AS first_connected_at,
                          MAX(s.mikrotik_limit_uptime_seconds) AS limit_uptime_seconds
                     FROM session s
                    WHERE (s.voucher_id = v.id)
                       OR (s.voucher_id IS NULL
                           AND s.site_id = v.site_id
                           AND s.router_id = v.router_id
                           AND LOWER(s.username) = LOWER(COALESCE(v.mikrotik_username, v.code)))
                 ) first_session ON TRUE
                WHERE v.router_id = $1
                  AND LOWER(COALESCE(v.mikrotik_username, v.code)) = LOWER($2)
                  AND LOWER(v.mikrotik_profile) = LOWER($3)
                LIMIT 1
             ), calculated AS (
               SELECT id, activated_at,
                      CASE
                        WHEN activated_at IS NOT NULL AND duration_seconds > 0 THEN
                          (((activated_at AT TIME ZONE 'Indian/Antananarivo')::date
                            + CEIL(duration_seconds::numeric / 86400)::integer)::timestamp
                            AT TIME ZONE 'Indian/Antananarivo')
                        ELSE expires_at
                      END AS expires_at
                 FROM activation
             )
             SELECT id, activated_at AS "activatedAt", expires_at AS "expiresAt"
               FROM calculated
              WHERE activated_at IS NOT NULL
                AND expires_at IS NOT NULL
                AND (NOW() AT TIME ZONE 'Indian/Antananarivo')::date >=
                    (expires_at AT TIME ZONE 'Indian/Antananarivo')::date
              LIMIT 1`,
            [router.id, user.username, user.profile]
          );
          const expired = expiryResult.rows[0];
          if (expired) {
            const enforced = await enforceCalendarExpiry({
              profile: user.profile,
              expiresAt: expired.expiresAt,
              username: user.username,
              disabled: user.disabled,
              disableUser: async (username) => setHotspotUserDisabled(api, username, true),
              listActiveUsers: async () => fetchActiveHotspotUsers(api),
              removeActiveUser: async (routerInternalId) => removeActiveHotspotUser(api, routerInternalId),
            });
            calendarExpired = enforced;
            if (enforced) {
              user.disabled = true;
              await pool.query(
                `UPDATE voucher
                    SET status = 'EXPIRED',
                        expires_at = $2,
                        mikrotik_disabled = TRUE,
                        mikrotik_disabled_reason = 'CALENDAR_EXPIRY',
                        updated_at = NOW()
                  WHERE id = $1`,
                [expired.id, expired.expiresAt]
              );
            }
          }
        }

        let status: MikrotikVoucherRow["status"] = "UNUSED";
        const quotaExhausted =
          user.limitUptimeSeconds !== null &&
          user.limitUptimeSeconds > 0 &&
          user.uptimeSeconds >= user.limitUptimeSeconds;
        const hasMac = Boolean(user.macAddress?.trim());
        const withinQuota =
          user.limitUptimeSeconds === null ||
          user.uptimeSeconds <= user.limitUptimeSeconds;

        if (calendarExpired || quotaExhausted) {
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
      user.uptimeSeconds >= user.limitUptimeSeconds;

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
  // Utilise exactement la même règle que la liste des vouchers :
  // quota MikroTik épuisé OU validité calendaire échue pour les profils ciblés.
  const vouchers = await getMikrotikVouchers();
  return {
    total: vouchers.length,
    available: vouchers.filter((voucher) => voucher.status === "UNUSED").length,
    used: vouchers.filter((voucher) => voucher.status === "ACTIVE").length,
    expired: vouchers.filter((voucher) => voucher.status === "EXPIRED").length,
  };
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

  const requestedPlanId = data.planId?.trim() || "";
  const requestedProfile = data.mikrotikProfile?.trim().toLowerCase() || "";
  const plan = requestedPlanId
    ? await findPlanById(requestedPlanId)
    : (await findPlans()).find((candidate) =>
        candidate.siteId === data.siteId &&
        candidate.status === "ACTIVE" &&
        (
          candidate.mikrotikProfileCode?.trim().toLowerCase() === requestedProfile ||
          candidate.name.trim().toLowerCase() === requestedProfile
        )
      ) ?? null;

  if (requestedPlanId && !plan) {
    throw notFoundError("Forfait commercial introuvable.");
  }
  if (plan && plan.siteId !== data.siteId) {
    throw badRequest("Ce forfait n'appartient pas au site sélectionné.");
  }

  const router = (await findRoutersForSync()).find(
    (item) => item.id === data.routerId && item.siteId === data.siteId
  );
  if (!router) {
    throw badRequest("Le routeur sélectionné doit être actif, synchronisé et rattaché au site choisi.");
  }

  const posResult = await pool.query<{ id: string; code: string }>(
    `SELECT pos.id, pos.code
       FROM point_of_sale pos
       JOIN site s ON s.id = $2
       JOIN "user" u ON u.organization_id = s.organization_id AND u.id = $3
      WHERE pos.id = $1
        AND pos.organization_id = s.organization_id
        AND pos.status = 'ACTIVE'
      LIMIT 1`,
    [data.pointOfSaleId, data.siteId, data.createdBy ?? ""]
  );
  const pointOfSale = posResult.rows[0];
  if (!pointOfSale) {
    throw badRequest("Le point de vente est introuvable, inactif ou n'appartient pas à l'organisation du site.");
  }

  const credential = await findRouterCredential(router.id);
  if (!credential) {
    throw conflict(`Aucun identifiant MikroTik actif pour le routeur "${router.name}".`);
  }

  const profile = (data.mikrotikProfile?.trim() || plan?.mikrotikProfileCode?.trim() || "").trim();
  if (!profile) {
    throw badRequest("Le profil MikroTik est obligatoire pour générer les vouchers.");
  }

  const api = await connectMikroTik({
    host: router.managementIp.split("/")[0].trim(),
    port: router.apiPort,
    user: credential.username,
    password: decryptSecret(credential.encryptedSecret),
  });

  let batchId: string | null = null;
  const createdUsernames: string[] = [];
  try {
    const profileRows = await api.write("/ip/hotspot/user/profile/print");
    const selectedProfile = profileRows.find((row: Record<string, unknown>) =>
      typeof row.name === "string" && row.name.trim().toLowerCase() === profile.toLowerCase()
    ) as Record<string, unknown> | undefined;
    if (!selectedProfile) {
      throw badRequest(`Le profil MikroTik "${profile}" n'existe pas sur le routeur sélectionné.`);
    }

    // RouterOS expose la durée de session du profil via session-timeout.
    // On refuse une durée commerciale inventée si le profil ne définit pas de durée exploitable.
    const profileDurationSeconds = parseRouterOsDurationSeconds(selectedProfile["session-timeout"]);
    if (profileDurationSeconds === null || profileDurationSeconds <= 0) {
      throw badRequest(
        `Le profil MikroTik "${profile}" ne définit pas de session-timeout valide. Configurez la durée réelle dans MikroTik avant de générer les vouchers.`
      );
    }

    const catalogResult = await pool.query<{
      code: string; name: string; duration_seconds: number | string | null;
      default_price: number | string; currency: string; status: string;
    }>(
      `SELECT code, name, duration_seconds, default_price, currency, status
         FROM hotspot_profile
        WHERE LOWER(code) = LOWER($1) OR LOWER(name) = LOWER($1)
        ORDER BY CASE WHEN LOWER(code) = LOWER($1) THEN 0 ELSE 1 END
        LIMIT 1`,
      [profile]
    );
    const catalogProfile = catalogResult.rows[0];
    const catalogDuration = catalogProfile?.duration_seconds == null ? null : Number(catalogProfile.duration_seconds);
    if (catalogDuration !== null && catalogDuration !== profileDurationSeconds) {
      console.warn(`[vouchers] Durée du profil "${profile}" : MikroTik=${profileDurationSeconds}s, catalogue=${catalogDuration}s. La durée réelle MikroTik est conservée.`);
    }
    if (!plan && !catalogProfile) {
      throw badRequest(`Aucun forfait commercial ni profil de catalogue ne correspond à "${profile}".`);
    }
    if (catalogProfile && catalogProfile.status !== "ACTIVE") {
      throw badRequest(`Le profil de catalogue "${catalogProfile.code}" n'est pas actif.`);
    }

    const batch = await generateVoucherBatch(
      { ...data, planId: plan?.id ?? "", pointOfSaleCode: pointOfSale.code, mikrotikProfile: profile },
      {
        id: plan?.id ?? null,
        siteId: data.siteId,
        price: plan?.price ?? Number(catalogProfile?.default_price ?? 0),
        currency: plan?.currency ?? catalogProfile?.currency ?? "MGA",
        durationSeconds: profileDurationSeconds,
        dataLimitBytes: plan?.dataLimitBytes ?? null,
        downloadSpeedBps: plan?.downloadSpeedBps ?? null,
        uploadSpeedBps: plan?.uploadSpeedBps ?? null,
      }
    );
    batchId = batch.batchId;

    const vouchers = await findVouchersByBatchId(batch.batchId);

    // Charge la liste MikroTik une seule fois : répéter /print pour chaque ticket
    // ralentissait fortement les lots et faisait expirer la commande API au-delà de 10 vouchers.
    const existingRows = await api.write("/ip/hotspot/user/print");
    const existingNames = new Set(
      existingRows
        .map((row: Record<string, unknown>) =>
          typeof row.name === "string" ? row.name.trim().toLowerCase() : ""
        )
        .filter(Boolean)
    );
    const duplicate = vouchers.find((voucher) => existingNames.has((voucher.mikrotikUsername ?? "").trim().toLowerCase()));
    if (duplicate) {
      throw conflict(`L'utilisateur MikroTik "${duplicate.code}" existe déjà. Aucun voucher du lot n'a été ajouté.`);
    }

    const dateCode = new Date().toLocaleDateString("en-US", {
      month: "2-digit", day: "2-digit", year: "2-digit",
    }).replaceAll("/", ".");
    for (const voucher of vouchers) {
      const comment = voucher.mikrotikComment ?? `${voucher.code}-${dateCode} - ${pointOfSale.code}`;
      await createHotspotUser(api, {
        username: voucher.mikrotikUsername ?? voucher.code,
        password: voucher.code,
        profile,
        limitUptimeSeconds: profileDurationSeconds,
        comment,
      }, true);
      createdUsernames.push(voucher.mikrotikUsername ?? voucher.code);
    }

    return { batchId: batch.batchId, quantity: batch.voucherIds.length, vouchers };
  } catch (error) {
    const cleanupErrors: string[] = [];
    for (const username of createdUsernames.reverse()) {
      try {
        await deleteHotspotUser(api, username);
      } catch (cleanupError) {
        cleanupErrors.push(`${username}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
      }
    }
    if (batchId) {
      try {
        await deleteGeneratedVoucherBatch(batchId);
      } catch (cleanupError) {
        cleanupErrors.push(`PostgreSQL lot ${batchId}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
      }
    }
    if (cleanupErrors.length) {
      throw new Error(`La génération a échoué et le nettoyage est incomplet : ${cleanupErrors.join("; ")}`);
    }
    throw error;
  } finally {
    await api.close();
  }
}
