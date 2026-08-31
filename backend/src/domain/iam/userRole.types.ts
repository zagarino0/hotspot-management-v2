export type AccessScope =
  | "ORGANIZATION"
  | "SITE";

export interface UserRole {
  id: string;

  userId: string;
  roleId: string;

  /**
   * Portée d'application du rôle.
   */
  scope: AccessScope;

  /**
   * Obligatoire lorsque scope = SITE.
   */
  siteId?: string | null;

  createdAt: Date;
}