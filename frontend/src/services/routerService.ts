import api from "./api";

/* ============================================================
   TYPES — alignés sur backend/src/routes/router.types.ts
============================================================ */

export type RouterStatus =
  | "ONLINE"
  | "OFFLINE"
  | "UNKNOWN"
  | "DISABLED";

export interface Router {
  id: string;
  siteId: string;

  name: string;
  code: string;

  vendor: string;
  model: string | null;

  serialNumber: string | null;
  macAddress: string | null;

  managementIp: string | null;

  apiPort: number;
  apiProtocol: string;

  identity: string | null;
  routerOsVersion: string | null;

  status: RouterStatus;

  lastSeenAt: string | null;
  lastCheckAt: string | null;

  uptimeSeconds: number | null;

  cpuUsage: number | null;
  memoryUsage: number | null;

  lastError: string | null;

  syncEnabled: boolean;
  lastSyncAt: string | null;
  syncStatus: string;

  createdAt: string;
  updatedAt: string;
}

export interface RouterTestPayload {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface RouterTestResult {
  connected: boolean;
  identity: string | null;
  model: string | null;
  routerOsVersion: string | null;
  uptime: string | null;
  uptimeSeconds: number | null;
}

export interface CreateRouterPayload
  extends RouterTestPayload {
  siteId: string;
  name: string;
  code: string;
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

export async function getRouters(): Promise<Router[]> {
  const response = await api.get<ApiEnvelope<Router[]>>(
    "/api/routers"
  );

  return response.data.data;
}

/* ============================================================
   FIND BY ID
============================================================ */

export async function getRouterById(
  id: string
): Promise<Router> {
  const response = await api.get<ApiEnvelope<Router>>(
    `/api/routers/${id}`
  );

  return response.data.data;
}

/* ============================================================
   TEST CONNECTION
   Route réelle côté backend : POST /api/routers/test
============================================================ */

export async function testRouterConnection(
  data: RouterTestPayload
): Promise<{
  success: boolean;
  message: string;
  data: RouterTestResult;
}> {
  const response = await api.post<{
    success: boolean;
    message: string;
    data: RouterTestResult;
  }>("/api/routers/test", data);

  return response.data;
}

/* ============================================================
   CREATE
============================================================ */

export async function createRouter(
  data: CreateRouterPayload
): Promise<Router> {
  const response = await api.post<ApiEnvelope<Router>>(
    "/api/routers",
    data
  );

  return response.data.data;
}

/* ============================================================
   UPDATE
============================================================ */

export interface UpdateRouterPayload {
  name?: string;
  model?: string | null;
  managementIp?: string;
  apiPort?: number;
  syncEnabled?: boolean;
}

export async function updateRouter(
  id: string,
  payload: UpdateRouterPayload
): Promise<Router> {
  const response = await api.patch<ApiEnvelope<Router>>(
    `/api/routers/${id}`,
    payload
  );

  return response.data.data;
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteRouter(id: string): Promise<void> {
  await api.delete(`/api/routers/${id}`);
}