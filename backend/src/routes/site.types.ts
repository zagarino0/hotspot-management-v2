export type SiteStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "ARCHIVED";

export interface SiteRow {
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

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSiteData {
  organizationId: string;

  name: string;
  code: string;

  description?: string | null;

  address?: string | null;
  city?: string | null;
  region?: string | null;
  district?: string | null;

  timezone?: string | null;
}
