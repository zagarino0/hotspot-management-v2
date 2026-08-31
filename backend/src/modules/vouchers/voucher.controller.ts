import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  changeVoucherStatus,
  createVoucherBatch,
  deleteVoucherById,
  getVouchers,
} from "./voucher.service.js";

import type { VoucherStatus } from "../../routes/voucher.types.js";

const VALID_STATUSES: readonly VoucherStatus[] = [
  "UNUSED",
  "ACTIVE",
  "EXPIRED",
  "DISABLED",
  "REVOKED",
];

export async function listVouchers(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawStatus = req.query.status;
    let status: VoucherStatus | undefined;

    if (typeof rawStatus === "string") {
      if (
        !VALID_STATUSES.includes(rawStatus as VoucherStatus)
      ) {
        return res.status(400).json({
          success: false,
          message: `Statut invalide. Valeurs acceptées : ${VALID_STATUSES.join(", ")}.`,
        });
      }

      status = rawStatus as VoucherStatus;
    }

    const siteId =
      typeof req.query.siteId === "string"
        ? req.query.siteId
        : undefined;

    const planId =
      typeof req.query.planId === "string"
        ? req.query.planId
        : undefined;

    const vouchers = await getVouchers({
      status,
      siteId,
      planId,
    });

    return res.status(200).json({
      success: true,
      data: vouchers,
      count: vouchers.length,
    });
  } catch (error) {
    return next(error);
  }
}

export async function generateVouchers(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { siteId, planId, mikrotikProfile, quantity, batchName, prefix } =
      req.body;

    if (typeof siteId !== "string" || !siteId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Le site est obligatoire.",
      });
    }

    // Validation : soit planId, soit mikrotikProfile, mais pas les deux
    if (!planId && !mikrotikProfile) {
      return res.status(400).json({
        success: false,
        message: "Le forfait ou le profil MikroTik est obligatoire.",
      });
    }

    if (planId && mikrotikProfile) {
      return res.status(400).json({
        success: false,
        message: "Utilisez soit le forfait soit le profil MikroTik, pas les deux.",
      });
    }

    const numericQuantity = Number(quantity);

    if (
      !Number.isInteger(numericQuantity) ||
      numericQuantity < 1
    ) {
      return res.status(400).json({
        success: false,
        message:
          "La quantité doit être un entier positif.",
      });
    }

    const result = await createVoucherBatch({
      siteId: siteId.trim(),
      planId: planId?.trim() || null,
      mikrotikProfile: mikrotikProfile?.trim() || null,
      quantity: numericQuantity,
      batchName:
        typeof batchName === "string" && batchName.trim()
          ? batchName.trim()
          : `Lot du ${new Date().toLocaleDateString("fr-FR")}`,
      prefix:
        typeof prefix === "string" && prefix.trim()
          ? prefix.trim()
          : null,
      createdBy: req.auth?.sub ?? null,
    });

    return res.status(201).json({
      success: true,
      message: `${result.quantity} voucher(s) généré(s) avec succès.`,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   CHANGE STATUS (désactiver / révoquer)
============================================================ */

export async function updateVoucherStatusController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (typeof status !== "string") {
      return res.status(400).json({
        success: false,
        message: "Le statut cible est obligatoire.",
      });
    }

    const voucher = await changeVoucherStatus(
      String(id ?? ""),
      status as VoucherStatus
    );

    return res.status(200).json({
      success: true,
      message: "Statut du voucher mis à jour avec succès.",
      data: voucher,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteVoucherController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    await deleteVoucherById(String(id ?? ""));

    return res.status(200).json({
      success: true,
      message: "Voucher supprimé avec succès.",
    });
  } catch (error) {
    return next(error);
  }
}
