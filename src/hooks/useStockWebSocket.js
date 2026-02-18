import { useEffect, useRef } from 'react';
import api from '../restclient/api';

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_MS = 3000;
const MAX_RECONNECT_MS = 30000;

/**
 * Hook para recibir actualizaciones en tiempo real de stock y pedidos (página Stock).
 * Solo mantiene la conexión con la pestaña visible; reconexión con backoff y límite de intentos.
 */
const useStockWebSocket = (onStockUpdate) => {
  const wsRef = useRef(null);
  const onStockUpdateRef = useRef(onStockUpdate);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    onStockUpdateRef.current = onStockUpdate;
  }, [onStockUpdate]);

  useEffect(() => {
    const baseUrl = api.baseUrl || 'http://localhost:8000/';
    const wsBase = baseUrl.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}ws/stock/`;

    const close = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Visibility or unmount');
        wsRef.current = null;
      }
    };

    const connect = () => {
      if (document.hidden) return;
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttemptsRef.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'stock_update' && onStockUpdateRef.current) {
              onStockUpdateRef.current();
            }
          } catch (_) {}
        };

        ws.onerror = () => {};

        ws.onclose = (event) => {
          wsRef.current = null;
          if (event.code === 1000 || event.code === 1001) return;
          if (document.hidden) return;
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(
            INITIAL_RECONNECT_MS * 2 ** (reconnectAttemptsRef.current - 1),
            MAX_RECONNECT_MS
          );
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        };
      } catch (_) {
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(
          INITIAL_RECONNECT_MS * 2 ** (reconnectAttemptsRef.current - 1),
          MAX_RECONNECT_MS
        );
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        close();
      } else {
        reconnectAttemptsRef.current = 0;
        connect();
      }
    };

    if (document.hidden) return;
    connect();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      close();
    };
  }, []);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
};

export default useStockWebSocket;
