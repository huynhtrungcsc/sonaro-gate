/**
 * Sonaro Gate — WebSocket Real-Time Push
 * Broadcasts live system metrics to all authenticated frontend clients.
 *
 * Uses `noServer: true` + manual upgrade handling so our /ws path
 * coexists with Vite's HMR WebSocket without interference.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';

export interface WsPayload {
  event: string;
  data: unknown;
  ts: string;
}

let wss: WebSocketServer | null = null;

export function attachWebSocket(httpServer: Server): WebSocketServer {
  // Use noServer mode — we manually route /ws upgrades, leaving all
  // other upgrade events (e.g. Vite HMR) untouched on the httpServer.
  wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (socket: WebSocket, _req: IncomingMessage) => {
    socket.on('error', () => { /* suppress */ });
    safeSend(socket, { event: 'connected', data: { ts: new Date().toISOString() }, ts: new Date().toISOString() });
  });

  // Only handle upgrades to /ws — everything else is left for Vite HMR
  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      if (url.pathname === '/ws') {
        wss!.handleUpgrade(req, socket as any, head, (ws) => {
          wss!.emit('connection', ws, req);
        });
      }
      // Non-/ws paths: do nothing — Vite HMR or other handlers manage them
    } catch {
      socket.destroy();
    }
  });

  console.log('[WS] WebSocket server ready at /ws');
  return wss;
}

function safeSend(socket: WebSocket, payload: WsPayload) {
  if (socket.readyState === WebSocket.OPEN) {
    try { socket.send(JSON.stringify(payload)); } catch { /* ignore */ }
  }
}

/**
 * Broadcast a named event to every connected client.
 * Called from the agent after each metric collection.
 */
export function broadcast(event: string, data: unknown) {
  if (!wss) return;
  const payload: WsPayload = { event, data, ts: new Date().toISOString() };
  const msg = JSON.stringify(payload);
  wss.clients.forEach(socket => {
    if (socket.readyState === WebSocket.OPEN) {
      try { socket.send(msg); } catch { /* ignore */ }
    }
  });
}
