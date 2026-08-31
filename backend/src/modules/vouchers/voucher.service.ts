import {
  deleteVoucher,
  findVoucherById,
  findVouchers,
  findVouchersByBatchId,
  generateVoucherBatch,
  updateVoucherStatus,
} from "./voucher.repository.js";

import { findPlanById } from "../plans/plan.repository.js";

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

/* ============================================================
   CHANGE STATUS (désactiver / révoquer)
   Transitions autorisées uniquement vers DISABLED ou REVOKED,
   et seulement depuis UNUSED ou ACTIVE — jamais depuis un état
   déjà terminal (EXPIRED déjà consommé son cycle de vie).
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
   Seuls les vouchers jamais utilisés (UNUSED) peuvent être
   supprimés — au-delà, ils font partie de l'historique/l'audit.
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

  // Si on utilise un plan local (ancienne méthode)
  if (data.planId) {
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

  // Si on utilise directement un profil MikroTik (nouvelle méthode)
  if (data.mikrotikProfile) {
    const { batchId, voucherIds } = await generateVoucherBatch(
      data,
      {
        id: null, // Pas de plan local
        siteId: data.siteId,
        durationSeconds: null, // Utilisera les paramètres du profil MikroTik
        dataLimitBytes: null,
        downloadSpeedBps: null,
        uploadSpeedBps: null,
      }
    );

    const vouchers = await findVouchersByBatchId(batchId);

    return {
      batchId,
      quantity: voucherIds.length,
      vouchers,
    };
  }

  throw badRequest("Soit planId soit mikrotikProfile est requis.");
}
