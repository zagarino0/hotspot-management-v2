import api from "./api";

export type UserStatus =
  | "ACTIVE"
  | "INVITED"
  | "SUSPENDED"
  | "DISABLED"
  | "ARCHIVED";

export interface UserRoleSummary {
  id: string;
  name: string;
  code: string;
}

export interface AppUser {
  id: string;
  organizationId: string;

  username: string;
  email: string | null;
  phone: string | null;

  firstName: string | null;
  lastName: string | null;

  status: UserStatus;

  emailVerified: boolean;

  lastLoginAt: string | null;

  roles: UserRoleSummary[];

  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  username: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  password: string;
  status?: UserStatus;
  roleIds?: string[];
}

export interface UpdateUserPayload {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  status?: UserStatus;
  password?: string;
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

export async function getUsers(): Promise<AppUser[]> {
  const response =
    await api.get<ApiEnvelope<AppUser[]>>("/api/users");

  return response.data.data;
}

/* ============================================================
   CREATE
============================================================ */

export async function createUser(
  payload: CreateUserPayload
): Promise<AppUser> {
  const response = await api.post<ApiEnvelope<AppUser>>(
    "/api/users",
    payload
  );

  return response.data.data;
}

/* ============================================================
   UPDATE
============================================================ */

export async function updateUser(
  id: string,
  payload: UpdateUserPayload
): Promise<AppUser> {
  const response = await api.patch<ApiEnvelope<AppUser>>(
    `/api/users/${id}`,
    payload
  );

  return response.data.data;
}

/* ============================================================
   SET ROLES
============================================================ */

export async function updateUserRoles(
  id: string,
  roleIds: string[]
): Promise<AppUser> {
  const response = await api.patch<ApiEnvelope<AppUser>>(
    `/api/users/${id}/roles`,
    { roleIds }
  );

  return response.data.data;
}

/* ============================================================
   DELETE
============================================================ */

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/api/users/${id}`);
}
