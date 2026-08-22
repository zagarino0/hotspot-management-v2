export type RadioBand =
  | "2.4_GHZ"
  | "5_GHZ"
  | "6_GHZ"
  | "OTHER";

export type RadioSecurityMode =
  | "OPEN"
  | "WPA2"
  | "WPA3"
  | "WPA2_WPA3"
  | "UNKNOWN";

export type RadioStatus =
  | "UP"
  | "DOWN"
  | "DISABLED"
  | "UNKNOWN";

export interface AccessPointRadio {
  id: string;

  accessPointId: string;

  name: string;

  band: RadioBand;

  frequency?: number | null;
  channel?: number | null;
  channelWidth?: string | null;

  ssid?: string | null;

  securityMode: RadioSecurityMode;

  txPower?: number | null;

  enabled: boolean;

  status: RadioStatus;

  createdAt: Date;
  updatedAt: Date;
}