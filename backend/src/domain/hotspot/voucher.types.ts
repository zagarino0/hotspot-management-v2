export type VoucherStatus =
  | "UNUSED"
  | "ACTIVE"
  | "EXPIRED"
  | "DISABLED"
  | "REVOKED";

export interface Voucher {
  id: string;

  organizationId: string;
  siteId: string;

  planId: string;
  batchId?: string | null;

  code: string;

  /**
   * Secret éventuel utilisé pour l'authentification.
   * Ne jamais exposer au frontend.
   */
  secret?: string | null;

  status: VoucherStatus;

  createdAt: Date;

  firstUsedAt?: Date | null;
  activatedAt?: Date | null;

  expiresAt?: Date | null;

  lastUsedAt?: Date | null;

  disabledAt?: Date | null;
}