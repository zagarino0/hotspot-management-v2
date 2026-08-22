export type VoucherStatus =
  | "UNUSED"
  | "ACTIVE"
  | "EXPIRED"
  | "DISABLED"
  | "REVOKED";

export interface VoucherRow {
  id: string;

  siteId: string;
  siteName: string;

  planId: string;
  planName: string;
  planPrice: number;
  planCurrency: string;

  batchId: string | null;

  code: string;

  status: VoucherStatus;

  activatedAt: Date | null;
  expiresAt: Date | null;

  durationSeconds: number | null;
  dataLimitBytes: number | null;

  soldAt: Date | null;
  usedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface GenerateVouchersData {
  siteId: string;
  planId: string;

  quantity: number;

  batchName: string;
  prefix?: string | null;

  createdBy?: string | null;
}

export interface VoucherBatchResult {
  batchId: string;
  quantity: number;
  vouchers: VoucherRow[];
}
