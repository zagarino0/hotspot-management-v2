export type SaleStatus =
  | "PENDING"
  | "PAID"
  | "PARTIALLY_PAID"
  | "CANCELLED"
  | "REFUNDED";

export interface SaleRow {
  id: string;

  siteId: string;
  siteName: string;

  voucherId: string | null;
  voucherCode: string | null;

  planId: string;
  planName: string;

  customerName: string | null;
  customerPhone: string | null;

  quantity: number;

  unitPrice: number;
  totalAmount: number;
  paidAmount: number;

  lastPaymentMethod:
    | "CASH"
    | "MVOLA"
    | "ORANGE_MONEY"
    | "AIRTEL_MONEY"
    | "BANK"
    | "OTHER"
    | null;

  currency: string;

  status: SaleStatus;

  soldAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSaleData {
  siteId: string;
  planId: string;
  voucherId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  quantity?: number;
  createdBy?: string | null;
}

export interface SalesSummary {
  totalRevenue: number;
  salesCount: number;
  averageBasket: number;
  mobilePaymentShare: number;
  revenueByDay: Array<{ date: string; amount: number }>;
}
