import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  changeVoucherStatus,
  createVoucherBatch,
  issueMikrotikVoucherBatch,
  getVoucherBatchForPrint,
  deleteVoucherById,
  getVouchers,
  getVoucherStats,
  getMikrotikVouchers,
  updateMikrotikVoucherComment,
} from "./voucher.service.js";

import type { VoucherStatus } from "../../routes/voucher.types.js";


export async function mikrotikVouchers(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const vouchers = await getMikrotikVouchers();

    return res.status(200).json({
      success: true,
      data: vouchers,
      count: vouchers.length,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateMikrotikVoucherCommentController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const routerId = String(req.params.routerId ?? "").trim();
    const username = String(req.params.username ?? "").trim();
    const comment =
      typeof req.body?.comment === "string"
        ? req.body.comment.trim()
        : "";

    if (!routerId || !username) {
      return res.status(400).json({
        success: false,
        message: "Le routeur et le voucher sont obligatoires.",
      });
    }

    if (comment.length > 255) {
      return res.status(400).json({
        success: false,
        message: "Le commentaire ne peut pas dépasser 255 caractères.",
      });
    }

    const voucher = await updateMikrotikVoucherComment(
      routerId,
      username,
      comment
    );

    return res.status(200).json({
      success: true,
      message: "Commentaire du voucher mis à jour avec succès.",
      data: voucher,
    });
  } catch (error) {
    return next(error);
  }
}

export async function voucherStats(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const stats = await getVoucherStats();

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    return next(error);
  }
}

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

export async function printVoucherBatchController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.auth?.sub;
    const batchId = String(req.params.batchId ?? "").trim();
    if (!userId) return res.status(401).json({ success: false, message: "Utilisateur non authentifié." });
    if (!batchId) return res.status(400).json({ success: false, message: "Le lot est obligatoire." });
    const vouchers = await getVoucherBatchForPrint(batchId, userId);
    return res.status(200).json({ success: true, data: { batchId, quantity: vouchers.length, vouchers } });
  } catch (error) { return next(error); }
}

export async function generateVouchers(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      siteId,
      planId,
      quantity,
      batchName,
      prefix,
      mikrotikProfile,
      routerId,
      pointOfSaleId,
    } = req.body;

    if (typeof siteId !== "string" || !siteId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Le site est obligatoire.",
      });
    }

    if (typeof planId !== "string" || !planId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Le forfait est obligatoire.",
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

    if (typeof routerId !== "string" || !routerId.trim()) {
      return res.status(400).json({ success: false, message: "Le routeur MikroTik est obligatoire." });
    }
    if (typeof pointOfSaleId !== "string" || !pointOfSaleId.trim()) {
      return res.status(400).json({ success: false, message: "Le point de vente est obligatoire." });
    }
    const userId = req.auth?.sub;
    if (!userId) return res.status(401).json({ success: false, message: "Utilisateur non authentifié." });

    const result = await issueMikrotikVoucherBatch({
      siteId: siteId.trim(),
      planId: planId.trim(),
      routerId: routerId.trim(),
      pointOfSaleId: pointOfSaleId.trim(),
      quantity: numericQuantity,
      mikrotikProfile: typeof mikrotikProfile === "string" && mikrotikProfile.trim() ? mikrotikProfile.trim() : null,
      batchName: typeof batchName === "string" && batchName.trim()
        ? batchName.trim()
        : `Lot du ${new Date().toLocaleDateString("fr-FR")}`,
      createdBy: userId,
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
