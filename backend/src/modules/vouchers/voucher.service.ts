import {
  deleteVoucher,
  findVoucherById,
  findVouchers,
  findVouchersByBatchId,
  generateVoucherBatch,
  updateVoucherStatus,
} from "./voucher.repository.js";

import { findVoucherUsageHistory } from "./voucherStats.repository.js";

import { findPlanById } from "../plans/plan.repository.js";

import {
  findRoutersForSync,
  findRouterCredential,
} from "../routers/router.repository.js";

import { connectMikroTik } from "../../mikrotik/connection.js";
import { fetchHotspotUsers } from "../../mikrotik/hotspotUsers.js";
import { fetchActiveHotspotUsers } from "../../mikrotik/hotspotActive.js";
import { decryptSecret } from "../../lib/crypto.js";

import { badRequest, conflict, notFoundError } from "../../lib/errors.js";

import type {
  GenerateVouchersData,
  VoucherStatus,
} from "../../routes/voucher.types.js";

const MAX_BATCH_QUANTITY = 1000;

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
      const [hotspotUsers, activeUsers, history] =
        await Promise.all([
          fetchHotspotUsers(api),
          fetchActiveHotspotUsers(api),
          findVoucherUsageHistory(router.siteId, router.id),
        ]);

      const usedActiveCount = activeUsers.filter(
        (user) =>
          Boolean(user.username?.trim()) &&
          Boolean(user.macAddress?.trim())
      ).length;

      const availableCount = hotspotUsers.filter(
        (user) =>
          !history.usedUsernames.has(
            user.username.trim().toLowerCase()
          )
      ).length;

      total += hotspotUsers.length;
      used += usedActiveCount;
      available += availableCount;
      expired += history.expiredSessionCount;
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
