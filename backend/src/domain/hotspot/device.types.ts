export type DeviceType =
  | "PHONE"
  | "TABLET"
  | "LAPTOP"
  | "DESKTOP"
  | "TV"
  | "IOT"
  | "ROUTER"
  | "UNKNOWN";

export interface Device {
  id: string;

  organizationId: string;
  siteId: string;

  /**
   * Client connu associé à cet appareil.
   * Peut être null si l'appareil est découvert
   * avant l'identification du client.
   */
  clientId?: string | null;

  macAddress: string;

  hostname?: string | null;

  deviceType?: DeviceType;

  vendor?: string | null;

  firstSeenAt: Date;
  lastSeenAt: Date;

  createdAt: Date;
  updatedAt: Date;
}