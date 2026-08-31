/*
 * Doit rester synchronisé avec le schéma réel de la table
 * `payment` (backend/migrations/006_billing.sql). La version
 * antérieure référençait "paymentMethodId", supposant une table
 * payment_method qui n'a jamais été créée en base : `method` est
 * en réalité un champ direct sur `payment` (CASH/MVOLA/...).
 * Statut réel : PENDING/SUCCESS/FAILED/CANCELLED/REFUNDED
 * (pas de "PROCESSING", "COMPLETED" devient "SUCCESS").
 */
export type PaymentMethod =
  | "CASH"
  | "MVOLA"
  | "ORANGE_MONEY"
  | "AIRTEL_MONEY"
  | "BANK"
  | "OTHER";

export type PaymentStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export interface Payment {
  id: string;

  siteId: string;
  saleId: string;

  amount: number;
  currency: string;

  method: PaymentMethod;

  status: PaymentStatus;

  paidAt?: Date | null;

  reference?: string | null;

  customerPhone?: string | null;

  notes?: string | null;

  createdAt: Date;
  updatedAt: Date;
}