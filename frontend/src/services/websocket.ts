import { useEffect, useRef, useState, useCallback } from 'react';

export type WSMessage = {
  type: string;
  [key: string]: any;
};

export const useMediSyncWebSocket = (onMessageReceived?: (msg: WSMessage) => void) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    // Determine ws url
    const envWs = import.meta.env.VITE_WS_BASE_URL;
    let wsUrl: string;
    if (envWs) {
      wsUrl = `${envWs}/api/v1/ws/live`;
    } else {
      const loc = window.location;
      const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      // In dev, if on 5173 with proxy:
      wsUrl = `${protocol}//${loc.hostname}:8000/api/v1/ws/live`;
    }

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        // Start ping heartbeat
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send('ping');
          }
        }, 15000);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          if (onMessageReceived) {
            onMessageReceived(data);
          }
        } catch {
          // Non-JSON message (e.g. pong)
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        // Try reconnect in 3s
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      };

      socket.onerror = () => {
        setIsConnected(false);
        socket.close();
      };
    } catch {
      setIsConnected(false);
    }
  }, [onMessageReceived]);

  useEffect(() => {
    connect();
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, lastMessage };
};
