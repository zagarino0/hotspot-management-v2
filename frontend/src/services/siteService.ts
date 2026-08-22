import api from "./api";

/* ============================================================
   TYPES — alignés sur backend/src/routes/site.types.ts
============================================================ */

export type SiteStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "ARCHIVED";

export interface Site {
  id: string;
  organizationId: string;

  name: string;
  code: string;

  description: string | null;

  address: string | null;
  city: string | null;
  region: string | null;
  district: string | null;

  latitude: number | null;
  longitude: number | null;

  timezone: string | null;

  status: SiteStatus;

  routerCount: number;
  routerOnlineCount: number;
  accessPointCount: number;
  clientCount: number;

  createdAt: string;
  updatedAt: string;
}

export interface CreateSitePayload {
  name: string;
  code: string;
  description?: string;
  address?: string;
  city?: string;
  region?: string;
  district?: string;
  timezone?: string;
}

export interface UpdateSitePayload {
  name?: string;
  code?: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  district?: string | null;
  timezone?: string | null;
  status?: SiteStatus;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

/* ============================================================
   LIST
============================================================ */

export async function getSites(): Promise<Site[]> {
  const response =
    await api.get<ApiEnvelope<Site[]>>("/api/sites");

  return response.data.data;
}

/* ============================================================
   CREATE
============================================================ */

export async function createSite(
  payload: CreateSitePayload
): Promise<Site> {
  const response = await api.post<ApiEnvelope<Site>>(
    "/api/sites",
    payload
  );

  return response.data.data;
}

/* ============================================================
   UPDATE
============================================================ */

export async function updateSite(
  id: string,
  payload: UpdateSitePayload
): Promise<Site> {
  const response = await api.patch<ApiEnvelope<Site>>(
    `/api/sites/${id}`,
    payload
  );

  return response.data.data;
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteSite(id: string): Promise<void> {
  await api.delete(`/api/sites/${id}`);
}
