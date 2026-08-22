export type AuditStatus =
  | "SUCCESS"
  | "FAILED";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "ENABLE"
  | "DISABLE"
  | "GENERATE_VOUCHERS"
  | "SELL_VOUCHER"
  | "CANCEL_SALE"
  | "REFUND"
  | "CONNECT_ROUTER"
  | "DISCONNECT_ROUTER"
  | "SYNC_ROUTER"
  | "EXECUTE_COMMAND";

export interface AuditLog {
  id: string;

  organizationId: string;

  siteId?: string | null;

  userId?: string | null;

  action: AuditAction;

  entityType: string;

  entityId?: string | null;

  status: AuditStatus;

  ipAddress?: string | null;

  userAgent?: string | null;

  details?: Record<string, unknown> | null;

  createdAt: Date;
}