import { useEffect, useState, useRef } from "react";

export interface WebSocketMessage {
  type: "stats" | "sessions" | "router" | "error";
  data: unknown;
  timestamp: string;
}

export interface StatsUpdate {
  activeUsers: number;
  routersOnline: number;
  totalRouters: number;
  revenue: number;
  timestamp: string;
}

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<StatsUpdate | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    let shouldReconnect = true;

    const connect = () => {
      const wsUrl =
        import.meta.env.VITE_WS_URL ?? "ws://localhost:4000";
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[WebSocket] Connected");
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          if (message.type === "stats" && isStatsUpdate(message.data)) {
            setStats(message.data);
          }
        } catch (error) {
          console.error("[WebSocket] Error parsing message:", error);
        }
      };

      ws.onclose = () => {
        console.log("[WebSocket] Disconnected");
        setConnected(false);
        wsRef.current = null;

        if (shouldReconnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { connected, stats, lastMessage };
}

function isStatsUpdate(data: unknown): data is StatsUpdate {
  if (!data || typeof data !== "object") {
    return false;
  }

  const candidate = data as Record<string, unknown>;

  return (
    typeof candidate.activeUsers === "number" &&
    typeof candidate.routersOnline === "number" &&
    typeof candidate.totalRouters === "number" &&
    typeof candidate.revenue === "number" &&
    typeof candidate.timestamp === "string"
  );
}
