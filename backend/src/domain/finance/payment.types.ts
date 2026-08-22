export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export interface Payment {
  id: string;

  saleId: string;

  paymentMethodId: string;

  amount: number;

  currency: string;

  status: PaymentStatus;

  /**
   * Référence générée par notre système.
   */
  transactionReference?: string | null;

  /**
   * Référence fournie par le prestataire
   * Mobile Money / banque / etc.
   */
  providerReference?: string | null;

  paidAt?: Date | null;

  failedAt?: Date | null;

  failureReason?: string | null;

  /**
   * Informations complémentaires
   * spécifiques au fournisseur.
   */
  metadata?: Record<string, unknown> | null;

  createdAt: Date;
  updatedAt: Date;
}