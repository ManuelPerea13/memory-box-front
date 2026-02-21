import { useEffect, useRef } from 'react';
import api from '../restclient/api';

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_MS = 3000;
const MAX_RECONNECT_MS = 30000;

/**
 * Hook para recibir actualizaciones en tiempo real de pedidos y notificaciones (campanita).
 * Mantiene la conexión aunque la pestaña esté en segundo plano para no perder notificaciones.
 */
const useOrdersWebSocket = (onOrdersUpdate) => {
  const wsRef = useRef(null);
  const onOrdersUpdateRef = useRef(onOrdersUpdate);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    onOrdersUpdateRef.current = onOrdersUpdate;
  }, [onOrdersUpdate]);

  useEffect(() => {
    cancelledRef.current = false;
    const baseUrl = api.baseUrl || 'http://localhost:8000/';
    const wsBase = baseUrl.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}ws/orders/`;

    const close = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      const ws = wsRef.current;
      if (ws) {
        wsRef.current = null;
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Unmount');
        }
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
            ws.close(1000, 'Unmount');
            wsRef.current = null;
            return;
          }
          reconnectAttemptsRef.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'orders_update' && onOrdersUpdateRef.current) {
              onOrdersUpdateRef.current(message.data || {});
            }
          } catch (_) {}
        };

        ws.onerror = () => {};

        ws.onclose = (event) => {
          wsRef.current = null;
          if (cancelledRef.current) return;
          if (event.code === 1000 || event.code === 1001) return;
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(
            INITIAL_RECONNECT_MS * 2 ** (reconnectAttemptsRef.current - 1),
            MAX_RECONNECT_MS
          );
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        };
      } catch (_) {
        if (cancelledRef.current) return;
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(
          INITIAL_RECONNECT_MS * 2 ** (reconnectAttemptsRef.current - 1),
          MAX_RECONNECT_MS
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

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
};

export default useOrdersWebSocket;
