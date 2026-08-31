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

export interface PaymentRow {
  id: string;

  siteId: string;
  saleId: string;

  amount: number;
  currency: string;

  method: PaymentMethod;

  status: PaymentStatus;

  paidAt: Date | null;

  reference: string | null;
  customerPhone: string | null;
  notes: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface RecordPaymentData {
  saleId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  /** true = paiement immédiatement encaissé (ex: cash), false = à confirmer (ex: mobile money en attente) */
  markAsPaid: boolean;
}
