"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { WebSocketEvent } from "../lib/types";

interface UseWebSocketOptions {
  onEvent?: (event: WebSocketEvent) => void;
  pollingIntervalMs?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [transportMode, setTransportMode] = useState<"WEBSOCKET" | "SSE" | "POLLING">("POLLING");
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleIncomingEvent = useCallback((event: WebSocketEvent) => {
    setLastEvent(event);
    if (options.onEvent) {
      options.onEvent(event);
    }
  }, [options]);

  const clearFallbacks = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const startPollingFallback = useCallback(() => {
    setTransportMode("POLLING");
    if (!pollingIntervalRef.current) {
      const intervalMs = options.pollingIntervalMs || 20000;
      pollingIntervalRef.current = setInterval(() => {
        // Fallback HTTP poll: emit synthetic event to refresh data
        handleIncomingEvent({
          event: "REPORT_CREATED",
          timestamp: new Date().toISOString(),
          payload: { fallback_poll: true }
        });
      }, intervalMs);
    }
  }, [options.pollingIntervalMs, handleIncomingEvent]);

  const connectSSE = useCallback(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      startPollingFallback();
      return;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";
    try {
      const sse = new EventSource(`${apiBase}/api/v1/realtime/events`);
      sse.onopen = () => {
        setIsConnected(true);
        setTransportMode("SSE");
        clearFallbacks();
      };

      sse.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          handleIncomingEvent({
            event: parsed.event_type || "REPORT_CREATED",
            timestamp: parsed.timestamp || new Date().toISOString(),
            payload: parsed.payload || {}
          });
        } catch {
          // ignore keepalive comments
        }
      };

      sse.onerror = () => {
        sse.close();
        sseRef.current = null;
        setIsConnected(false);
        startPollingFallback();
      };

      sseRef.current = sse;
    } catch {
      startPollingFallback();
    }
  }, [startPollingFallback, handleIncomingEvent]);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8001/ws/live";
    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setTransportMode("WEBSOCKET");
        clearFallbacks();
        if (sseRef.current) {
          sseRef.current.close();
          sseRef.current = null;
        }
        // Emit resync on reconnect
        handleIncomingEvent({
          event: "REPORT_CREATED",
          timestamp: new Date().toISOString(),
          payload: { resync: true }
        });
      };

      ws.onmessage = (event) => {
        try {
          const parsed: WebSocketEvent = JSON.parse(event.data);
          handleIncomingEvent(parsed);
        } catch {
          // Ignore non-json frames (e.g. pong)
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Try SSE fallback first
        connectSSE();
        // Schedule WebSocket reconnect
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      setIsConnected(false);
      connectSSE();
    }
  }, [connectSSE, handleIncomingEvent]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
      if (sseRef.current) sseRef.current.close();
    };
  }, [connect]);

  return { isConnected, transportMode, isPolling: transportMode === "POLLING", lastEvent };
}
