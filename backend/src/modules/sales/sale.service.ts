import {
  deleteSale,
  findSaleById,
  findSales,
  getSalesSummary,
  insertSale,
  findPointOfSales,
  updateSaleStatus,
} from "./sale.repository.js";

import {
  findPaymentsBySaleId,
  insertPayment,
} from "./payment.repository.js";

import { findPlanById } from "../plans/plan.repository.js";
import { findSiteProfilePrices } from "../plans/sitePricing.repository.js";

import {
  badRequest,
  conflict,
  notFoundError,
} from "../../lib/errors.js";

import { pool } from "../../database/pool.js";

import type {
  CreateSaleData,
  SaleStatus,
} from "../../routes/sale.types.js";
import type { RecordPaymentData } from "../../routes/payment.types.js";

export async function getSales(filter?: {
  status?: SaleStatus;
  siteId?: string;
  pointOfSaleId?: string;
}) {
  return findSales(filter);
}

export async function getPointOfSales() {
  return findPointOfSales();
}

export async function getSaleDetails(id: string) {
  const sale = await findSaleById(id);

  if (!sale) {
    throw notFoundError("Vente introuvable.");
  }

  const payments = await findPaymentsBySaleId(id);

  return { sale, payments };
}

export async function getSummary() {
  return getSalesSummary();
}

/* ============================================================
   CREATE
   Le prix proposé est celui du forfait du site sélectionné.
   Il peut être ajusté pour cette vente uniquement et est ensuite
   enregistré comme snapshot dans la vente.
============================================================ */

export async function createSale(data: CreateSaleData) {
  if (
    data.quantity !== undefined &&
    (!Number.isInteger(data.quantity) || data.quantity < 1)
  ) {
    throw badRequest(
      "La quantité doit être un entier positif."
    );
  }

  if (
    data.unitPrice !== undefined &&
    (!Number.isFinite(data.unitPrice) || data.unitPrice < 0)
  ) {
    throw badRequest(
      "Le prix unitaire doit être un nombre positif ou nul."
    );
  }

  const profileCode = data.profileCode.trim().toLowerCase();
  const siteProfiles = await findSiteProfilePrices(data.siteId);

  const profile = siteProfiles.find(
    (item) => item.code === profileCode
  );

  if (!profile) {
    throw notFoundError(
      "Profil forfait introuvable pour le site sélectionné."
    );
  }

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
  }

  if (data.voucherId) {
    const voucherResult = await pool.query<{
      siteId: string;
      mikrotikProfile: string | null;
    }>(
      `
        SELECT
          site_id AS "siteId",
          mikrotik_profile AS "mikrotikProfile"
        FROM voucher
        WHERE id = $1
        LIMIT 1
      `,
      [data.voucherId]
    );

    const voucher = voucherResult.rows[0];

    if (!voucher) {
      throw notFoundError("Voucher introuvable.");
    }

    if (voucher.siteId !== data.siteId) {
      throw badRequest(
        "Le voucher n'appartient pas au site sélectionné."
      );
    }

    if (
      voucher.mikrotikProfile &&
      voucher.mikrotikProfile.trim().toLowerCase() !== profileCode
    ) {
      throw badRequest(
        "Le voucher sélectionné ne correspond pas au profil choisi."
      );
    }
  }

  return insertSale(data, {
    price: data.unitPrice ?? profile.price,
    currency: profile.currency,
    profileCode: profile.code,
    profileName: profile.name,
  });
}

export async function recordPayment(
  data: RecordPaymentData
) {
  if (!(data.amount > 0)) {
    throw badRequest(
      "Le montant du paiement doit être positif."
    );
  }

  const sale = await findSaleById(data.saleId);

  if (!sale) {
    throw notFoundError("Vente introuvable.");
  }

  if (
    sale.status === "CANCELLED" ||
    sale.status === "REFUNDED"
  ) {
    throw conflict(
      `Cette vente est "${sale.status}", aucun paiement ne peut plus y être ajouté.`
    );
  }

  const payment = await insertPayment(
    sale.siteId,
    data,
    sale.currency
  );

  if (payment.status === "SUCCESS") {
    const payments = await findPaymentsBySaleId(sale.id);

    const totalPaid = payments
      .filter((p) => p.status === "SUCCESS")
      .reduce((sum, p) => sum + p.amount, 0);

    const newStatus: SaleStatus =
      totalPaid >= sale.totalAmount
        ? "PAID"
        : totalPaid > 0
          ? "PARTIALLY_PAID"
          : sale.status;

    await updateSaleStatus(sale.id, newStatus);

    if (newStatus === "PAID" && sale.voucherId) {
      await pool.query(
        `
          UPDATE voucher
          SET sold_at = COALESCE(sold_at, NOW())
          WHERE id = $1
        `,
        [sale.voucherId]
      );
    }
  }

  return payment;
}

export async function cancelSale(id: string) {
  const sale = await findSaleById(id);

  if (!sale) {
    throw notFoundError("Vente introuvable.");
  }

  if (sale.paidAmount > 0) {
    throw conflict(
      "Cette vente a déjà reçu un paiement : utilisez un remboursement plutôt qu'une annulation."
    );
  }

  await updateSaleStatus(id, "CANCELLED");
}

export async function deleteSaleById(id: string) {
  const sale = await findSaleById(id);

  if (!sale) {
    throw notFoundError("Vente introuvable.");
  }

  if (sale.status !== "PENDING" || sale.paidAmount > 0) {
    throw conflict(
      "Seules les ventes en attente sans paiement peuvent être supprimées. Utilisez l'annulation à la place."
    );
  }

  await deleteSale(id);
}
