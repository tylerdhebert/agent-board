import { Elysia, t } from "elysia";
import { db, sqlite } from "../db";
import { queueMessages } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { wsManager } from "../wsManager";
import { nowIso } from "../helpers/db";

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
    const conditions = [
      query.agentId ? eq(queueMessages.agentId, query.agentId) : undefined,
      query.status ? eq(queueMessages.status, query.status as "pending" | "read") : undefined,
      query.author ? eq(queueMessages.author, query.author) : undefined,
    ].filter(Boolean) as Parameters<typeof and>;
    return db.select().from(queueMessages)
      .where(and(...conditions))
      .orderBy(queueMessages.createdAt)
      .all();
  }, {
    query: t.Object({
      agentId: t.Optional(t.String()),
      status: t.Optional(t.String()),
      author: t.Optional(t.String()),
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
      createdAt: nowIso(),
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
    const readAt = nowIso();
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

  // DELETE /api/queue/conversations/:agentId — delete all messages for a conversation
  .delete("/conversations/:agentId", ({ params }) => {
    db.delete(queueMessages).where(eq(queueMessages.agentId, params.agentId)).run();
    wsManager.broadcast("queue:deleted", { agentId: params.agentId });
    return { deleted: true };
  }, {
    params: t.Object({ agentId: t.String() }),
  })

  // DELETE /api/queue/:id — delete a message
  .delete("/:id", ({ params }) => {
    db.delete(queueMessages).where(eq(queueMessages.id, params.id)).run();
    wsManager.broadcast("queue:deleted", { id: params.id });
    return { deleted: true };
  }, {
    params: t.Object({ id: t.String() }),
  });
