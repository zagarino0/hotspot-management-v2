export type AccessPointStatus =
  | "ONLINE"
  | "OFFLINE"
  | "DEGRADED"
  | "UNKNOWN"
  | "DISABLED";

export interface AccessPoint {
  id: string;

  siteId: string;

  /**
   * Facultatif :
   * null = AP indépendant/non rattaché
   */
  routerId?: string | null;

  name: string;
  code: string;

  vendor: string;
  model: string;

  serialNumber?: string | null;
  macAddress: string;

  managementIp?: string | null;
  managementVlan?: number | null;
  gateway?: string | null;

  dhcpEnabled?: boolean;

  status: AccessPointStatus;

  createdAt: Date;
  updatedAt: Date;
}