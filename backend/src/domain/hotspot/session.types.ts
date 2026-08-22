/*
 * Doit rester synchronisé avec la contrainte CHECK de la table
 * `session` (backend/migrations/005_hotspot.sql:chk_session_status).
 */
export type SessionStatus =
  | "ACTIVE"
  | "COMPLETED"
  | "TERMINATED"
  | "ERROR";

export interface Session {
  id: string;

  organizationId: string;
  siteId: string;

  routerId: string;

  /**
   * Voucher facultatif pour permettre
   * d'autres méthodes d'authentification
   * à l'avenir.
   */
  voucherId?: string | null;

  clientId?: string | null;

  deviceId?: string | null;

  username?: string | null;

  macAddress?: string | null;

  ipAddress?: string | null;

  startedAt: Date;

  endedAt?: Date | null;

  durationSeconds?: number | null;

  uploadBytes: number;
  downloadBytes: number;

  status: SessionStatus;

  createdAt: Date;
  updatedAt: Date;
}