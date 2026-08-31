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

  planId: string | null;  // Peut être null si on utilise directement le profil MikroTik
  planName: string | null;
  planPrice: number | null;
  planCurrency: string | null;

  mikrotikProfile: string | null;  // Profil MikroTik direct

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
  planId?: string | null;  // Optionnel si on utilise mikrotikProfile
  mikrotikProfile?: string;  // Profil MikroTik direct

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
