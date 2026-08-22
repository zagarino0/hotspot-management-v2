/*
 * IMPORTANT : ces valeurs doivent rester synchronisées avec la
 * contrainte CHECK de la table `session` (voir
 * backend/migrations/005_hotspot.sql). Le type
 * domain/hotspot/session.types.ts contenait EXPIRED/LOST qui ne
 * sont pas acceptés par la base — c'était une source de bug
 * potentiel (insertion qui aurait échoué en silence côté typage
 * mais planté en runtime). On aligne ici sur la vraie contrainte.
 */
export type SessionStatus =
  | "ACTIVE"
  | "COMPLETED"
  | "TERMINATED"
  | "ERROR";

export interface SessionRow {
  id: string;

  siteId: string;
  routerId: string;
  routerName: string | null;

  voucherId: string | null;
  clientId: string | null;
  deviceId: string | null;

  username: string | null;

  macAddress: string | null;
  ipAddress: string | null;

  startedAt: Date;
  endedAt: Date | null;

  durationSeconds: number | null;

  uploadBytes: number;
  downloadBytes: number;

  terminationReason: string | null;

  status: SessionStatus;

  createdAt: Date;
  updatedAt: Date;
}

/* ============================================================
   DONNÉES POUR UPSERT DEPUIS LE LIVE SYNC MIKROTIK
============================================================ */

export interface LiveSessionData {
  siteId: string;
  routerId: string;

  username: string | null;
  macAddress: string;
  ipAddress: string | null;

  uploadBytes: number;
  downloadBytes: number;
}
