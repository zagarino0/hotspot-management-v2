/*
 * Doit rester synchronisé avec la contrainte CHECK de la table
 * `site` (backend/migrations/002_organizations.sql:chk_site_status).
 */
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

  description?: string | null;

  address?: string | null;
  city?: string | null;
  region?: string | null;
  district?: string | null;

  latitude?: number | null;
  longitude?: number | null;

  timezone?: string | null;

  status: SiteStatus;

  createdAt: Date;
  updatedAt: Date;
}