
export type RouterStatus =
  | "ONLINE"
  | "OFFLINE"
  | "UNKNOWN"
  | "DISABLED";

export type RouterSyncStatus =
  | "NEVER"
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED";

export interface Router {
  id: string;

  siteId: string;

  name: string;
  code: string;

  vendor: string;

  model: string | null;

  serialNumber: string | null;
  macAddress: string | null;

  managementIp: string | null;

  apiPort: number;
  apiProtocol: string;

  identity: string | null;

  routerOsVersion: string | null;

  status: RouterStatus;

  lastSeenAt: Date | null;
  lastCheckAt: Date | null;

  uptimeSeconds: number | null;

  cpuUsage: number | null;
  memoryUsage: number | null;

  lastError: string | null;

  syncEnabled: boolean;
  lastSyncAt: Date | null;

  syncStatus: RouterSyncStatus;

  createdAt: Date;
  updatedAt: Date;
}