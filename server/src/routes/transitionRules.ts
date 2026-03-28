import Elysia, { t } from "elysia";
import { db } from "../db";
import { transitionRules } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { nowIso } from "../helpers/db";

export const transitionRuleRoutes = new Elysia({ prefix: "/transition-rules" })
  .get("/", () => db.select().from(transitionRules).all())
  .post(
    "/",
    ({ body }) => {
      const id = randomUUID();
      const row = {
        id,
        agentPattern: body.agentPattern ?? null,
        fromStatusId: body.fromStatusId ?? null,
        toStatusId: body.toStatusId,
        createdAt: nowIso(),
      };
      db.insert(transitionRules).values(row).run();
      return db.select().from(transitionRules).where(eq(transitionRules.id, id)).get()!;
    },
    {
      body: t.Object({
        toStatusId: t.String(),
        agentPattern: t.Optional(t.Union([t.String(), t.Null()])),
        fromStatusId: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    }
  )
  .delete(
    "/:id",
    ({ params }) => {
      db.delete(transitionRules).where(eq(transitionRules.id, params.id)).run();
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  );
