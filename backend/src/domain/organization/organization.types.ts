export type OrganizationStatus =
  | "ACTIVE"
  | "SUSPENDED"
  | "ARCHIVED";

export interface Organization {
  id: string;

  name: string;
  code: string;

  description?: string | null;

  email?: string | null;
  phone?: string | null;
  address?: string | null;

  country: string;
  timezone: string;
  currency: string;

  status: OrganizationStatus;

  createdAt: Date;
  updatedAt: Date;
}