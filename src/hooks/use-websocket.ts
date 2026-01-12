import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "@/types/messages";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: ServerMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  maxRetries?: number;
}

interface UseWebSocketReturn {
  send: (message: ClientMessage) => void;
  connectionStatus: ConnectionStatus;
  disconnect: () => void;
}

const MAX_RETRIES_DEFAULT = 5;
const INITIAL_RETRY_DELAY = 1000;

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  maxRetries = MAX_RETRIES_DEFAULT,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);

  // Store callbacks in refs to avoid recreating connect function
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  // Keep refs updated with latest callbacks
  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onMessage, onConnect, onDisconnect]);

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    clearRetryTimeout();
    setConnectionStatus("connecting");

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("connected");
      retryCountRef.current = 0;
      onConnectRef.current?.();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        onMessageRef.current?.(message);
      } catch {
        console.error("Failed to parse WebSocket message:", event.data);
      }
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
      onDisconnectRef.current?.();

      // Attempt reconnection with exponential backoff
      if (shouldReconnectRef.current && retryCountRef.current < maxRetries) {
        const delay = INITIAL_RETRY_DELAY * 2 ** retryCountRef.current;
        retryCountRef.current += 1;
        retryTimeoutRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }, [url, maxRetries, clearRetryTimeout]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    clearRetryTimeout();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus("disconnected");
  }, [clearRetryTimeout]);

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;
      clearRetryTimeout();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, clearRetryTimeout]);

  return {
    send,
    connectionStatus,
    disconnect,
  };
}
