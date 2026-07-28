"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_MS = 3000;
const MAX_RECONNECT_MS = 30000;

type OrdersUpdateHandler = (data: Record<string, unknown>) => void;

/**
 * Recibe actualizaciones en tiempo real de pedidos y notificaciones (campanita).
 * Mantiene la conexión aunque la pestaña esté en segundo plano.
 */
export default function useOrdersWebSocket(onOrdersUpdate: OrdersUpdateHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const onOrdersUpdateRef = useRef(onOrdersUpdate);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const cancelledRef = useRef(false);
  // Estado real (no leer el ref en render: rompe react-hooks/refs).
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    onOrdersUpdateRef.current = onOrdersUpdate;
  }, [onOrdersUpdate]);

  useEffect(() => {
    cancelledRef.current = false;
    const baseUrl = api.baseUrl || "http://localhost:8000/";
    const wsBase = baseUrl.replace(/^http/, "ws");
    const wsUrl = `${wsBase}ws/orders/`;

    const close = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      const ws = wsRef.current;
      if (ws) {
        wsRef.current = null;
        if (ws.readyState === WebSocket.OPEN) ws.close(1000, "Unmount");
      }
    };

    const connect = () => {
      if (cancelledRef.current) return;
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelledRef.current) {
            ws.close(1000, "Unmount");
            wsRef.current = null;
            return;
          }
          reconnectAttemptsRef.current = 0;
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === "orders_update" && onOrdersUpdateRef.current) {
              onOrdersUpdateRef.current(message.data || {});
            }
          } catch {
            /* ignore */
          }
        };

        ws.onerror = () => {};

        ws.onclose = (event) => {
          wsRef.current = null;
          setIsConnected(false);
          if (cancelledRef.current) return;
          if (event.code === 1000 || event.code === 1001) return;
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(
            INITIAL_RECONNECT_MS * 2 ** (reconnectAttemptsRef.current - 1),
            MAX_RECONNECT_MS,
          );
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        };
      } catch {
        if (cancelledRef.current) return;
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(
          INITIAL_RECONNECT_MS * 2 ** (reconnectAttemptsRef.current - 1),
          MAX_RECONNECT_MS,
        );
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      cancelledRef.current = true;
      close();
    };
  }, []);

  return { isConnected };
}
