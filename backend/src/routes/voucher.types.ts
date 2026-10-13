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

  planId: string | null;
  planName: string | null;
  mikrotikProfile: string | null;
  planPrice: number | null;
  planCurrency: string | null;

  batchId: string | null;
  routerId?: string | null;
  pointOfSaleId?: string | null;
  mikrotikUsername?: string | null;
  mikrotikComment?: string | null;

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
  routerId: string;
  pointOfSaleId: string;
  pointOfSaleCode?: string;

  quantity: number;

  batchName: string;
  prefix?: string | null;
  mikrotikProfile?: string | null;

  createdBy?: string | null;
}

export interface VoucherBatchResult {
  batchId: string;
  quantity: number;
  vouchers: VoucherRow[];
}
