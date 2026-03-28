/**
 * wsManager — tracks connected WebSocket clients and broadcasts events.
 *
 * Elysia's `.ws()` gives us a ServerWebSocket handle on each connection.
 * We store those handles in a Set and iterate them to broadcast.
 *
 * NOTE: `WsEvent` is duplicated in `client/src/api/types.ts`. To consolidate,
 * the canonical definition should live here (server) and the client should
 * import it via the Eden treaty path alias (@server → server/src/index.ts).
 * That would require re-exporting WsEvent from server/src/index.ts so it
 * appears in the Eden treaty type surface, which the client already imports
 * for other shared types (e.g. WorkflowType).
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
  | "feature:deleted"
  | "queue:created"
  | "queue:read"
  | "queue:deleted"
  | "card:unblocked"
  | "card:dependency:added"
  | "card:dependency:removed"
  | "build:started"
  | "build:completed"
  | "card:conflicted";

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
