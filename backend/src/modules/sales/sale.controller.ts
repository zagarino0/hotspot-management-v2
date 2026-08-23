import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  cancelSale,
  createSale,
  deleteSaleById,
  getSaleDetails,
  getSales,
  getSummary,
  recordPayment,
} from "./sale.service.js";

import type {
  SaleStatus,
} from "../../routes/sale.types.js";
import type { PaymentMethod } from "../../routes/payment.types.js";

const VALID_STATUSES: readonly SaleStatus[] = [
  "PENDING",
  "PAID",
  "PARTIALLY_PAID",
  "CANCELLED",
  "REFUNDED",
];

const VALID_METHODS: readonly PaymentMethod[] = [
  "CASH",
  "MVOLA",
  "ORANGE_MONEY",
  "AIRTEL_MONEY",
  "BANK",
  "OTHER",
];

/* ============================================================
   LIST
============================================================ */

export async function listSales(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawStatus = req.query.status;
    let status: SaleStatus | undefined;

    if (typeof rawStatus === "string") {
      if (!VALID_STATUSES.includes(rawStatus as SaleStatus)) {
        return res.status(400).json({
          success: false,
          message: `Statut invalide. Valeurs acceptées : ${VALID_STATUSES.join(", ")}.`,
        });
      }

      status = rawStatus as SaleStatus;
    }

    const siteId =
      typeof req.query.siteId === "string"
        ? req.query.siteId
        : undefined;

    const sales = await getSales({ status, siteId });

    return res.status(200).json({
      success: true,
      data: sales,
      count: sales.length,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   SUMMARY
============================================================ */

export async function salesSummary(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const summary = await getSummary();

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   GET SALE + PAYMENTS
============================================================ */

export async function getSale(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    const details = await getSaleDetails(String(id ?? ""));

    return res.status(200).json({
      success: true,
      data: details,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   CREATE
============================================================ */

export async function createSaleController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      siteId,
      planId,
      voucherId,
      customerName,
      customerPhone,
      quantity,
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

    const sale = await createSale({
      siteId: siteId.trim(),
      planId: planId.trim(),
      voucherId:
        typeof voucherId === "string" && voucherId.trim()
          ? voucherId.trim()
          : null,
      customerName:
        typeof customerName === "string" && customerName.trim()
          ? customerName.trim()
          : null,
      customerPhone:
        typeof customerPhone === "string" &&
        customerPhone.trim()
          ? customerPhone.trim()
          : null,
      quantity:
        quantity !== undefined && quantity !== null
          ? Number(quantity)
          : undefined,
      createdBy: req.auth?.sub ?? null,
    });

    return res.status(201).json({
      success: true,
      message: "Vente enregistrée avec succès.",
      data: sale,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   RECORD PAYMENT
============================================================ */

export async function recordPaymentController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id: saleId } = req.params;
    const { amount, method, reference, customerPhone, notes, markAsPaid } =
      req.body;

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Le montant doit être un nombre positif.",
      });
    }

    if (
      typeof method !== "string" ||
      !VALID_METHODS.includes(method as PaymentMethod)
    ) {
      return res.status(400).json({
        success: false,
        message: `Méthode de paiement invalide. Valeurs acceptées : ${VALID_METHODS.join(", ")}.`,
      });
    }

    const payment = await recordPayment({
      saleId: String(saleId ?? ""),
      amount: numericAmount,
      method: method as PaymentMethod,
      reference:
        typeof reference === "string" && reference.trim()
          ? reference.trim()
          : null,
      customerPhone:
        typeof customerPhone === "string" &&
        customerPhone.trim()
          ? customerPhone.trim()
          : null,
      notes:
        typeof notes === "string" && notes.trim()
          ? notes.trim()
          : null,
      markAsPaid: markAsPaid !== false,
    });

    return res.status(201).json({
      success: true,
      message: "Paiement enregistré avec succès.",
      data: payment,
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   CANCEL
============================================================ */

export async function cancelSaleController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    await cancelSale(String(id ?? ""));

    return res.status(200).json({
      success: true,
      message: "Vente annulée avec succès.",
    });
  } catch (error) {
    return next(error);
  }
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteSaleController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    await deleteSaleById(String(id ?? ""));

    return res.status(200).json({
      success: true,
      message: "Vente supprimée avec succès.",
    });
  } catch (error) {
    return next(error);
  }
}
