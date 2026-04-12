import Elysia, { t } from "elysia";
import { db } from "../db";
import { statuses } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { wsManager } from "../wsManager";

export const statusRoutes = new Elysia({ prefix: "/statuses" })
  .get("/", () => {
    return db.select().from(statuses).orderBy(statuses.position).all();
  })
  .post(
    "/",
    ({ body }) => {
      const id = randomUUID();
      const all = db.select().from(statuses).all();
      const position = all.length;
      const row = { id, ...body, position, isCore: false };
      db.insert(statuses).values(row).run();
      const created = db
        .select()
        .from(statuses)
        .where(eq(statuses.id, id))
        .get()!;
      wsManager.broadcast("status:created", created);
      return created;
    },
    {
      body: t.Object({
        name: t.String(),
        color: t.String(),
      }),
    }
  )
  .patch(
    "/:id",
    ({ params, body, set }) => {
      const existing = db.select().from(statuses).where(eq(statuses.id, params.id)).get();
      if (!existing) {
        set.status = 404;
        return { error: "Not found" };
      }
      if (existing.isCore && typeof body.name === "string" && body.name !== existing.name) {
        set.status = 400;
        return { error: "Core statuses cannot be renamed" };
      }
      db.update(statuses)
        .set(body)
        .where(eq(statuses.id, params.id))
        .run();
      const updated = db
        .select()
        .from(statuses)
        .where(eq(statuses.id, params.id))
        .get();
      if (!updated) throw new Error("Not found");
      wsManager.broadcast("status:updated", updated);
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Partial(
        t.Object({
          name: t.String(),
          color: t.String(),
          position: t.Number(),
        })
      ),
    }
  )
  .delete(
    "/:id",
    ({ params, set }) => {
      const existing = db.select().from(statuses).where(eq(statuses.id, params.id)).get();
      if (!existing) {
        set.status = 404;
        return { error: "Not found" };
      }
      if (existing.isCore) {
        set.status = 400;
        return { error: "Core statuses cannot be deleted" };
      }
      db.delete(statuses).where(eq(statuses.id, params.id)).run();
      wsManager.broadcast("status:deleted", { id: params.id });
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    }
  );
