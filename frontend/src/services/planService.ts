import api from "./api";

export type PlanStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export interface Plan {
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

  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanPayload {
  siteId: string;
  name: string;
  code: string;
  description?: string;
  price: number;
  currency?: string;
  durationSeconds?: number;
  dataLimitBytes?: number;
  downloadSpeedBps?: number;
  uploadSpeedBps?: number;
  simultaneousSessions?: number;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

export async function getPlans(): Promise<Plan[]> {
  const response =
    await api.get<ApiEnvelope<Plan[]>>("/api/plans");

  return response.data.data;
}

export async function createPlan(
  payload: CreatePlanPayload
): Promise<Plan> {
  const response = await api.post<ApiEnvelope<Plan>>(
    "/api/plans",
    payload
  );

  return response.data.data;
}
