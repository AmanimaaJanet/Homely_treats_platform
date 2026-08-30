import { WebSocketServer } from 'ws';

/**
 * Real-time order updates over WebSockets.
 * Clients (tracking page, admin, rider) connect to /ws?order=<id> or /ws?channel=admin
 * and receive { type, orderId, status } broadcasts whenever an order changes.
 */

let wss = null;
const rooms = new Map(); // roomName -> Set<WebSocket>

export function attachWebSocket(server) {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      socket.destroy();
      return;
    }
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.rooms = new Set();
      const orderId = url.searchParams.get('order');
      const channel = url.searchParams.get('channel');
      if (orderId) ws.rooms.add(`order:${orderId}`);
      if (channel) ws.rooms.add(`channel:${channel}`);
      if (ws.rooms.size === 0) ws.rooms.add('order:all');
      ws.rooms.forEach((r) => join(r, ws));
      ws.on('close', () => ws.rooms.forEach((r) => leave(r, ws)));
      ws.on('error', () => ws.rooms.forEach((r) => leave(r, ws)));
      ws.send(JSON.stringify({ type: 'connected' }));
    });
  });
}

function join(room, ws) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
}

function leave(room, ws) {
  const set = rooms.get(room);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(room);
  }
}

/** Broadcast an order change to its room + the admin channel. */
export function broadcastOrder(orderId, payload = {}) {
  if (!wss) return;
  const msg = JSON.stringify({ type: 'ORDER_UPDATED', orderId, ...payload });
  sendTo(`order:${orderId}`, msg);
  sendTo('channel:admin', msg);
}

function sendTo(room, msg) {
  const set = rooms.get(room);
  if (!set) return;
  for (const ws of set) {
    try {
      if (ws.readyState === 1) ws.send(msg);
    } catch {
      /* ignore */
    }
  }
}
