export type ClientStatus =
  | "ACTIVE"
  | "BLOCKED"
  | "ARCHIVED";

export interface Client {
  id: string;

  organizationId: string;
  siteId: string;

  username?: string | null;

  phone?: string | null;
  email?: string | null;

  displayName?: string | null;

  status: ClientStatus;

  firstSeenAt: Date;
  lastSeenAt: Date;

  createdAt: Date;
  updatedAt: Date;
}