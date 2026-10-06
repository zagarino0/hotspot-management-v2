import api from "./api";

export type RoleStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export interface Permission {
  id: string;
  name: string;
  code: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface Role {
  id: string;
  organizationId: string | null;

  name: string;
  code: string;

  description: string | null;

  status: RoleStatus;

  isSystem: boolean;

  permissionCount: number;
  userCount: number;

  createdAt: string;
  updatedAt: string;
}

export interface CreateRolePayload {
  name: string;
  code: string;
  description?: string;
  permissionIds: string[];
}

export interface UpdateRolePayload {
  name?: string;
  description?: string | null;
  status?: RoleStatus;
  permissionIds?: string[];
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

export async function getRoles(): Promise<Role[]> {
  const response =
    await api.get<ApiEnvelope<Role[]>>("/api/roles");

  return response.data.data;
}

/* ============================================================
   PERMISSIONS CATALOG
============================================================ */

export async function getAllPermissions(): Promise<
  Permission[]
> {
  const response = await api.get<ApiEnvelope<Permission[]>>(
    "/api/roles/permissions"
  );

  return response.data.data;
}

/* ============================================================
   GET ROLE (+ permissions attribuées)
============================================================ */

export async function getRoleDetails(
  id: string
): Promise<{ role: Role; permissionIds: string[] }> {
  const response = await api.get<
    ApiEnvelope<{ role: Role; permissionIds: string[] }>
  >(`/api/roles/${id}`);

  return response.data.data;
}

/* ============================================================
   CREATE
============================================================ */

export async function createRole(
  payload: CreateRolePayload
): Promise<Role> {
  const response = await api.post<ApiEnvelope<Role>>(
    "/api/roles",
    payload
  );

  return response.data.data;
}

/* ============================================================
   UPDATE
============================================================ */

export async function updateRole(
  id: string,
  payload: UpdateRolePayload
): Promise<Role> {
  const response = await api.patch<ApiEnvelope<Role>>(
    `/api/roles/${id}`,
    payload
  );

  return response.data.data;
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteRole(id: string): Promise<void> {
  await api.delete(`/api/roles/${id}`);
}
