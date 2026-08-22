import api from "./api";

/* ============================================================
   TYPES — alignés sur backend/src/routes/session.types.ts
============================================================ */

export type SessionStatus =
  | "ACTIVE"
  | "COMPLETED"
  | "TERMINATED"
  | "ERROR";

export interface Session {
  id: string;

  siteId: string;
  routerId: string;
  routerName: string | null;

  voucherId: string | null;
  clientId: string | null;
  deviceId: string | null;

  username: string | null;

  macAddress: string | null;
  ipAddress: string | null;

  startedAt: string;
  endedAt: string | null;

  durationSeconds: number | null;

  uploadBytes: number;
  downloadBytes: number;

  terminationReason: string | null;

  status: SessionStatus;

  createdAt: string;
  updatedAt: string;
}

export interface RouterSyncResult {
  routerId: string;
  routerName: string;
  success: boolean;
  activeCount: number;
  closedCount: number;
  error?: string;
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

export async function fetchSessions(
  status?: SessionStatus
): Promise<Session[]> {
  const response = await api.get<ApiEnvelope<Session[]>>(
    "/api/sessions",
    {
      params: status ? { status } : undefined,
    }
  );

  return response.data.data;
}

/* ============================================================
   SYNC (déclenche une lecture live sur tous les routeurs)
============================================================ */

export interface SyncSessionsResult {
  sessions: Session[];
  syncResults: RouterSyncResult[];
}

export async function syncSessions(): Promise<
  ApiEnvelope<SyncSessionsResult>
> {
  const response = await api.post<
    ApiEnvelope<SyncSessionsResult>
  >("/api/sessions/sync");

  return response.data;
}

/* ============================================================
   TERMINATE (déconnexion manuelle d'un utilisateur en direct)
============================================================ */

export async function terminateSession(
  id: string
): Promise<Session> {
  const response = await api.post<ApiEnvelope<Session>>(
    `/api/sessions/${id}/terminate`
  );

  return response.data.data;
}
