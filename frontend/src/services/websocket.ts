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
  const onMessageReceivedRef = useRef(onMessageReceived);
  const connectRef = useRef<() => void>(() => {});
  const activeRef = useRef(false);

  useEffect(() => {
    onMessageReceivedRef.current = onMessageReceived;
  }, [onMessageReceived]);

  const connect = useCallback(() => {
    if (!activeRef.current) return;
    // Determine ws url
    const envWs = import.meta.env.VITE_WS_BASE_URL || import.meta.env.VITE_API_BASE_URL;
    let wsUrl: string;
    if (envWs) {
      wsUrl = `${envWs.replace(/\/$/, '').replace(/^http/, 'ws')}/api/v1/ws/live`;
    } else {
      const loc = window.location;
      const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      // In dev, if on 5173 with proxy:
      wsUrl = `${protocol}//${loc.host}/api/v1/ws/live`;
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
          if (onMessageReceivedRef.current) {
            onMessageReceivedRef.current(data);
          }
        } catch {
          // Non-JSON message (e.g. pong)
        }
      };

      socket.onclose = () => {
        if (wsRef.current !== socket) return;
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        // Try reconnect in 3s
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        if (activeRef.current) reconnectTimeoutRef.current = window.setTimeout(() => {
          connectRef.current();
        }, 3000);
      };

      socket.onerror = () => {
        setIsConnected(false);
        socket.close();
      };
    } catch {
      if (activeRef.current) reconnectTimeoutRef.current = window.setTimeout(() => connectRef.current(), 3000);
    }
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    activeRef.current = true;
    connect();
    return () => {
      activeRef.current = false;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onopen = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { isConnected, lastMessage };
};
