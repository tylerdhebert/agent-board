import { Elysia, t } from "elysia";
import { db, sqlite } from "../db";
import { queueMessages } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { wsManager } from "../wsManager";

export const queueRoutes = new Elysia({ prefix: "/queue" })
  // GET /api/queue/conversations — grouped thread list ordered by most recent
  .get("/conversations", () => {
    const rows = sqlite
      .prepare(
        `SELECT agent_id as agentId,
                COUNT(*) as total,
                SUM(CASE WHEN status='pending' AND author!='user' THEN 1 ELSE 0 END) as unread,
                MAX(created_at) as lastAt
         FROM queue_messages
         GROUP BY agent_id
         ORDER BY lastAt DESC`
      )
      .all() as { agentId: string; total: number; unread: number; lastAt: string }[];
    return rows;
  })

  // GET /api/queue — message list. Optional ?agentId= filter (exact match), optional ?status= filter
  .get("/", ({ query }) => {
    let q = db.select().from(queueMessages).$dynamic();
    if (query.agentId) {
      q = q.where(eq(queueMessages.agentId, query.agentId));
    }
    if (query.status) q = q.where(eq(queueMessages.status, query.status as "pending" | "read"));
    return q.orderBy(queueMessages.createdAt).all();
  }, {
    query: t.Object({
      agentId: t.Optional(t.String()),
      status: t.Optional(t.String()),
    }),
  })

  // POST /api/queue — create a message
  .post("/", ({ body }) => {
    const msg = {
      id: randomUUID(),
      agentId: body.agentId,
      body: body.body,
      status: "pending" as const,
      author: body.author ?? "user",
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    db.insert(queueMessages).values(msg).run();
    wsManager.broadcast("queue:created", msg);
    return msg;
  }, {
    body: t.Object({
      agentId: t.String(),
      body: t.String(),
      author: t.Optional(t.String()),
    }),
  })

  // POST /api/queue/:id/read — agent marks a message as read
  .post("/:id/read", ({ params }) => {
    const readAt = new Date().toISOString();
    db.update(queueMessages)
      .set({ status: "read", readAt })
      .where(eq(queueMessages.id, params.id))
      .run();
    const msg = db.select().from(queueMessages).where(eq(queueMessages.id, params.id)).get();
    if (msg) wsManager.broadcast("queue:read", msg);
    return msg;
  }, {
    params: t.Object({ id: t.String() }),
  })

  // DELETE /api/queue/:id — delete a message
  .delete("/:id", ({ params }) => {
    db.delete(queueMessages).where(eq(queueMessages.id, params.id)).run();
    wsManager.broadcast("queue:deleted", { id: params.id });
    return { deleted: true };
  }, {
    params: t.Object({ id: t.String() }),
  });
