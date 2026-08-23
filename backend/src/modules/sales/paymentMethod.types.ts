export type PaymentMethodType =
  | "CASH"
  | "MVOLA"
  | "ORANGE_MONEY"
  | "AIRTEL_MONEY"
  | "BANK"
  | "CARD"
  | "OTHER";

export type PaymentMethodStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "ARCHIVED";

export interface PaymentMethod {
  id: string;

  organizationId: string;
  siteId: string;

  name: string;

  /**
   * Identifiant technique.
   * Exemple :
   * CASH
   * MVOLA
   * ORANGE_MONEY
   */
  code: string;

  type: PaymentMethodType;

  status: PaymentMethodStatus;

  /**
   * Configuration non sensible.
   *
   * Les secrets/API keys ne doivent pas
   * être stockés ici en clair.
   */
  configuration?: Record<string, unknown> | null;

  createdAt: Date;
  updatedAt: Date;
}