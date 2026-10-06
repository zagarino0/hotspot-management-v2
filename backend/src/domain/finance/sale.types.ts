/*
 * Doit rester synchronisé avec le schéma réel de la table `sale`
 * (backend/migrations/006_billing.sql). Cette version antérieure
 * référençait des colonnes qui n'existent pas en base
 * (organizationId, sellerId, saleNumber, amount unique) et un
 * statut "COMPLETED" qui n'existe pas dans la contrainte CHECK
 * réelle (qui attend "PAID").
 */
export type SaleStatus =
  | "PENDING"
  | "PAID"
  | "PARTIALLY_PAID"
  | "CANCELLED"
  | "REFUNDED";

export interface Sale {
  id: string;

  siteId: string;

  /**
   * Voucher vendu (facultatif : une vente peut précéder la
   * génération/l'assignation d'un voucher précis).
   */
  voucherId?: string | null;

  /**
   * Plan vendu. Conservé dans la vente pour garder
   * l'historique du produit commercial.
   */
  planId: string;

  customerName?: string | null;
  customerPhone?: string | null;

  quantity: number;

  unitPrice: number;
  totalAmount: number;

  currency: string;

  status: SaleStatus;

  soldAt: Date;

  createdBy?: string | null;

  createdAt: Date;
  updatedAt: Date;
}