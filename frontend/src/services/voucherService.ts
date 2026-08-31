import api from "./api";

export type VoucherStatus =
  | "UNUSED"
  | "ACTIVE"
  | "EXPIRED"
  | "DISABLED"
  | "REVOKED";

export interface Voucher {
  id: string;

  siteId: string;
  siteName: string;

  planId: string | null;
  planName: string | null;
  planPrice: number | null;
  planCurrency: string | null;

  mikrotikProfile: string | null;

  batchId: string | null;

  code: string;

  status: VoucherStatus;

  activatedAt: string | null;
  expiresAt: string | null;

  durationSeconds: number | null;
  dataLimitBytes: number | null;

  soldAt: string | null;
  usedAt: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface GenerateVouchersPayload {
  siteId: string;
  planId?: string | null;
  mikrotikProfile?: string;
  quantity: number;
  batchName?: string;
  prefix?: string;
}

export interface GenerateVouchersResult {
  batchId: string;
  quantity: number;
  vouchers: Voucher[];
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

export async function getVouchers(filter?: {
  status?: VoucherStatus;
}): Promise<Voucher[]> {
  const response = await api.get<ApiEnvelope<Voucher[]>>(
    "/api/vouchers",
    {
      params: filter?.status
        ? { status: filter.status }
        : undefined,
    }
  );

  return response.data.data;
}

export async function generateVouchers(
  payload: GenerateVouchersPayload
): Promise<GenerateVouchersResult> {
  const response = await api.post<
    ApiEnvelope<GenerateVouchersResult>
  >("/api/vouchers/generate", payload);

  return response.data.data;
}

/* ============================================================
   CHANGE STATUS (désactiver / révoquer)
============================================================ */

export async function updateVoucherStatus(
  id: string,
  status: "DISABLED" | "REVOKED"
): Promise<Voucher> {
  const response = await api.patch<ApiEnvelope<Voucher>>(
    `/api/vouchers/${id}/status`,
    { status }
  );

  return response.data.data;
}

/* ============================================================
   DELETE (uniquement si UNUSED)
============================================================ */

export async function deleteVoucher(id: string): Promise<void> {
  await api.delete(`/api/vouchers/${id}`);
}
