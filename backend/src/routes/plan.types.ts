export type PlanStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "ARCHIVED";

export interface PlanRow {
  id: string;

  siteId: string;
  siteName: string;

  name: string;
  code: string;

  description: string | null;

  price: number;
  currency: string;

  durationSeconds: number | null;
  dataLimitBytes: number | null;

  downloadSpeedBps: number | null;
  uploadSpeedBps: number | null;

  simultaneousSessions: number;

  status: PlanStatus;

  voucherCount: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlanData {
  siteId: string;

  name: string;
  code: string;

  description?: string | null;

  price: number;
  currency?: string;

  durationSeconds?: number | null;
  dataLimitBytes?: number | null;

  downloadSpeedBps?: number | null;
  uploadSpeedBps?: number | null;

  simultaneousSessions?: number;
}
