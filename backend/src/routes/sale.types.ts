export type PointOfSaleType = "INTERNAL" | "EXTERNAL";

export interface PointOfSale {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: PointOfSaleType;
  status: "ACTIVE" | "INACTIVE";
}

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

  pointOfSaleId: string;
  pointOfSaleCode: string;
  pointOfSaleName: string;
  pointOfSaleType: PointOfSaleType;

  voucherId: string | null;
  voucherCode: string | null;

  planId: string | null;
  planName: string;

  profileCode: string | null;

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
  pointOfSaleId?: string | null;
  planId?: string | null;
  profileCode: string;
  voucherId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  quantity?: number;
  unitPrice?: number;
  createdBy?: string | null;
}

export interface SalesSummary {
  totalRevenue: number;
  todayRevenue: number;
  externalTodayRevenue: number;
  externalTodaySalesCount: number;
  salesCount: number;
  averageBasket: number;
  mobilePaymentShare: number;
  cashPaymentShare: number;
  revenueByDay: Array<{ date: string; amount: number }>;
}
