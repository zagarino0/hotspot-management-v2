import api from "./api";

export type SaleStatus =
  | "PENDING"
  | "PAID"
  | "PARTIALLY_PAID"
  | "CANCELLED"
  | "REFUNDED";

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

export interface Sale {
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

  lastPaymentMethod: PaymentMethod | null;

  currency: string;

  status: SaleStatus;

  soldAt: string;

  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  siteId: string;
  saleId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string | null;
  reference: string | null;
  customerPhone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesSummary {
  totalRevenue: number;
  salesCount: number;
  averageBasket: number;
  mobilePaymentShare: number;
  revenueByDay: Array<{ date: string; amount: number }>;
}

export interface CreateSalePayload {
  siteId: string;
  planId: string;
  voucherId?: string;
  customerName?: string;
  customerPhone?: string;
  quantity?: number;
}

export interface RecordPaymentPayload {
  amount: number;
  method: PaymentMethod;
  reference?: string;
  customerPhone?: string;
  notes?: string;
  markAsPaid?: boolean;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

/* ============================================================
   LIST
============================================================ */

export async function getSales(filter?: {
  status?: SaleStatus;
}): Promise<Sale[]> {
  const response = await api.get<ApiEnvelope<Sale[]>>(
    "/api/sales",
    {
      params: filter?.status
        ? { status: filter.status }
        : undefined,
    }
  );

  return response.data.data;
}

/* ============================================================
   SUMMARY
============================================================ */

export async function getSalesSummary(): Promise<SalesSummary> {
  const response = await api.get<ApiEnvelope<SalesSummary>>(
    "/api/sales/summary"
  );

  return response.data.data;
}

/* ============================================================
   DETAILS (vente + paiements)
============================================================ */

export async function getSaleDetails(
  id: string
): Promise<{ sale: Sale; payments: Payment[] }> {
  const response = await api.get<
    ApiEnvelope<{ sale: Sale; payments: Payment[] }>
  >(`/api/sales/${id}`);

  return response.data.data;
}

/* ============================================================
   CREATE
============================================================ */

export async function createSale(
  payload: CreateSalePayload
): Promise<Sale> {
  const response = await api.post<ApiEnvelope<Sale>>(
    "/api/sales",
    payload
  );

  return response.data.data;
}

/* ============================================================
   RECORD PAYMENT
============================================================ */

export async function recordPayment(
  saleId: string,
  payload: RecordPaymentPayload
): Promise<Payment> {
  const response = await api.post<ApiEnvelope<Payment>>(
    `/api/sales/${saleId}/payments`,
    payload
  );

  return response.data.data;
}

/* ============================================================
   CANCEL / DELETE
============================================================ */

export async function cancelSale(id: string): Promise<void> {
  await api.post(`/api/sales/${id}/cancel`);
}

export async function deleteSale(id: string): Promise<void> {
  await api.delete(`/api/sales/${id}`);
}
