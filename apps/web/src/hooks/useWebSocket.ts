"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getApiBase } from "../lib/api";
import { WebSocketEvent } from "../lib/types";

function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "ws://localhost:8000/ws/live";
    }
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws/live`;
  }
  return "ws://localhost:8000/ws/live";
}


interface UseWebSocketOptions {
  onEvent?: (event: WebSocketEvent) => void;
  pollingIntervalMs?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [transportMode, setTransportMode] = useState<"WEBSOCKET" | "SSE" | "POLLING">("POLLING");
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const unmountedRef = useRef(false);

  const handleIncomingEvent = useCallback((event: WebSocketEvent) => {
    setLastEvent(event);
    if (optionsRef.current.onEvent) {
      optionsRef.current.onEvent(event);
    }
  }, []);

  const clearFallbacks = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startPollingFallback = useCallback(() => {
    if (unmountedRef.current) return;
    setTransportMode("POLLING");
    if (!pollingIntervalRef.current) {
      const intervalMs = optionsRef.current.pollingIntervalMs || 20000;
      pollingIntervalRef.current = setInterval(() => {
        handleIncomingEvent({
          event: "REPORT_CREATED",
          timestamp: new Date().toISOString(),
          payload: { fallback_poll: true }
        });
      }, intervalMs);
    }
  }, [handleIncomingEvent]);

  const connectSSE = useCallback(() => {
    if (unmountedRef.current) return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      startPollingFallback();
      return;
    }

    const apiBase = getApiBase();
    try {
      if (sseRef.current) {
        sseRef.current.close();
      }

      const sse = new EventSource(`${apiBase}/api/v1/realtime/events`);
      sse.onopen = () => {
        if (unmountedRef.current) { sse.close(); return; }
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
        if (!unmountedRef.current) {
          setIsConnected(false);
          startPollingFallback();
        }
      };

      sseRef.current = sse;
    } catch {
      startPollingFallback();
    }
  }, [startPollingFallback, clearFallbacks, handleIncomingEvent]);

  const connect = useCallback(() => {
    if (unmountedRef.current || typeof window === "undefined") return;

    const wsUrl = getWsUrl();

    try {
      if (wsRef.current) {
        const oldWs = wsRef.current;
        wsRef.current = null;
        oldWs.onmessage = null;
        oldWs.onerror = null;
        oldWs.onclose = null;
        if (oldWs.readyState === WebSocket.OPEN) {
          try { oldWs.close(1000, "Reconnecting"); } catch {}
        }
      }

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (unmountedRef.current) {
          try { ws.close(1000, "Component unmounted"); } catch {}
          return;
        }
        setIsConnected(true);
        setTransportMode("WEBSOCKET");
        clearFallbacks();
        if (sseRef.current) {
          sseRef.current.close();
          sseRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const parsed: WebSocketEvent = JSON.parse(event.data);
          handleIncomingEvent(parsed);
        } catch {
          // Ignore non-json frames
        }
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        setIsConnected(false);
        // Try SSE fallback first
        connectSSE();
        // Schedule WebSocket reconnect with safe 5s backoff
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };

      ws.onerror = () => {
        if (unmountedRef.current) return;
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        } catch {
          // ignore
        }
      };

      wsRef.current = ws;
    } catch {
      setIsConnected(false);
      connectSSE();
    }
  }, [connectSSE, clearFallbacks, handleIncomingEvent]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (wsRef.current) {
        const socket = wsRef.current;
        wsRef.current = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (socket.readyState === WebSocket.CONNECTING) {
          socket.onopen = () => {
            try { socket.close(1000, "Component unmounted"); } catch {}
          };
        } else if (socket.readyState === WebSocket.OPEN) {
          try { socket.close(1000, "Component unmounted"); } catch {}
        }
      }
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [connect]);

  return { isConnected, transportMode, isPolling: transportMode === "POLLING", lastEvent };
}
