export type PermissionAction =
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "MANAGE"
  | "EXECUTE";

export type PermissionResource =
  | "ORGANIZATION"
  | "SITE"
  | "USER"
  | "ROLE"
  | "ROUTER"
  | "ROUTER_CREDENTIAL"
  | "ACCESS_POINT"
  | "AP_RADIO"
  | "PLAN"
  | "VOUCHER"
  | "VOUCHER_BATCH"
  | "CLIENT"
  | "DEVICE"
  | "SESSION"
  | "SALE"
  | "PAYMENT"
  | "PAYMENT_METHOD"
  | "SYNC_JOB"
  | "ROUTER_EVENT"
  | "ROUTER_METRIC"
  | "AUDIT_LOG";

export interface Permission {
  id: string;

  name: string;
  code: string;

  resource: PermissionResource;
  action: PermissionAction;

  description?: string | null;

  createdAt: Date;
}