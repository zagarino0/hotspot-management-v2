export type RouterEventType =
  | "ONLINE"
  | "OFFLINE"
  | "API_ERROR"
  | "CONNECTION_LOST"
  | "CONNECTION_RESTORED"
  | "CONFIG_CHANGED"
  | "SYNC_STARTED"
  | "SYNC_COMPLETED"
  | "SYNC_FAILED"
  | "AUTHENTICATION_FAILED"
  | "HIGH_CPU"
  | "HIGH_MEMORY"
  | "UNKNOWN";

export type RouterEventSeverity =
  | "INFO"
  | "WARNING"
  | "ERROR"
  | "CRITICAL";

export interface RouterEvent {
  id: string;

  organizationId: string;
  siteId: string;
  routerId: string;

  eventType: RouterEventType;

  severity: RouterEventSeverity;

  message: string;

  details?: Record<string, unknown> | null;

  occurredAt: Date;

  createdAt: Date;
}