export type SyncJobType =
  | "HEALTH_CHECK"
  | "SYNC_USERS"
  | "SYNC_SESSIONS"
  | "SYNC_PROFILES"
  | "SYNC_VOUCHERS"
  | "PUSH_CONFIGURATION"
  | "PULL_CONFIGURATION";

export type SyncJobStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";

export interface SyncJob {
  id: string;

  organizationId: string;
  siteId: string;
  routerId: string;

  jobType: SyncJobType;
  status: SyncJobStatus;

  attempts: number;

  startedAt?: Date | null;
  finishedAt?: Date | null;

  errorMessage?: string | null;

  result?: Record<string, unknown> | null;

  createdAt: Date;
  updatedAt: Date;
}