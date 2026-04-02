/**
 * Sonaro Gate — useRealtimeMetrics
 * WebSocket hook for live Dashboard data. Connects to /ws, receives pushed
 * events from the server agent (metrics every 30s, traffic every 60s), and
 * exposes live state to the Dashboard without polling or manual refresh.
 *
 * @author  Huỳnh Chí Trung (0xDragon) <huynhtrungcsc@gmail.com>
 * @repo    https://github.com/huynhtrungcsc/sonaro-gate
 * @license MIT
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface LiveMetrics {
  hostname: string;
  uptime: number;
  cpu_usage: number;
  cpu_cores: number;
  cpu_temperature: number;
  memory_total: number;
  memory_used: number;
  memory_free: number;
  memory_cached: number;
  disk_total: number;
  disk_used: number;
  disk_free: number;
  load_1m: number;
  load_5m: number;
  load_15m: number;
}

export interface WsState {
  connected: boolean;
  lastUpdate: Date | null;
  metrics: LiveMetrics | null;
  traffic: any[] | null;
}

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export function useRealtimeMetrics(): WsState {
  const [state, setState] = useState<WsState>({
    connected: false,
    lastUpdate: null,
    metrics: null,
    traffic: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        setState(s => ({ ...s, connected: true }));
      };

      ws.onmessage = (evt) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(evt.data as string);
          setState(s => {
            const next = { ...s, lastUpdate: new Date() };
            if (msg.event === 'metrics') next.metrics = msg.data as LiveMetrics;
            if (msg.event === 'traffic') next.traffic = msg.data as any[];
            return next;
          });
        } catch { /* ignore malformed */ }
      };

      ws.onerror = () => { /* handled by onclose */ };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setState(s => ({ ...s, connected: false }));
        // Auto-reconnect after 3s
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };
    } catch {
      reconnectTimerRef.current = setTimeout(connect, 5000);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return state;
}
