import type { RouterOSAPI } from "node-routeros";

export type MikrotikHotspotLogEventType =
  | "LOGIN_ATTEMPT"
  | "LOGIN"
  | "LOGOUT";

export interface MikrotikHotspotLogEvent {
  routerLogId: string | null;
  timestamp: string;
  eventType: MikrotikHotspotLogEventType;
  username: string | null;
  ipAddress: string | null;
  loginMethod: string | null;
  logoutReason: string | null;
  message: string;
  topics: string[];
}

/**
 * Lit les événements HotSpot présents dans le journal MikroTik.
 *
 * Le journal reste une source historique complémentaire :
 * /ip/hotspot/active/print reste la source de vérité pour l'état
 * temps réel des connexions.
 */
export async function fetchHotspotLogs(
  api: RouterOSAPI
): Promise<MikrotikHotspotLogEvent[]> {
  const rows = await api.write("/log/print");

  return rows
    .map((row: Record<string, unknown>) =>
      parseHotspotLogRow(row)
    )
    .filter(
      (event): event is MikrotikHotspotLogEvent =>
        event !== null
    );
}

function parseHotspotLogRow(
  row: Record<string, unknown>
): MikrotikHotspotLogEvent | null {
  const message =
    typeof row.message === "string"
      ? row.message.trim()
      : "";

  if (!message) {
    return null;
  }

  const topics = parseTopics(row.topics);

  if (!topics.some((topic) => topic === "hotspot")) {
    return null;
  }

  const timestamp = parseTimestamp(row.time);

  if (!timestamp) {
    return null;
  }

  const match = message.match(
    /^->\\s*([^\\s]+)\\s+\\(([^)]+)\\):\\s*(.*)$/i
  );

  if (!match) {
    return null;
  }

  const username = match[1]?.trim() || null;
  const ipAddress = match[2]?.trim() || null;
  const eventMessage = match[3]?.trim() || "";

  if (!username || !eventMessage) {
    return null;
  }

  const normalizedMessage = eventMessage.toLowerCase();

  if (
    normalizedMessage.startsWith("trying to log in by ")
  ) {
    return {
      routerLogId: parseRouterLogId(row[".id"]),
      timestamp,
      eventType: "LOGIN_ATTEMPT",
      username,
      ipAddress,
      loginMethod:
        eventMessage
          .slice("trying to log in by ".length)
          .trim() || null,
      logoutReason: null,
      message: eventMessage,
      topics,
    };
  }

  if (normalizedMessage === "logged in") {
    return {
      routerLogId: parseRouterLogId(row[".id"]),
      timestamp,
      eventType: "LOGIN",
      username,
      ipAddress,
      loginMethod: null,
      logoutReason: null,
      message: eventMessage,
      topics,
    };
  }

  if (normalizedMessage.startsWith("logged out")) {
    const reason = eventMessage
      .slice("logged out".length)
      .replace(/^:\\s*/, "")
      .trim();

    return {
      routerLogId: parseRouterLogId(row[".id"]),
      timestamp,
      eventType: "LOGOUT",
      username,
      ipAddress,
      loginMethod: null,
      logoutReason: reason || null,
      message: eventMessage,
      topics,
    };
  }

  return null;
}

function parseTopics(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((topic) => topic.trim().toLowerCase())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value
      .filter((topic): topic is string =>
        typeof topic === "string"
      )
      .map((topic) => topic.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim();

  if (!raw) {
    return null;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function parseRouterLogId(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}
