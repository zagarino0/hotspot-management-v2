import { useEffect, useState, useRef } from "react";

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

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<StatsUpdate | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(`ws://localhost:4000`);

      ws.onopen = () => {
        console.log("[WebSocket] Connected");
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          if (message.type === "stats") {
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

        // Reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
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
