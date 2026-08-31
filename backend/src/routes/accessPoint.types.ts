export type AccessPointStatus =
  | "ONLINE"
  | "OFFLINE"
  | "UNKNOWN"
  | "DISABLED";

export interface AccessPointRow {
  id: string;

  siteId: string;
  siteName: string;

  routerId: string | null;
  routerName: string | null;

  name: string;
  code: string;

  vendor: string | null;
  model: string | null;

  serialNumber: string | null;
  macAddress: string | null;

  managementIp: string | null;

  status: AccessPointStatus;

  /* Radio principale (facultative), pour l'affichage liste */
  ssid: string | null;
  band: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAccessPointData {
  siteId: string;
  routerId?: string | null;

  name: string;
  code: string;

  vendor?: string | null;
  model?: string | null;
  macAddress?: string | null;
  managementIp?: string | null;

  /* Radio principale facultative créée en même temps que l'AP */
  ssid?: string | null;
  band?: string | null;
}
