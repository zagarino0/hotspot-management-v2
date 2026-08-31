export type RoleStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export interface PermissionRow {
  id: string;
  name: string;
  code: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface RoleRow {
  id: string;

  organizationId: string | null;

  name: string;
  code: string;

  description: string | null;

  status: RoleStatus;

  /** true = rôle système protégé (Super Admin...), non éditable. */
  isSystem: boolean;

  permissionCount: number;
  userCount: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoleData {
  organizationId: string;

  name: string;
  code: string;

  description?: string | null;

  permissionIds: string[];
}

export interface UpdateRoleData {
  name?: string;
  description?: string | null;
  status?: RoleStatus;

  /** Si fourni, remplace entièrement l'ensemble des permissions. */
  permissionIds?: string[];
}
