import api from "./api";

export interface Client {
  id: string;
  siteId: string;

  username: string | null;
  displayName: string | null;

  phone: string | null;
  email: string | null;

  status: string;

  firstSeenAt: string | null;
  lastSeenAt: string | null;

  createdAt: string;
  updatedAt: string;

  sessionsCount: number;
}

interface ClientsResponse {
  success: boolean;
  data: Client[];
  count: number;
}

interface ClientResponse {
  success: boolean;
  data: Client;
}

export type ClientStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "BLOCKED"
  | "ARCHIVED";

export interface CreateClientPayload {
  siteId: string;
  username?: string;
  displayName?: string;
  phone?: string;
  email?: string;
  status?: ClientStatus;
}

export interface UpdateClientPayload {
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: ClientStatus;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function fetchClients(): Promise<Client[]> {
  const response =
    await api.get<ClientsResponse>("/api/clients");

  return response.data.data;
}

export async function fetchClientById(
  id: string
): Promise<Client> {
  const response =
    await api.get<ClientResponse>(
      `/api/clients/${id}`
    );

  return response.data.data;
}

/* ============================================================
   CREATE
============================================================ */

export async function createClient(
  payload: CreateClientPayload
): Promise<Client> {
  const response = await api.post<ApiEnvelope<Client>>(
    "/api/clients",
    payload
  );

  return response.data.data;
}

/* ============================================================
   UPDATE
============================================================ */

export async function updateClient(
  id: string,
  payload: UpdateClientPayload
): Promise<Client> {
  const response = await api.patch<ApiEnvelope<Client>>(
    `/api/clients/${id}`,
    payload
  );

  return response.data.data;
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteClient(id: string): Promise<void> {
  await api.delete(`/api/clients/${id}`);
}