import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";

/* ============================================================
   TYPES
============================================================ */

export interface WebSocketMessage {
  type: "stats" | "sessions" | "router" | "error";
  data: any;
  timestamp: string;
}

export interface StatsUpdate {
  activeUsers: number;
  routersOnline: number;
  totalRouters: number;
  revenue: number;
  timestamp: string;
}

/* ============================================================
   WEBSOCKET SERVER
============================================================ */

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function initWebSocketServer(server: any) {
  if (wss) {
    console.log("[WebSocket] Server already initialized");
    return;
  }

  wss = new WebSocketServer({ server });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    console.log("[WebSocket] Client connected");
    clients.add(ws);

    // Envoyer les stats initiales
    sendStatsUpdate(ws);

    ws.on("close", () => {
      console.log("[WebSocket] Client disconnected");
      clients.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("[WebSocket] Error:", error);
    });
  });

  console.log("[WebSocket] Server initialized");
}

export function broadcastStatsUpdate(stats: StatsUpdate) {
  const message: WebSocketMessage = {
    type: "stats",
    data: stats,
    timestamp: new Date().toISOString(),
  };

  const payload = JSON.stringify(message);

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

export function broadcastSessionUpdate(session: any) {
  const message: WebSocketMessage = {
    type: "sessions",
    data: session,
    timestamp: new Date().toISOString(),
  };

  const payload = JSON.stringify(message);

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

export function broadcastRouterUpdate(router: any) {
  const message: WebSocketMessage = {
    type: "router",
    data: router,
    timestamp: new Date().toISOString(),
  };

  const payload = JSON.stringify(message);

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

export function sendStatsUpdate(ws: WebSocket) {
  // Pour l'instant, envoyer des stats factices
  const stats: StatsUpdate = {
    activeUsers: 12,
    routersOnline: 1,
    totalRouters: 1,
    revenue: 45000,
    timestamp: new Date().toISOString(),
  };

  const message: WebSocketMessage = {
    type: "stats",
    data: stats,
    timestamp: new Date().toISOString(),
  };

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function getConnectedClientsCount(): number {
  return clients.size;
}
