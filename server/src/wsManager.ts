/**
 * wsManager — tracks connected WebSocket clients and broadcasts events.
 *
 * Elysia's `.ws()` gives us a ServerWebSocket handle on each connection.
 * We store those handles in a Set and iterate them to broadcast.
 */

export type WsEvent =
  | "card:created"
  | "card:updated"
  | "card:deleted"
  | "comment:created"
  | "input:requested"
  | "input:answered"
  | "input:timed_out"
  | "status:created"
  | "status:updated"
  | "status:deleted"
  | "epic:created"
  | "epic:updated"
  | "epic:deleted"
  | "feature:created"
  | "feature:updated"
  | "feature:deleted";

export interface WsMessage {
  event: WsEvent;
  data: unknown;
}

// Elysia's ws handler gives us objects with a .send() method — we type it loosely
interface WsClient {
  send(data: string): void;
  readyState: number;
}

const clients = new Set<WsClient>();

export const wsManager = {
  add(client: WsClient) {
    clients.add(client);
  },
  remove(client: WsClient) {
    clients.delete(client);
  },
  broadcast(event: WsEvent, data: unknown) {
    const msg = JSON.stringify({ event, data });
    for (const client of clients) {
      try {
        // readyState 1 === OPEN
        if (client.readyState === 1) {
          client.send(msg);
        }
      } catch {
        clients.delete(client);
      }
    }
  },
  get size() {
    return clients.size;
  },
};
