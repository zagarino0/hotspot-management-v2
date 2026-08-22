export type RoleStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "ARCHIVED";

export interface Role {
  id: string;

  organizationId?: string | null;

  name: string;
  code: string;

  description?: string | null;

  status: RoleStatus;

  /**
   * true = rôle système protégé.
   * Exemple : SUPER_ADMIN.
   */
  isSystem: boolean;

  createdAt: Date;
  updatedAt: Date;
}