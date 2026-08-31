export interface RouterMetric {
  id: string;

  organizationId: string;
  siteId: string;
  routerId: string;

  recordedAt: Date;

  cpuUsage?: number | null;

  memoryUsage?: number | null;

  uptimeSeconds?: number | null;

  activeUsers?: number | null;

  activeSessions?: number | null;

  downloadBytes?: number | null;

  uploadBytes?: number | null;
}