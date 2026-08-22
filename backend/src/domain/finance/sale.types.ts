export type SaleStatus =
  | "PENDING"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export interface Sale {
  id: string;

  organizationId: string;
  siteId: string;

  /**
   * Voucher vendu.
   */
  voucherId: string;

  /**
   * Plan vendu.
   *
   * Conservé dans la vente pour garder
   * l'historique du produit commercial.
   */
  planId: string;

  /**
   * Utilisateur ayant effectué la vente.
   */
  sellerId: string;

  /**
   * Référence interne de la vente.
   * Exemple : SALE-2026-000001
   */
  saleNumber: string;

  /**
   * Montant réellement facturé.
   */
  amount: number;

  currency: string;

  status: SaleStatus;

  soldAt: Date;

  cancelledAt?: Date | null;

  notes?: string | null;

  createdAt: Date;
  updatedAt: Date;
}