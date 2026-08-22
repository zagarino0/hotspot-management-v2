export type PlanStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "ARCHIVED";

export interface Plan {
  id: string;

  siteId: string;

  name: string;
  code: string;

  description?: string | null;

  price: number;
  currency: string;

  /**
   * Durée d'utilisation en secondes.
   * Exemple :
   * 3600   = 1 heure
   * 86400  = 24 heures
   * 604800 = 7 jours
   */
  durationSeconds: number;

  /**
   * Limite de données facultative.
   * null = pas de limite.
   */
  dataLimitBytes?: number | null;

  /**
   * Débit maximum facultatif en bits/s.
   */
  downloadSpeedBps?: number | null;
  uploadSpeedBps?: number | null;

  /**
   * Nom du profil Hotspot MikroTik associé.
   */
  mikrotikProfile?: string | null;

  status: PlanStatus;

  createdAt: Date;
  updatedAt: Date;
}