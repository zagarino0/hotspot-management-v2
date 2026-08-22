import api from "./api";

export type AccessPointStatus =
  | "ONLINE"
  | "OFFLINE"
  | "UNKNOWN"
  | "DISABLED";

export interface AccessPoint {
  id: string;

  siteId: string;
  siteName: string;

  routerId: string | null;
  routerName: string | null;

  name: string;
  code: string;

  vendor: string | null;
  model: string | null;

  serialNumber: string | null;
  macAddress: string | null;

  managementIp: string | null;

  status: AccessPointStatus;

  ssid: string | null;
  band: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface CreateAccessPointPayload {
  siteId: string;
  routerId?: string;
  name: string;
  code: string;
  vendor?: string;
  model?: string;
  macAddress?: string;
  managementIp?: string;
  ssid?: string;
  band?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

export async function getAccessPoints(): Promise<
  AccessPoint[]
> {
  const response = await api.get<
    ApiEnvelope<AccessPoint[]>
  >("/api/access-points");

  return response.data.data;
}

export async function createAccessPoint(
  payload: CreateAccessPointPayload
): Promise<AccessPoint> {
  const response = await api.post<
    ApiEnvelope<AccessPoint>
  >("/api/access-points", payload);

  return response.data.data;
}

/* ============================================================
   UPDATE
============================================================ */

export interface UpdateAccessPointPayload {
  name?: string;
  vendor?: string | null;
  model?: string | null;
  macAddress?: string | null;
  managementIp?: string | null;
}

export async function updateAccessPoint(
  id: string,
  payload: UpdateAccessPointPayload
): Promise<AccessPoint> {
  const response = await api.patch<ApiEnvelope<AccessPoint>>(
    `/api/access-points/${id}`,
    payload
  );

  return response.data.data;
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteAccessPoint(
  id: string
): Promise<void> {
  await api.delete(`/api/access-points/${id}`);
}
