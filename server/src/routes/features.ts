import Elysia, { t } from "elysia";
import { db } from "../db";
import { features, cards } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { wsManager } from "../wsManager";

export const featureRoutes = new Elysia({ prefix: "/features" })
  .get("/", () => {
    return db.select().from(features).all();
  })
  .post(
    "/",
    ({ body }) => {
      const id = randomUUID();
      const now = new Date().toISOString();
      const row = { id, ...body, createdAt: now, updatedAt: now };
      db.insert(features).values(row).run();
      const created = db
        .select()
        .from(features)
        .where(eq(features.id, id))
        .get()!;
      wsManager.broadcast("feature:created", created);
      return created;
    },
    {
      body: t.Object({
        epicId: t.String(),
        title: t.String(),
        description: t.Optional(t.String()),
        statusId: t.Optional(t.String()),
      }),
    }
  )
  .patch(
    "/:id",
    ({ params, body }) => {
      const now = new Date().toISOString();
      db.update(features)
        .set({ ...body, updatedAt: now })
        .where(eq(features.id, params.id))
        .run();
      const updated = db
        .select()
        .from(features)
        .where(eq(features.id, params.id))
        .get();
      if (!updated) throw new Error("Not found");
      wsManager.broadcast("feature:updated", updated);
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Partial(
        t.Object({
          title: t.String(),
          description: t.String(),
          statusId: t.String(),
          epicId: t.String(),
        })
      ),
    }
  )
  .delete(
    "/:id",
    ({ params }) => {
      // Delete all cards under this feature first
      db.delete(cards).where(eq(cards.featureId, params.id)).run();
      db.delete(features).where(eq(features.id, params.id)).run();
      wsManager.broadcast("feature:deleted", { id: params.id });
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  );
